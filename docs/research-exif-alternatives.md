# Research: Easier EXIF Extraction & Alternative Location Data Sources

## Problem Statement

Users with thousands of photos in a tax year face friction uploading them through the browser. We need:
1. Easier ways to extract EXIF data without browser upload
2. Alternative data sources that may be richer than photo GPS

---

## Existing Photo-to-EXIF Tools

### ExifTool CLI (Already Supported)
- **Status**: We already support ExifTool CSV import
- **Command**: `exiftool -csv -GPSLatitude -GPSLongitude -DateTimeOriginal -r /path/to/photos > locations.csv`
- **Limitation**: Requires photos on local disk — users must download from cloud first

### osxphotos (Python, macOS only)
- **What**: Queries Apple Photos SQLite database directly — no need to export image files
- **Install**: `pip install osxphotos`
- **Command**: `osxphotos query --json > all_photos.json` or `osxphotos export --report photos_report.csv /dev/null`
- **Output**: JSON with GPS coordinates, timestamps, album info, faces, etc.
- **Why it matters**: Apple Photos users (huge market) can extract GPS from their entire library in seconds without moving any files
- **Limitation**: macOS only, Python required

### Google Takeout (Photos)
- **What**: Export from `takeout.google.com` includes JSON sidecar files per photo with GPS + timestamps
- **Format**: Each photo gets a companion `.json` file with `geoData.latitude`, `geoData.longitude`, `photoTakenTime.timestamp`
- **Why it matters**: Google Photos users don't need to download actual photos — just the JSON metadata
- **Limitation**: Export can take hours/days for large libraries

### Mobile Apps (Metapho, Photo Investigator)
- **Verdict**: No bulk CSV/JSON export. Not useful for our use case.

---

## Alternative Location Data Sources

### 1. Google Maps Timeline / Location History (HIGH PRIORITY)

**Why this is the best alternative:**
- Tracks continuously (every few seconds to minutes) vs. photos (only when user takes a picture)
- Provides years of historical data if enabled
- Includes activity type (walking, driving, flying), place names, and addresses
- Single JSON file upload — much simpler UX than uploading thousands of photos

**Export method**: Google Takeout → select "Location History"

**Data format — Raw Records (`Records.json`)**:
```json
{
  "locations": [
    {
      "latitudeE7": 414216106,
      "longitudeE7": -720517700,
      "accuracy": 20,
      "activity": [{"type": "STILL", "confidence": 100}],
      "timestamp": "2023-10-15T14:30:00.000Z"
    }
  ]
}
```
- Coordinates in E7 format (divide by 10^7 for decimal degrees)

**Data format — Semantic Location History (`YYYY/YYYY_MONTH.json`)**:
```json
{
  "timelineObjects": [
    {
      "placeVisit": {
        "location": {
          "latitudeE7": 414216106,
          "longitudeE7": -720517700,
          "name": "Home",
          "address": "123 Main St, Springfield, IL"
        },
        "duration": {
          "startTimestamp": "2023-10-15T08:00:00Z",
          "endTimestamp": "2023-10-15T17:30:00Z"
        }
      }
    },
    {
      "activitySegment": {
        "startLocation": { "latitudeE7": 414216106, "longitudeE7": -720517700 },
        "endLocation": { "latitudeE7": 407127800, "longitudeE7": -740059700 },
        "activityType": "IN_VEHICLE",
        "duration": {
          "startTimestamp": "2023-10-15T17:30:00Z",
          "endTimestamp": "2023-10-15T19:00:00Z"
        }
      }
    }
  ]
}
```

**Critical caveat (2025-2026)**: Google migrated Timeline to on-device storage in mid-2025. Users who didn't export before the deadline may have lost cloud-stored historical data. New data is stored locally on the device, making future Takeout exports uncertain.

**Coverage by platform**:
- Android: Very comprehensive (background GPS + Wi-Fi + cell tower triangulation)
- iPhone: Less reliable (iOS restricts background location for third-party apps)

### 2. Fitness Tracker / GPS Sports Apps (MEDIUM PRIORITY)

**Strava**:
- Bulk export via account settings → ZIP of GPX/FIT files
- High-quality GPS tracks with second-level precision
- Only covers exercise activities

**Garmin Connect**:
- Export individual activities as GPX/TCX/FIT
- Very accurate GPS for recorded activities

**Apple Health**:
- "Export All Health Data" → XML with workout routes (GPS tracks)
- Only captures workout routes, not all-day location

**Parsing effort**: Low — GPX is a standard XML format with well-defined lat/lng/timestamp structure.

### 3. I-94 Travel Records (LOW EFFORT, HIGH VALUE)

- US entry/exit records available at `i94.cbp.dhs.gov`
- Provides exact dates of international border crossings
- Critical for Substantial Presence Test calculations
- Could be manually entered or parsed from PDF/screenshot

### 4. Airline Email / TripIt (MEDIUM PRIORITY)

- TripIt and similar services parse booking confirmation emails
- Provides flight dates and city pairs
- Historical data available if user forwarded emails
- City-level granularity (sufficient for jurisdiction detection)

### 5. Bank Transaction CSVs (LOW PRIORITY)

- Merchant names include city/state
- Online purchases pollute data (merchant HQ ≠ user location)
- Requires significant cleanup
- City-level at best

---

## Apple Users — Limited Options

Apple deliberately provides no location history export:
- "Significant Locations" is on-device only, no API, no export
- Apple data request (`privacy.apple.com`) excludes location data
- Find My data is transient

**Best options for iPhone users**:
1. `osxphotos` — extract photo GPS from Photos database (macOS required)
2. Enable Google Maps Location History on iPhone
3. Use Arc App (dedicated life-logger, subscription, excellent iOS support)
4. Photo EXIF extraction (our current approach)

---

## Implementation Recommendations

### Phase 1: Google Takeout Location History Parser (Highest Impact)
- Add a new import option: "Import Google Location History"
- Parse both `Records.json` (raw) and Semantic Location History (monthly) formats
- Convert E7 coordinates to decimal degrees
- Feed into existing timeline engine
- **UX**: Single file/folder upload, much simpler than thousands of photos

### Phase 2: osxphotos Integration Instructions
- Add instructions for macOS users to use `osxphotos` to generate a JSON/CSV
- Create a parser for osxphotos JSON format
- Eliminates need to export/upload actual photo files

### Phase 3: GPX File Support
- Parse standard GPX files from Strava, Garmin, etc.
- Low effort since GPX is a well-defined XML standard
- Supplements photo data with workout/activity GPS tracks

### Phase 4: Google Takeout Photos JSON Sidecar Parser
- Parse the `.json` sidecar files from Google Photos Takeout
- Alternative to uploading actual photos for Google Photos users

---

## Summary: Data Source Comparison

| Source | Coverage | Granularity | User Effort | Parse Effort |
|--------|----------|-------------|-------------|--------------|
| Photo EXIF (current) | Sporadic | Exact GPS point | High (upload) | Done |
| ExifTool CSV (current) | Sporadic | Exact GPS point | Medium (CLI) | Done |
| Google Location History | Continuous | Minute-level GPS | Low (Takeout) | Medium |
| osxphotos JSON | Sporadic | Exact GPS point | Low (one command) | Low |
| Strava/Garmin GPX | Exercise only | Second-level GPS | Low (export) | Low |
| Google Photos JSON | Sporadic | Exact GPS point | Low (Takeout) | Low |
| I-94 Records | Border crossings | Day-level | Low (website) | Low |
| Airline data | Flights only | City-level | Medium | High |
| Bank transactions | Daily purchases | City-level | Medium | Medium |

**Recommendation**: Prioritize Google Takeout Location History parser — it transforms the app from "upload thousands of photos" to "upload one JSON file" for the majority of Android users.
