import type { PhotoRecord } from '@/types';

/**
 * Parse Google Takeout data (Location History or Photos sidecar JSONs).
 *
 * Supports:
 * 1. Records.json — raw location points with E7 coordinates
 * 2. Semantic Location History — monthly JSONs with placeVisit/activitySegment
 * 3. Newer (2024+) semanticSegments format
 * 4. Google Photos sidecar JSONs — per-photo metadata with geoData + photoTakenTime
 * 5. Array of any of the above (merged sidecar files)
 */
export function parseTakeoutJSON(text: string): PhotoRecord[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Try to recover concatenated JSON objects (multiple sidecars pasted together)
    const recovered = recoverConcatenatedJSON(text);
    if (recovered.length > 0) {
      return parsePhotoSidecars(recovered);
    }
    throw new Error('Invalid JSON. Make sure you copied the entire file contents.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected format. Expected a JSON object.');
  }

  // Array — could be merged sidecar files, location records, or semantic objects
  if (Array.isArray(data)) {
    const arr = data as Record<string, unknown>[];
    if (arr.length === 0) {
      throw new Error('Empty array. No data to process.');
    }

    // Detect type from first non-empty element
    const sample = arr.find(x => x && typeof x === 'object') as Record<string, unknown> | undefined;
    if (!sample) {
      throw new Error('No valid objects found in array.');
    }

    if ('latitudeE7' in sample) {
      return parseRecordsJSON(arr);
    }
    if ('placeVisit' in sample || 'activitySegment' in sample) {
      return parseSemanticJSON(arr);
    }
    // Google Photos sidecar array (has photoTakenTime or geoData)
    if ('photoTakenTime' in sample || 'geoData' in sample || 'geoDataExif' in sample) {
      return parsePhotoSidecars(arr);
    }
  }

  const obj = data as Record<string, unknown>;

  // Single Google Photos sidecar JSON
  if ('photoTakenTime' in obj || ('geoData' in obj && 'title' in obj)) {
    return parsePhotoSidecars([obj]);
  }

  // Records.json — { "locations": [...] }
  if (Array.isArray(obj.locations)) {
    return parseRecordsJSON(obj.locations);
  }

  // Semantic Location History — { "timelineObjects": [...] }
  if (Array.isArray(obj.timelineObjects)) {
    return parseSemanticJSON(obj.timelineObjects);
  }

  // Newer Semantic format — { "semanticSegments": [...] }
  if (Array.isArray(obj.semanticSegments)) {
    return parseSemanticSegments(obj.semanticSegments);
  }

  throw new Error(
    'Unrecognized format. Supported: Google Photos Takeout JSON sidecars, ' +
    'Location History Records.json, or Semantic Location History.'
  );
}

/**
 * Parse multiple Google Photos sidecar JSON files read from a folder.
 * Each file's text content is parsed individually.
 */
export function parsePhotoSidecarFiles(fileTexts: string[]): PhotoRecord[] {
  const allObjects: Record<string, unknown>[] = [];

  for (const text of fileTexts) {
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        allObjects.push(data as Record<string, unknown>);
      }
    } catch {
      // Skip unparseable files (metadata.json, etc.)
      continue;
    }
  }

  return parsePhotoSidecars(allObjects);
}

/**
 * Parse Google Photos sidecar JSON objects.
 *
 * Each sidecar has:
 *   photoTakenTime.timestamp (string, unix seconds)
 *   geoData.latitude / geoData.longitude (floats, 0.0 if missing)
 *   geoDataExif.latitude / geoDataExif.longitude (fallback)
 */
function parsePhotoSidecars(objects: Record<string, unknown>[]): PhotoRecord[] {
  const records: PhotoRecord[] = [];

  for (const obj of objects) {
    // Get timestamp — prefer photoTakenTime over creationTime
    const photoTime = obj.photoTakenTime as Record<string, unknown> | undefined;
    const creationTime = obj.creationTime as Record<string, unknown> | undefined;
    const timeObj = photoTime || creationTime;

    if (!timeObj) continue;

    const tsStr = timeObj.timestamp as string | undefined;
    if (!tsStr) continue;

    const tsSec = parseInt(tsStr, 10);
    if (isNaN(tsSec)) continue;

    const timestamp = new Date(tsSec * 1000);
    if (isNaN(timestamp.getTime())) continue;

    // Get GPS — prefer geoData (user-corrected) over geoDataExif (raw EXIF)
    const geoData = obj.geoData as Record<string, unknown> | undefined;
    const geoDataExif = obj.geoDataExif as Record<string, unknown> | undefined;

    let lat = 0;
    let lng = 0;

    if (geoData) {
      lat = geoData.latitude as number || 0;
      lng = geoData.longitude as number || 0;
    }

    // Fall back to EXIF geo if primary is zeroed
    if (lat === 0 && lng === 0 && geoDataExif) {
      lat = geoDataExif.latitude as number || 0;
      lng = geoDataExif.longitude as number || 0;
    }

    // Skip photos with no GPS
    if (lat === 0 && lng === 0) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    records.push({ timestamp, lat, lng });
  }

  return records;
}

/**
 * Try to recover concatenated JSON objects (e.g., user pasted multiple
 * sidecar files back to back without wrapping in an array).
 */
function recoverConcatenatedJSON(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const obj = JSON.parse(text.substring(start, i + 1));
          if (obj && typeof obj === 'object') {
            results.push(obj as Record<string, unknown>);
          }
        } catch {
          // skip malformed chunk
        }
        start = -1;
      }
    }
  }

  return results;
}

/**
 * Parse Records.json format.
 * Each entry has latitudeE7, longitudeE7, and a timestamp.
 */
function parseRecordsJSON(locations: unknown[]): PhotoRecord[] {
  const records: PhotoRecord[] = [];

  for (const loc of locations) {
    if (!loc || typeof loc !== 'object') continue;
    const l = loc as Record<string, unknown>;

    const latE7 = l.latitudeE7 as number | undefined;
    const lngE7 = l.longitudeE7 as number | undefined;
    const ts = (l.timestamp ?? l.timestampMs) as string | number | undefined;

    if (latE7 == null || lngE7 == null || ts == null) continue;

    const lat = latE7 / 1e7;
    const lng = lngE7 / 1e7;

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    let timestamp: Date;
    if (typeof ts === 'string') {
      // ISO string or milliseconds as string
      timestamp = ts.includes('T') ? new Date(ts) : new Date(parseInt(ts));
    } else {
      // Numeric — could be ms or seconds
      timestamp = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
    }

    if (isNaN(timestamp.getTime())) continue;

    records.push({ timestamp, lat, lng });
  }

  return records;
}

/**
 * Parse Semantic Location History format (timelineObjects array).
 * Each object is either a placeVisit or activitySegment.
 */
function parseSemanticJSON(objects: unknown[]): PhotoRecord[] {
  const records: PhotoRecord[] = [];

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    const o = obj as Record<string, unknown>;

    // placeVisit — a stay at a specific location
    if (o.placeVisit && typeof o.placeVisit === 'object') {
      const visit = o.placeVisit as Record<string, unknown>;
      const location = visit.location as Record<string, unknown> | undefined;
      const duration = visit.duration as Record<string, unknown> | undefined;

      if (location && duration) {
        const latE7 = location.latitudeE7 as number | undefined;
        const lngE7 = location.longitudeE7 as number | undefined;
        const startTs = duration.startTimestamp as string | undefined;

        if (latE7 != null && lngE7 != null && startTs) {
          const lat = latE7 / 1e7;
          const lng = lngE7 / 1e7;
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const timestamp = new Date(startTs);
            if (!isNaN(timestamp.getTime())) {
              records.push({ timestamp, lat, lng });
            }
          }
        }
      }
    }

    // activitySegment — travel between locations
    if (o.activitySegment && typeof o.activitySegment === 'object') {
      const seg = o.activitySegment as Record<string, unknown>;
      const startLoc = seg.startLocation as Record<string, unknown> | undefined;
      const endLoc = seg.endLocation as Record<string, unknown> | undefined;
      const duration = seg.duration as Record<string, unknown> | undefined;

      if (startLoc && duration) {
        const latE7 = startLoc.latitudeE7 as number | undefined;
        const lngE7 = startLoc.longitudeE7 as number | undefined;
        const startTs = duration.startTimestamp as string | undefined;

        if (latE7 != null && lngE7 != null && startTs) {
          const lat = latE7 / 1e7;
          const lng = lngE7 / 1e7;
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const timestamp = new Date(startTs);
            if (!isNaN(timestamp.getTime())) {
              records.push({ timestamp, lat, lng });
            }
          }
        }
      }

      // Also capture end location with end timestamp
      if (endLoc && duration) {
        const latE7 = endLoc.latitudeE7 as number | undefined;
        const lngE7 = endLoc.longitudeE7 as number | undefined;
        const endTs = duration.endTimestamp as string | undefined;

        if (latE7 != null && lngE7 != null && endTs) {
          const lat = latE7 / 1e7;
          const lng = lngE7 / 1e7;
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const timestamp = new Date(endTs);
            if (!isNaN(timestamp.getTime())) {
              records.push({ timestamp, lat, lng });
            }
          }
        }
      }
    }
  }

  return records;
}

/**
 * Parse newer (2024+) Semantic Segments format.
 * { "semanticSegments": [{ "visit": { ... }, "timelinePath": [...] }] }
 */
function parseSemanticSegments(segments: unknown[]): PhotoRecord[] {
  const records: PhotoRecord[] = [];

  for (const seg of segments) {
    if (!seg || typeof seg !== 'object') continue;
    const s = seg as Record<string, unknown>;

    const startTime = s.startTime as string | undefined;
    const endTime = s.endTime as string | undefined;

    // Visit at a location
    if (s.visit && typeof s.visit === 'object') {
      const visit = s.visit as Record<string, unknown>;
      const topCandidate = (visit.topCandidate as Record<string, unknown>) ?? null;
      const placeLocation = topCandidate?.placeLocation as Record<string, unknown> | undefined;

      if (placeLocation && startTime) {
        const latLng = placeLocation.latLng as string | undefined;
        if (latLng) {
          const parsed = parseLatLngString(latLng);
          if (parsed) {
            const timestamp = new Date(startTime);
            if (!isNaN(timestamp.getTime())) {
              records.push({ timestamp, lat: parsed.lat, lng: parsed.lng });
            }
          }
        }
      }
    }

    // Timeline path points
    if (Array.isArray(s.timelinePath)) {
      for (const point of s.timelinePath) {
        if (!point || typeof point !== 'object') continue;
        const p = point as Record<string, unknown>;
        const latLng = p.point as string | undefined;
        const pointTime = p.time as string | undefined;

        if (latLng && (pointTime || startTime)) {
          const parsed = parseLatLngString(latLng);
          if (parsed) {
            const timestamp = new Date((pointTime || startTime)!);
            if (!isNaN(timestamp.getTime())) {
              records.push({ timestamp, lat: parsed.lat, lng: parsed.lng });
            }
          }
        }
      }
    }
  }

  return records;
}

/**
 * Parse "geo:lat,lng" or "lat,lng" string format used in newer Takeout exports.
 */
function parseLatLngString(s: string): { lat: number; lng: number } | null {
  const cleaned = s.replace(/^geo:/, '').trim();
  const parts = cleaned.split(',');
  if (parts.length < 2) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}
