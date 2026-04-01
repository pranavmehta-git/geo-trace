import type { TimelineEntry } from '@/types';

interface DateRange {
  jurisdiction: string;
  startDate: string;
  endDate: string;
  days: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Collapse a day-by-day timeline into contiguous date ranges per jurisdiction,
 * then format as human-readable text.
 */
export function timelineToText(entries: TimelineEntry[]): string {
  if (entries.length === 0) return 'No location data found for this period.';

  const ranges = collapseRanges(entries);
  const year = entries[0].date.substring(0, 4);

  const lines: string[] = [];
  lines.push(`Location Timeline — ${year}`);
  lines.push('='.repeat(40));
  lines.push('');

  for (const range of ranges) {
    const start = formatShortDate(range.startDate);
    const end = formatShortDate(range.endDate);
    const dateStr = range.days === 1 ? start : `${start} – ${end}`;
    const dayLabel = range.days === 1 ? '1 day' : `${range.days} days`;
    const conf = range.confidence === 'none' ? '' : ` [${range.confidence}]`;
    lines.push(`${dateStr}  ${range.jurisdiction}  (${dayLabel})${conf}`);
  }

  lines.push('');
  lines.push('-'.repeat(40));

  // Summary totals
  const summary = summarize(ranges);
  lines.push('');
  lines.push('Summary');
  lines.push('');

  for (const [jurisdiction, days] of summary) {
    lines.push(`  ${jurisdiction}: ${days} day${days === 1 ? '' : 's'}`);
  }

  const totalKnown = ranges
    .filter(r => r.jurisdiction !== 'Unknown')
    .reduce((sum, r) => sum + r.days, 0);
  const totalUnknown = ranges
    .filter(r => r.jurisdiction === 'Unknown')
    .reduce((sum, r) => sum + r.days, 0);

  lines.push('');
  lines.push(`Total days with location data: ${totalKnown}`);
  if (totalUnknown > 0) {
    lines.push(`Days with no data: ${totalUnknown}`);
  }

  // US presence check
  const usDays = Array.from(summarize(ranges).entries())
    .filter(([j]) => j.includes(', US') || j === 'United States')
    .reduce((sum, [, d]) => sum + d, 0);

  if (usDays > 0) {
    lines.push('');
    lines.push(`US presence: ${usDays} day${usDays === 1 ? '' : 's'} (threshold for Substantial Presence Test: 183)`);
  }

  return lines.join('\n');
}

function collapseRanges(entries: TimelineEntry[]): DateRange[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const ranges: DateRange[] = [];

  let current: DateRange | null = null;

  for (const entry of sorted) {
    const jurisdiction = entry.overrides?.jurisdiction || entry.jurisdiction;

    if (current && current.jurisdiction === jurisdiction) {
      current.endDate = entry.date;
      current.days++;
      // Downgrade confidence if any day in range is lower
      current.confidence = worstConfidence(current.confidence, entry.confidence);
    } else {
      if (current) ranges.push(current);
      current = {
        jurisdiction,
        startDate: entry.date,
        endDate: entry.date,
        days: 1,
        confidence: entry.confidence,
      };
    }
  }

  if (current) ranges.push(current);
  return ranges;
}

function worstConfidence(
  a: 'high' | 'medium' | 'low' | 'none',
  b: 'high' | 'medium' | 'low' | 'none'
): 'high' | 'medium' | 'low' | 'none' {
  const order = { none: 0, low: 1, medium: 2, high: 3 };
  return order[a] <= order[b] ? a : b;
}

function summarize(ranges: DateRange[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of ranges) {
    if (r.jurisdiction === 'Unknown') continue;
    map.set(r.jurisdiction, (map.get(r.jurisdiction) || 0) + r.days);
  }
  // Sort by days descending
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}`;
}
