'use client';

import { useMemo } from 'react';
import type { TimelineEntry } from '@/types';
import { getJurisdictionSummary } from '@/lib/timeline-engine';
import { getJurisdictionColor } from '@/lib/jurisdiction-colors';

interface JurisdictionSummaryProps {
  timeline: TimelineEntry[];
  year: number;
}

export default function JurisdictionSummary({ timeline, year }: JurisdictionSummaryProps) {
  const summary = useMemo(() => getJurisdictionSummary(timeline), [timeline]);

  return (
    <div className="space-y-6">
      {/* Substantial Presence Test */}
      {summary.usDays > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Substantial Presence Test
          </h3>
          <div className="text-3xl font-bold text-white">{summary.usDays}</div>
          <div className="text-sm text-gray-400 mt-1">days in the US ({year})</div>
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  summary.usDays >= 183 ? 'bg-red-500' : summary.usDays >= 150 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (summary.usDays / 183) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span className={summary.usDays >= 183 ? 'text-red-400 font-medium' : ''}>183 threshold</span>
            </div>
          </div>
          {summary.usDays >= 183 ? (
            <p className="text-red-400 text-sm mt-2 font-medium">Threshold met</p>
          ) : (
            <p className="text-gray-400 text-sm mt-2">{183 - summary.usDays} days remaining</p>
          )}
        </div>
      )}

      {/* Countries */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Days by Country
        </h3>
        {summary.countries.length > 0 ? (
          <div className="space-y-2">
            {summary.countries.map(c => (
              <div key={c.jurisdiction} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getJurisdictionColor(c.jurisdiction) }}
                />
                <span className="text-gray-200 text-sm flex-1">{c.jurisdiction}</span>
                <span className="text-white font-medium text-sm">{c.days}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">No data yet</p>
        )}
      </div>

      {/* US States */}
      {summary.states.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Days by US State
          </h3>
          <div className="space-y-2">
            {summary.states.map(s => (
              <div key={s.jurisdiction} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getJurisdictionColor(`${s.jurisdiction}, US`) }}
                />
                <span className="text-gray-200 text-sm flex-1">{s.jurisdiction}</span>
                <span className="text-white font-medium text-sm">{s.days}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
