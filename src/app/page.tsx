'use client';

import { useState, useEffect, useCallback } from 'react';
import Calendar from '@/components/Calendar';
import LocationPaste from '@/components/LocationPaste';
import FileUpload from '@/components/FileUpload';
import JurisdictionSummary from '@/components/JurisdictionSummary';
import DayDetail from '@/components/DayDetail';
import ExportPanel from '@/components/ExportPanel';
import ExifToolHelper from '@/components/ExifToolHelper';
import Settings from '@/components/Settings';
import type { TimelineEntry } from '@/types';
import { getTimeline, getAvailableYears } from '@/lib/storage';

export default function Home() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [showUpload, setShowUpload] = useState(true);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showExifTool, setShowExifTool] = useState(false);

  const loadTimeline = useCallback(async () => {
    const entries = await getTimeline(year);
    setTimeline(entries);
    const years = await getAvailableYears();
    if (years.length > 0) {
      setAvailableYears(years);
      setShowUpload(false);
    }
  }, [year]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const selectedEntry = selectedDate
    ? timeline.find(e => e.date === selectedDate) || null
    : null;

  const hasData = timeline.length > 0;

  // Generate year options (current year + 3 previous)
  const currentYear = new Date().getFullYear();
  const yearOptions = availableYears.length > 0
    ? [...new Set([...availableYears, currentYear])].sort((a, b) => b - a)
    : [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const handleImportComplete = (entries: TimelineEntry[]) => {
    setTimeline(entries);
    setShowUpload(false);
    setShowPhotoUpload(false);
    getAvailableYears().then(setAvailableYears);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">ResiDues</h1>
            <span className="text-xs text-gray-500 hidden sm:inline">
              Figure out where you were, without being tracked
            </span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => { setShowUpload(!showUpload); setShowPhotoUpload(false); setShowExifTool(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showUpload ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {hasData ? 'Add Data' : 'Import'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Privacy banner */}
        <div className="bg-green-900/20 border border-green-800/50 rounded-xl px-4 py-3 mb-6 text-sm text-green-300">
          <strong>Your data stays on your device.</strong> ResiDues processes everything
          entirely in your browser. Location coordinates are converted to jurisdiction names and immediately discarded.
        </div>

        {/* Import section */}
        {showUpload && (
          <div className="mb-6 space-y-4">
            {/* Primary: Google Takeout paste */}
            <LocationPaste
              year={year}
              onImportComplete={handleImportComplete}
            />

            {/* Secondary: Photo upload (collapsed by default) */}
            <div className="border-t border-gray-800 pt-4">
              <button
                onClick={() => { setShowPhotoUpload(!showPhotoUpload); setShowExifTool(false); }}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPhotoUpload ? 'Hide' : 'Or import from'} photos instead
              </button>

              {showPhotoUpload && (
                <div className="mt-4 space-y-4">
                  <FileUpload
                    year={year}
                    onImportComplete={handleImportComplete}
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowExifTool(!showExifTool)}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showExifTool ? 'Hide' : 'Show'} ExifTool instructions (power users)
                    </button>
                  </div>
                  {showExifTool && <ExifToolHelper />}
                </div>
              )}
            </div>
          </div>
        )}

        {hasData ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendar - main area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 12 }, (_, i) => (
                  <Calendar
                    key={i}
                    timeline={timeline}
                    year={year}
                    month={i}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />
                    <span>Manual override</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-amber-400 rounded-full" />
                    <span>Low confidence</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Opacity = confidence level</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-600 px-1">
                ResiDues is a reconstruction aid, not a legal or tax compliance tool. Inferred jurisdictions are based
                on location metadata and may be inaccurate. Verify all dates independently before submitting to tax
                authorities, immigration agencies, or employers.
              </p>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {selectedEntry && (
                <DayDetail entry={selectedEntry} onUpdate={loadTimeline} />
              )}
              <JurisdictionSummary timeline={timeline} year={year} />
              <ExportPanel timeline={timeline} year={year} />
              <Settings onDataCleared={() => {
                setTimeline([]);
                setAvailableYears([]);
                setSelectedDate(null);
                setShowUpload(true);
              }} />
            </div>
          </div>
        ) : !showUpload ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No data for {year}</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Import Data
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
