'use client';

import { useState } from 'react';
import type { TimelineEntry } from '@/types';
import { exportCSV, exportTaxSummaryPDF, exportJSON } from '@/lib/export';

interface ExportPanelProps {
  timeline: TimelineEntry[];
  year: number;
}

export default function ExportPanel({ timeline, year }: ExportPanelProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: string, fn: () => Promise<void>) => {
    setExporting(type);
    try {
      await fn();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  if (timeline.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Export
      </h3>
      <div className="space-y-2">
        <button
          onClick={() => handleExport('csv', () => exportCSV(timeline, year))}
          disabled={!!exporting}
          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50"
        >
          <span>📊</span>
          <span className="flex-1 text-left">Full Timeline CSV</span>
          {exporting === 'csv' && <span className="text-xs text-blue-400">Exporting...</span>}
        </button>
        <button
          onClick={() => handleExport('pdf', () => exportTaxSummaryPDF(timeline, year))}
          disabled={!!exporting}
          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50"
        >
          <span>📄</span>
          <span className="flex-1 text-left">Tax Summary PDF</span>
          {exporting === 'pdf' && <span className="text-xs text-blue-400">Exporting...</span>}
        </button>
        <button
          onClick={() => handleExport('json', () => exportJSON(timeline))}
          disabled={!!exporting}
          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50"
        >
          <span>💾</span>
          <span className="flex-1 text-left">Backup (JSON)</span>
          {exporting === 'json' && <span className="text-xs text-blue-400">Exporting...</span>}
        </button>
      </div>
    </div>
  );
}
