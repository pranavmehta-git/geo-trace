'use client';

import { useState } from 'react';
import type { TimelineEntry, DayOverride } from '@/types';
import { setDayOverride, removeDayOverride } from '@/lib/storage';

interface DayDetailProps {
  entry: TimelineEntry;
  onUpdate: () => void;
}

export default function DayDetail({ entry, onUpdate }: DayDetailProps) {
  const [editing, setEditing] = useState(false);
  const [overrideJurisdiction, setOverrideJurisdiction] = useState(entry.overrides?.jurisdiction || '');
  const [overrideNote, setOverrideNote] = useState(entry.overrides?.note || '');
  const [overrideStatus, setOverrideStatus] = useState<'confirmed' | 'disputed'>(
    entry.overrides?.status || 'confirmed'
  );

  const effectiveJurisdiction = entry.overrides?.jurisdiction || entry.jurisdiction;

  const handleSaveOverride = async () => {
    if (!overrideJurisdiction.trim()) return;
    const override: DayOverride = {
      jurisdiction: overrideJurisdiction.trim(),
      note: overrideNote.trim() || undefined,
      status: overrideStatus,
    };
    await setDayOverride(entry.date, override);
    setEditing(false);
    onUpdate();
  };

  const handleRemoveOverride = async () => {
    await removeDayOverride(entry.date);
    setEditing(false);
    setOverrideJurisdiction('');
    setOverrideNote('');
    onUpdate();
  };

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold">{formatDate(entry.date)}</h3>
          <p className="text-lg text-blue-400 font-medium mt-1">{effectiveJurisdiction}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            entry.confidence === 'high' ? 'bg-green-900 text-green-300' :
            entry.confidence === 'medium' ? 'bg-yellow-900 text-yellow-300' :
            entry.confidence === 'low' ? 'bg-orange-900 text-orange-300' :
            'bg-red-900 text-red-300'
          }`}>
            {entry.confidence} confidence
          </span>
          <p className="text-gray-500 text-xs mt-1">Score: {entry.confidenceScore.toFixed(2)}</p>
        </div>
      </div>

      {entry.overrides && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-medium">Manual Override</span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              entry.overrides.status === 'confirmed' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
            }`}>
              {entry.overrides.status}
            </span>
          </div>
          {entry.overrides.note && (
            <p className="text-yellow-200 mt-1">{entry.overrides.note}</p>
          )}
        </div>
      )}

      {/* Evidence */}
      <div>
        <h4 className="text-gray-400 text-sm font-medium mb-2">
          Evidence ({entry.evidence.length} {entry.evidence.length === 1 ? 'record' : 'records'})
        </h4>
        {entry.evidence.length > 0 ? (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {entry.evidence.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-700/50 rounded px-3 py-1.5">
                <span className="text-gray-500">{ev.source === 'photo' ? '📷' : ev.source === 'csv' ? '📄' : '✏️'}</span>
                <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">No direct evidence — inferred from continuity</p>
        )}
      </div>

      {/* Override controls */}
      {editing ? (
        <div className="space-y-3 border-t border-gray-700 pt-4">
          <div>
            <label className="text-sm text-gray-400">Jurisdiction</label>
            <input
              type="text"
              value={overrideJurisdiction}
              onChange={(e) => setOverrideJurisdiction(e.target.value)}
              placeholder="e.g., California, US or United Kingdom"
              className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Note (optional)</label>
            <input
              type="text"
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="e.g., I-94 entry, hotel receipt"
              className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Status</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setOverrideStatus('confirmed')}
                className={`px-3 py-1.5 rounded text-sm ${
                  overrideStatus === 'confirmed'
                    ? 'bg-green-700 text-green-100'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setOverrideStatus('disputed')}
                className={`px-3 py-1.5 rounded text-sm ${
                  overrideStatus === 'disputed'
                    ? 'bg-red-700 text-red-100'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Disputed
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveOverride}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save Override
            </button>
            {entry.overrides && (
              <button
                onClick={handleRemoveOverride}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Remove Override
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setOverrideJurisdiction(entry.overrides?.jurisdiction || entry.jurisdiction);
            setOverrideNote(entry.overrides?.note || '');
            setEditing(true);
          }}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {entry.overrides ? 'Edit Override' : 'Override This Day'}
        </button>
      )}
    </div>
  );
}
