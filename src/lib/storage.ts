import { openDB, type IDBPDatabase } from 'idb';
import type { TimelineEntry, ImportSession, UserPreferences, DayOverride } from '@/types';

const DB_NAME = 'residues_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('timeline_entries')) {
          db.createObjectStore('timeline_entries', { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains('import_sessions')) {
          db.createObjectStore('import_sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('user_preferences')) {
          db.createObjectStore('user_preferences', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('export_history')) {
          db.createObjectStore('export_history', { autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// Timeline entries
export async function saveTimeline(entries: TimelineEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('timeline_entries', 'readwrite');
  for (const entry of entries) {
    // Preserve existing overrides
    const existing = await tx.store.get(entry.date);
    if (existing?.overrides) {
      entry.overrides = existing.overrides;
    }
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function getTimeline(year: number): Promise<TimelineEntry[]> {
  const db = await getDB();
  const all = await db.getAll('timeline_entries');
  return all
    .filter((e: TimelineEntry) => e.date.startsWith(String(year)))
    .sort((a: TimelineEntry, b: TimelineEntry) => a.date.localeCompare(b.date));
}

export async function setDayOverride(date: string, override: DayOverride): Promise<void> {
  const db = await getDB();
  const entry = await db.get('timeline_entries', date);
  if (entry) {
    entry.overrides = override;
    await db.put('timeline_entries', entry);
  }
}

export async function removeDayOverride(date: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get('timeline_entries', date);
  if (entry) {
    delete entry.overrides;
    await db.put('timeline_entries', entry);
  }
}

// Import sessions
export async function saveImportSession(session: ImportSession): Promise<void> {
  const db = await getDB();
  await db.put('import_sessions', session);
}

export async function getImportSessions(): Promise<ImportSession[]> {
  const db = await getDB();
  return db.getAll('import_sessions');
}

// User preferences
export async function getPreference<K extends keyof UserPreferences>(key: K): Promise<UserPreferences[K] | undefined> {
  const db = await getDB();
  const result = await db.get('user_preferences', key);
  return result?.value;
}

export async function setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): Promise<void> {
  const db = await getDB();
  await db.put('user_preferences', { key, value });
}

// Export history
export async function logExport(type: string): Promise<void> {
  const db = await getDB();
  await db.add('export_history', { timestamp: new Date(), type });
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['timeline_entries', 'import_sessions', 'user_preferences', 'export_history'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('timeline_entries').clear(),
    tx.objectStore('import_sessions').clear(),
    tx.objectStore('user_preferences').clear(),
    tx.objectStore('export_history').clear(),
    tx.done,
  ]);
}

export async function getAvailableYears(): Promise<number[]> {
  const db = await getDB();
  const all = await db.getAll('timeline_entries');
  const years = new Set(all.map((e: TimelineEntry) => parseInt(e.date.substring(0, 4))));
  return Array.from(years).sort((a, b) => b - a);
}
