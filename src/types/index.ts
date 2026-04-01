export interface PhotoRecord {
  timestamp: Date;
  lat: number;
  lng: number;
}

export interface Evidence {
  timestamp: Date;
  source: 'photo' | 'csv' | 'manual';
  note?: string;
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface TimelineEntry {
  date: string; // YYYY-MM-DD
  jurisdiction: string;
  country: string;
  state?: string; // US state if applicable
  confidence: Confidence;
  confidenceScore: number;
  evidence: Evidence[];
  overrides?: DayOverride;
}

export interface DayOverride {
  jurisdiction: string;
  note?: string;
  status: 'confirmed' | 'disputed';
}

export interface ImportSession {
  id: string;
  timestamp: Date;
  source: 'photo-upload' | 'csv-import';
  recordCount: number;
}

export interface UserPreferences {
  defaultYear: number;
  displayMode: 'calendar' | 'list';
  jurisdictionFilter?: string;
}

export interface JurisdictionSummary {
  jurisdiction: string;
  days: number;
  highConfidenceDays: number;
}
