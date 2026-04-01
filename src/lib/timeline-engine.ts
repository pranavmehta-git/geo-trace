import type { PhotoRecord, TimelineEntry, Evidence, Confidence } from '@/types';
import { geocode, getJurisdictionLabel } from './geocoder';

interface GeocodedRecord {
  date: string;
  jurisdiction: string;
  country: string;
  state?: string;
  nearBoundary: boolean;
  timestamp: Date;
}

/**
 * Build a day-by-day timeline from photo records.
 *
 * Algorithm:
 * 1. Geocode each record and assign to calendar date
 * 2. For each day, pick plurality jurisdiction
 * 3. Fill gaps with continuity inference (confidence decays)
 * 4. Flag split days and long gaps
 */
export function buildTimeline(records: PhotoRecord[], year: number): TimelineEntry[] {
  if (records.length === 0) return [];

  // Step 1: Geocode and group by date
  const byDate = new Map<string, GeocodedRecord[]>();

  for (const record of records) {
    const result = geocode(record.lat, record.lng);
    if (!result) continue;

    const date = formatDate(record.timestamp);
    const dateYear = parseInt(date.substring(0, 4));
    if (dateYear !== year) continue;

    const geocoded: GeocodedRecord = {
      date,
      jurisdiction: getJurisdictionLabel(result),
      country: result.country,
      state: result.state,
      nearBoundary: result.nearBoundary,
      timestamp: record.timestamp,
    };

    const existing = byDate.get(date) || [];
    existing.push(geocoded);
    byDate.set(date, existing);
  }

  // Step 2: Build entries for days with data
  const entries = new Map<string, TimelineEntry>();

  for (const [date, dayRecords] of byDate) {
    // Count jurisdictions
    const jurisdictionCounts = new Map<string, number>();
    for (const r of dayRecords) {
      jurisdictionCounts.set(r.jurisdiction, (jurisdictionCounts.get(r.jurisdiction) || 0) + 1);
    }

    // Find plurality jurisdiction
    let maxCount = 0;
    let primaryJurisdiction = dayRecords[0].jurisdiction;
    for (const [j, count] of jurisdictionCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryJurisdiction = j;
      }
    }

    const primaryRecord = dayRecords.find(r => r.jurisdiction === primaryJurisdiction)!;
    const isSplitDay = jurisdictionCounts.size > 1;
    const hasNearBoundary = dayRecords.some(r => r.nearBoundary);

    // Calculate confidence
    let confidenceScore: number;
    if (dayRecords.length >= 3 && !hasNearBoundary) {
      confidenceScore = 0.95;
    } else if (dayRecords.length >= 2) {
      confidenceScore = hasNearBoundary ? 0.75 : 0.9;
    } else {
      confidenceScore = hasNearBoundary ? 0.55 : 0.7;
    }

    if (isSplitDay) {
      confidenceScore = Math.min(confidenceScore, 0.7);
    }

    const evidence: Evidence[] = dayRecords.map(r => ({
      timestamp: r.timestamp,
      source: 'photo' as const,
    }));

    entries.set(date, {
      date,
      jurisdiction: primaryJurisdiction,
      country: primaryRecord.country,
      state: primaryRecord.state,
      confidence: scoreToConfidence(confidenceScore),
      confidenceScore,
      evidence,
    });
  }

  // Step 3: Fill gaps with continuity inference
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const today = new Date();
  const lastDate = endDate > today ? today : endDate;

  const timeline: TimelineEntry[] = [];
  let lastKnown: TimelineEntry | null = null;
  let gapLength = 0;

  for (let d = new Date(startDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const existing = entries.get(dateStr);

    if (existing) {
      lastKnown = existing;
      gapLength = 0;
      timeline.push(existing);
    } else if (lastKnown) {
      gapLength++;
      // Confidence decays with gap length
      let inferredScore: number;
      if (gapLength <= 1) inferredScore = 0.65;
      else if (gapLength <= 3) inferredScore = 0.5;
      else if (gapLength <= 7) inferredScore = 0.35;
      else inferredScore = 0.15;

      timeline.push({
        date: dateStr,
        jurisdiction: lastKnown.jurisdiction,
        country: lastKnown.country,
        state: lastKnown.state,
        confidence: scoreToConfidence(inferredScore),
        confidenceScore: inferredScore,
        evidence: [],
      });
    } else {
      timeline.push({
        date: dateStr,
        jurisdiction: 'Unknown',
        country: 'Unknown',
        confidence: 'none',
        confidenceScore: 0,
        evidence: [],
      });
    }
  }

  return timeline;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function scoreToConfidence(score: number): Confidence {
  if (score >= 0.85) return 'high';
  if (score >= 0.5) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

export function getJurisdictionSummary(timeline: TimelineEntry[]) {
  const byCountry = new Map<string, { total: number; highConf: number }>();
  const byState = new Map<string, { total: number; highConf: number }>();

  for (const entry of timeline) {
    if (entry.jurisdiction === 'Unknown') continue;

    const effectiveJurisdiction = entry.overrides?.jurisdiction || entry.jurisdiction;
    const effectiveCountry = entry.overrides ? (effectiveJurisdiction.includes(', US') ? 'United States' : effectiveJurisdiction) : entry.country;

    // Country summary
    const cc = byCountry.get(effectiveCountry) || { total: 0, highConf: 0 };
    cc.total++;
    if (entry.confidence === 'high' || entry.overrides?.status === 'confirmed') cc.highConf++;
    byCountry.set(effectiveCountry, cc);

    // US State summary
    const stateMatch = effectiveJurisdiction.match(/^(.+), US$/);
    if (stateMatch) {
      const sc = byState.get(stateMatch[1]) || { total: 0, highConf: 0 };
      sc.total++;
      if (entry.confidence === 'high' || entry.overrides?.status === 'confirmed') sc.highConf++;
      byState.set(stateMatch[1], sc);
    }
  }

  const countries = Array.from(byCountry.entries())
    .map(([jurisdiction, { total, highConf }]) => ({ jurisdiction, days: total, highConfidenceDays: highConf }))
    .sort((a, b) => b.days - a.days);

  const states = Array.from(byState.entries())
    .map(([jurisdiction, { total, highConf }]) => ({ jurisdiction, days: total, highConfidenceDays: highConf }))
    .sort((a, b) => b.days - a.days);

  const usDays = byCountry.get('United States')?.total || 0;

  return { countries, states, usDays };
}
