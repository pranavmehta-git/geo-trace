'use client';

import { useState } from 'react';

type OS = 'macos' | 'windows' | 'linux';

export default function ExifToolHelper() {
  const [os, setOs] = useState<OS>('macos');
  const [copied, setCopied] = useState(false);

  const commands: Record<OS, { install: string; extract: string; recursive: string }> = {
    macos: {
      install: 'brew install exiftool',
      extract: 'exiftool -csv -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal ~/Photos > residues_export.csv',
      recursive: 'exiftool -csv -r -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal ~/Pictures > residues_export.csv',
    },
    windows: {
      install: 'choco install exiftool',
      extract: 'exiftool -csv -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal %USERPROFILE%\\Pictures > residues_export.csv',
      recursive: 'exiftool -csv -r -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal %USERPROFILE%\\Pictures > residues_export.csv',
    },
    linux: {
      install: 'sudo apt install libimage-exiftool-perl',
      extract: 'exiftool -csv -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal ~/Pictures > residues_export.csv',
      recursive: 'exiftool -csv -r -GPSLatitude -GPSLongitude -DateTimeOriginal -OffsetTimeOriginal ~/Pictures > residues_export.csv',
    },
  };

  const cmd = commands[os];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <h3 className="text-white font-semibold">ExifTool Command Generator</h3>
      <p className="text-gray-400 text-sm">
        For large photo libraries (5,000+ photos), use ExifTool to extract metadata locally, then upload only the CSV. No photos leave your device.
      </p>

      <div className="flex gap-2">
        {(['macos', 'windows', 'linux'] as const).map(o => (
          <button
            key={o}
            onClick={() => setOs(o)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              os === o ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {o === 'macos' ? 'macOS' : o === 'windows' ? 'Windows' : 'Linux'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">1. Install ExifTool</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 bg-gray-900 text-green-400 px-3 py-2 rounded text-sm font-mono overflow-x-auto">
              {cmd.install}
            </code>
            <button
              onClick={() => copyToClipboard(cmd.install)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors flex-shrink-0"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">2. Extract metadata</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 bg-gray-900 text-green-400 px-3 py-2 rounded text-sm font-mono overflow-x-auto">
              {cmd.extract}
            </code>
            <button
              onClick={() => copyToClipboard(cmd.extract)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors flex-shrink-0"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Recursive (all subfolders)</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 bg-gray-900 text-green-400 px-3 py-2 rounded text-sm font-mono overflow-x-auto">
              {cmd.recursive}
            </code>
            <button
              onClick={() => copyToClipboard(cmd.recursive)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors flex-shrink-0"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-gray-500 text-xs">
        Then upload the generated CSV file using the &quot;Import ExifTool CSV&quot; option above.
      </p>
    </div>
  );
}
