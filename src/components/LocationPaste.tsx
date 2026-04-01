'use client';

import { useState, useCallback, useRef } from 'react';
import { parseTakeoutJSON, parsePhotoSidecarFiles } from '@/lib/takeout-parser';
import { buildTimeline } from '@/lib/timeline-engine';
import { timelineToText } from '@/lib/timeline-text';
import { saveTimeline, saveImportSession } from '@/lib/storage';
import type { PhotoRecord, TimelineEntry } from '@/types';

interface LocationPasteProps {
  year: number;
  onImportComplete: (entries: TimelineEntry[]) => void;
}

type Step = 'input' | 'processing' | 'result';

export default function LocationPaste({ year, onImportComplete }: LocationPasteProps) {
  const [step, setStep] = useState<Step>('input');
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [progress, setProgress] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const finishProcessing = useCallback(async (records: PhotoRecord[]) => {
    if (records.length === 0) {
      setError('No location data found. Make sure the files contain GPS coordinates (photos without location data are skipped).');
      setStep('input');
      setProgress('');
      return;
    }

    setRecordCount(records.length);

    // Detect which years are present
    const yearCounts = new Map<number, number>();
    for (const r of records) {
      const y = r.timestamp.getFullYear();
      yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
    }

    // Build timeline for the selected year
    const timeline = buildTimeline(records, year);
    const hasDataForYear = timeline.some(e => e.jurisdiction !== 'Unknown');

    if (!hasDataForYear && yearCounts.size > 0) {
      const bestYear = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const altTimeline = buildTimeline(records, bestYear[0]);
      const altText = timelineToText(altTimeline);

      setResultText(
        `No location data found for ${year}.\n\n` +
        `Your data contains ${records.length.toLocaleString()} geotagged photos spanning: ` +
        `${[...yearCounts.keys()].sort().join(', ')}.\n\n` +
        `Showing results for ${bestYear[0]} (${bestYear[1].toLocaleString()} photos):\n\n` +
        altText
      );

      await saveTimeline(altTimeline);
      await saveImportSession({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'takeout-import',
        recordCount: records.length,
      });
      onImportComplete(altTimeline);
      setStep('result');
      setProgress('');
      return;
    }

    const textOutput = timelineToText(timeline);
    setResultText(textOutput);

    await saveTimeline(timeline);
    await saveImportSession({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      source: 'takeout-import',
      recordCount: records.length,
    });
    onImportComplete(timeline);
    setStep('result');
    setProgress('');
  }, [year, onImportComplete]);

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setStep('processing');
    setError('');
    setProgress('Parsing JSON...');

    try {
      const records = parseTakeoutJSON(text);
      await finishProcessing(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse location data.');
      setStep('input');
      setProgress('');
    }
  }, [finishProcessing]);

  const processFiles = useCallback(async (files: File[]) => {
    const jsonFiles = files.filter(f => f.name.endsWith('.json') && f.name !== 'metadata.json');

    if (jsonFiles.length === 0) {
      setError('No JSON files found. Select the Google Photos Takeout folder containing .json sidecar files.');
      return;
    }

    setStep('processing');
    setError('');

    try {
      // Process in batches to avoid blocking
      const BATCH = 200;
      const allTexts: string[] = [];

      for (let i = 0; i < jsonFiles.length; i += BATCH) {
        const batch = jsonFiles.slice(i, i + BATCH);
        setProgress(`Reading files ${i + 1}–${Math.min(i + BATCH, jsonFiles.length)} of ${jsonFiles.length}...`);
        const texts = await Promise.all(batch.map(f => f.text()));
        allTexts.push(...texts);
      }

      setProgress(`Processing ${allTexts.length} JSON files...`);

      // If there's only one file, try the general parser (could be Records.json etc.)
      if (allTexts.length === 1) {
        try {
          const records = parseTakeoutJSON(allTexts[0]);
          await finishProcessing(records);
          return;
        } catch {
          // Fall through to sidecar parsing
        }
      }

      const records = parsePhotoSidecarFiles(allTexts);
      await finishProcessing(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files.');
      setStep('input');
      setProgress('');
    }
  }, [finishProcessing]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    setTimeout(() => {
      const text = (e.target as HTMLTextAreaElement).value;
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        processText(text);
      }
    }, 0);
  }, [processText]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (files.length === 1 && files[0].name.endsWith('.json')) {
      files[0].text().then(processText);
    } else {
      processFiles(files);
    }
  }, [processText, processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length === 1) {
      files[0].text().then(processText);
    } else {
      processFiles(files);
    }
  }, [processText, processFiles]);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, [processFiles]);

  const handleSubmit = useCallback(() => {
    processText(inputText);
  }, [inputText, processText]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [resultText]);

  const handleStartOver = useCallback(() => {
    setStep('input');
    setInputText('');
    setResultText('');
    setError('');
    setRecordCount(0);
    setProgress('');
  }, []);

  if (step === 'processing') {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-300">{progress || 'Processing location data...'}</p>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-white">
            Here&apos;s where you were
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleStartOver}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              New Import
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Processed {recordCount.toLocaleString()} geotagged photos from Google Takeout
        </div>

        <pre className="bg-gray-900 border border-gray-700 rounded-xl p-5 text-sm text-gray-200 font-mono whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto leading-relaxed">
          {resultText}
        </pre>
      </div>
    );
  }

  // Input step
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Import your Google Photos location data</h2>
        <p className="text-sm text-gray-400">
          Export your photos from{' '}
          <span className="text-blue-400 font-medium">Google Takeout</span>
          , then select the folder below. Each photo has a small .json file with its GPS location
          {' '}&mdash; we read those, not the photos themselves.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Primary action: folder select */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => folderInputRef.current?.click()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          Select Takeout Folder
        </button>
        <input
          ref={folderInputRef}
          type="file"
          /* @ts-expect-error webkitdirectory is non-standard but widely supported */
          webkitdirectory=""
          onChange={handleFolderSelect}
          className="hidden"
        />

        <span className="text-gray-600 text-sm">or</span>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Select .json Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Secondary: paste area */}
      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300 transition-colors">
          Or paste JSON directly
        </summary>
        <div className="mt-3 space-y-3">
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              placeholder='Paste Google Photos Takeout JSON here, or drop .json files onto this box...'
              className="w-full h-36 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
            >
              Process
            </button>
          </div>

          <div className="bg-gray-800/50 rounded-lg px-4 py-3 text-xs text-gray-500 space-y-1">
            <p className="text-gray-400">To merge all sidecar JSONs into one pasteable file, run:</p>
            <code className="block bg-gray-900 rounded px-3 py-2 text-gray-300 select-all">
              {'find "Takeout/Google Photos" -name "*.json" ! -name "metadata.json" -exec cat {} + | python3 -c "import sys,json; data=sys.stdin.read(); objs=[]; s=0; d=0\\nfor i,c in enumerate(data):\\n if c==\\"{\\": \\n  if d==0: s=i\\n  d+=1\\n elif c==\\"}\\": \\n  d-=1\\n  if d==0:\\n   try: objs.append(json.loads(data[s:i+1]))\\n   except: pass\\nprint(json.dumps(objs))" > photos.json'}
            </code>
            <p>Then paste or upload <code className="text-gray-300">photos.json</code>.</p>
          </div>
        </div>
      </details>

      {/* How-to instructions */}
      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300 transition-colors">
          How to get your Google Photos Takeout
        </summary>
        <ol className="mt-3 space-y-2 text-gray-400 list-decimal list-inside">
          <li>
            Go to <span className="text-blue-400">takeout.google.com</span>
          </li>
          <li>Click &quot;Deselect all&quot;, then check <strong>Google Photos</strong></li>
          <li>Click &quot;Next step&quot; &rarr; choose <strong>.zip</strong> format &rarr; &quot;Create export&quot;</li>
          <li>Wait for the email (can take hours for large libraries)</li>
          <li>Download and unzip the archive</li>
          <li>
            Click <strong>&quot;Select Takeout Folder&quot;</strong> above and choose the{' '}
            <code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">Takeout</code> folder
          </li>
        </ol>
        <p className="mt-3 text-xs text-gray-600">
          We only read the small .json sidecar files (a few KB each), not your actual photos.
          Each .json contains GPS coordinates and the date the photo was taken.
          All processing happens in your browser — nothing leaves your device.
        </p>
      </details>
    </div>
  );
}
