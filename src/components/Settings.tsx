'use client';

import { useState } from 'react';
import { clearAllData } from '@/lib/storage';

interface SettingsProps {
  onDataCleared: () => void;
}

export default function Settings({ onDataCleared }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClear = async () => {
    await clearAllData();
    setConfirming(false);
    setCleared(true);
    onDataCleared();
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Data Management
      </h3>
      {cleared ? (
        <div className="text-green-400 text-sm font-medium py-2">
          All data has been deleted.
        </div>
      ) : confirming ? (
        <div className="space-y-3">
          <p className="text-red-300 text-sm">
            This will permanently delete all your timeline data, overrides, and preferences from this device. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Yes, Delete Everything
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="w-full px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg text-sm font-medium transition-colors border border-red-800"
        >
          Delete All My Data
        </button>
      )}
    </div>
  );
}
