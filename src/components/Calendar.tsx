'use client';

import { useMemo } from 'react';
import type { TimelineEntry } from '@/types';
import { getJurisdictionColor, getConfidenceOpacity } from '@/lib/jurisdiction-colors';

interface CalendarProps {
  timeline: TimelineEntry[];
  year: number;
  month: number; // 0-11
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ timeline, year, month, selectedDate, onSelectDate }: CalendarProps) {
  const entryMap = useMemo(() => {
    const map = new Map<string, TimelineEntry>();
    for (const e of timeline) {
      map.set(e.date, e);
    }
    return map;
  }, [timeline]);

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-3">
        {MONTH_NAMES[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">
            {d}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entry = entryMap.get(dateStr);
          const jurisdiction = entry?.overrides?.jurisdiction || entry?.jurisdiction;
          const color = jurisdiction ? getJurisdictionColor(jurisdiction) : '#374151';
          const opacity = entry ? getConfidenceOpacity(entry.confidence) : 0.2;
          const isSelected = dateStr === selectedDate;
          const isOverridden = !!entry?.overrides;
          const isLowConfidence = entry?.confidence === 'low' || entry?.confidence === 'none';

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`aspect-square rounded-lg text-xs font-medium relative transition-all ${
                isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: color,
                opacity,
              }}
              title={jurisdiction || 'No data'}
            >
              <span className="text-white drop-shadow-sm">{day}</span>
              {isOverridden && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
              )}
              {isLowConfidence && !isOverridden && entry?.jurisdiction !== 'Unknown' && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
