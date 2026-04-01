import type { PhotoRecord } from '@/types';

/**
 * Parse EXIF data from photo files using exifr.
 * Only extracts GPS + timestamp. Never loads pixel data.
 */
export async function parsePhotos(files: File[]): Promise<PhotoRecord[]> {
  const exifr = await import('exifr');
  const records: PhotoRecord[] = [];

  for (const file of files) {
    try {
      const data = await exifr.parse(file, {
        pick: ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal', 'OffsetTimeOriginal', 'CreateDate'],
        tiff: true,
        exif: true,
        gps: true,
      } as Parameters<typeof exifr.parse>[1]);

      if (!data) continue;

      const lat = data.GPSLatitude ?? data.latitude;
      const lng = data.GPSLongitude ?? data.longitude;
      const timestamp = data.DateTimeOriginal || data.CreateDate;

      if (lat != null && lng != null && timestamp) {
        records.push({
          timestamp: new Date(timestamp),
          lat: typeof lat === 'number' ? lat : parseFloat(lat),
          lng: typeof lng === 'number' ? lng : parseFloat(lng),
        });
      }
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  return records;
}

/**
 * Parse an ExifTool CSV export.
 * Expected columns: SourceFile, GPSLatitude, GPSLongitude, DateTimeOriginal
 */
export function parseExifToolCSV(csvText: string): PhotoRecord[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const latIdx = header.findIndex(h => /gpslatitude/i.test(h));
  const lngIdx = header.findIndex(h => /gpslongitude/i.test(h));
  const dateIdx = header.findIndex(h => /datetimeoriginal/i.test(h));

  if (latIdx === -1 || lngIdx === -1 || dateIdx === -1) return [];

  const records: PhotoRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const lat = parseGPSCoord(cols[latIdx]);
    const lng = parseGPSCoord(cols[lngIdx]);
    const timestamp = cols[dateIdx] ? new Date(cols[dateIdx].replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')) : null;

    if (lat != null && lng != null && timestamp && !isNaN(timestamp.getTime())) {
      records.push({ timestamp, lat, lng });
    }
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseGPSCoord(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (!isNaN(num)) return num;

  // Handle DMS format: 40 deg 44' 54.36" N
  const dms = value.match(/([\d.]+)\s*(?:deg|°)\s*([\d.]+)\s*['"]\s*([\d.]+)\s*['""]?\s*([NSEW])?/i);
  if (dms) {
    let result = parseFloat(dms[1]) + parseFloat(dms[2]) / 60 + parseFloat(dms[3]) / 3600;
    if (dms[4] && (dms[4] === 'S' || dms[4] === 'W')) result = -result;
    return result;
  }

  return null;
}
