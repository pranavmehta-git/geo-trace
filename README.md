# ResiDues

**Figure out where you were, without being tracked.**

ResiDues is a privacy-first forensic timeline builder for taxes, visas, and residency compliance. It reconstructs your location history from photo metadata — entirely in your browser.

## What it does

- Upload photos or an ExifTool CSV — EXIF GPS + timestamp data is extracted client-side
- Coordinates are geocoded to country/US state using a bundled offline dataset
- A day-by-day timeline is built with confidence scoring
- View your year on a color-coded calendar
- Track substantial presence test days (183-day threshold)
- Override any day manually with notes
- Export as CSV, PDF tax summary, or JSON backup

## Privacy

- **No server-side processing** — all computation happens in your browser
- **No photo uploads** — only EXIF headers are read, pixel data is never loaded
- **No analytics or telemetry** — zero tracking SDKs
- **GPS coordinates are discarded** after geocoding to jurisdiction names
- **Data stored locally** in IndexedDB — nothing leaves your device
- **Delete everything** with one click

## Development

```bash
npm install
npm run dev
```

## Deploy on Railway

This app includes a Dockerfile optimized for Railway deployment. Connect your repo and Railway will auto-detect and build it.

The app runs as a standalone Next.js server on port 3000.
