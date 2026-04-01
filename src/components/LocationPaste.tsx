'use client';

import { useState, useCallback, useRef } from 'react';
import { parseTakeoutJSON } from '@/lib/takeout-parser';
import { buildTimeline } from '@/lib/timeline-engine';
import { timelineToText } from '@/lib/timeline-text';
import { saveTimeline, saveImportSession } from '@/lib/storage';
import type { TimelineEntry } from '@/types';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processInput = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setStep('processing');
    setError('');

    try {
      const records = parseTakeoutJSON(text);

      if (records.length === 0) {
        setError('No location data found in the pasted content. Make sure the JSON contains GPS coordinates.');
        setStep('input');
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

      // Also try other years if selected year has no data
      const hasDataForYear = timeline.some(e => e.jurisdiction !== 'Unknown');

      if (!hasDataForYear && yearCounts.size > 0) {
        // Find the year with the most data points
        const bestYear = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        const altTimeline = buildTimeline(records, bestYear[0]);
        const altText = timelineToText(altTimeline);

        setResultText(
          `No location data found for ${year}.\n\n` +
          `Your data contains ${records.length.toLocaleString()} location points spanning: ` +
          `${[...yearCounts.keys()].sort().join(', ')}.\n\n` +
          `Showing results for ${bestYear[0]} (${bestYear[1].toLocaleString()} points):\n\n` +
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
        return;
      }

      const text_output = timelineToText(timeline);
      setResultText(text_output);

      await saveTimeline(timeline);
      await saveImportSession({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        source: 'takeout-import',
        recordCount: records.length,
      });
      onImportComplete(timeline);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse location data.');
      setStep('input');
    }
  }, [year, onImportComplete]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Let the paste happen naturally, then process
    setTimeout(() => {
      const text = (e.target as HTMLTextAreaElement).value;
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        processInput(text);
      }
    }, 0);
  }, [processInput]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setError('Please drop a JSON file (from Google Takeout Location History).');
      return;
    }
    file.text().then(processInput);
  }, [processInput]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(processInput);
  }, [processInput]);

  const handleSubmit = useCallback(() => {
    processInput(inputText);
  }, [inputText, processInput]);

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
  }, []);

  if (step === 'processing') {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-300">Processing location data...</p>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
          Processed {recordCount.toLocaleString()} location points from Google Takeout
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
        <h2 className="text-lg font-semibold text-white">Paste your Google Location History</h2>
        <p className="text-sm text-gray-400">
          Go to{' '}
          <span className="text-blue-400 font-medium">Google Takeout</span>
          {' '}&rarr; export <span className="text-white">Location History</span>
          {' '}&rarr; open the JSON file &rarr; copy everything &rarr; paste below.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div
        onDrop={handleFileDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onPaste={handlePaste}
          placeholder='Paste your Google Takeout Location History JSON here, or drop the .json file onto this box...'
          className="w-full h-48 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!inputText.trim()}
          className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
        >
          Process Location Data
        </button>
        <span className="text-gray-600 text-sm">or</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Choose .json File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <details className="text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300 transition-colors">
          How to get your Google Location History
        </summary>
        <ol className="mt-3 space-y-2 text-gray-400 list-decimal list-inside">
          <li>
            Go to <span className="text-blue-400">takeout.google.com</span>
          </li>
          <li>Click &quot;Deselect all&quot;, then scroll to find <strong>Location History</strong> and check it</li>
          <li>Click &quot;Next step&quot; &rarr; &quot;Create export&quot;</li>
          <li>Wait for the email with your download link (can take minutes to hours)</li>
          <li>Download and unzip the archive</li>
          <li>
            Find <code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">Records.json</code> or the monthly files in{' '}
            <code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">Semantic Location History/</code>
          </li>
          <li>Open the JSON file in any text editor, select all (Ctrl+A / Cmd+A), copy, and paste above</li>
        </ol>
        <p className="mt-3 text-xs text-gray-600">
          Supported formats: Records.json, Semantic Location History (monthly JSONs), and the newer 2024+ format.
          All processing happens in your browser — nothing is uploaded.
        </p>
      </details>
    </div>
  );
}
