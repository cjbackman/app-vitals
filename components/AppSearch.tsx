"use client";

import { useState } from "react";

export interface SearchParams {
  iosId: string;
  androidId: string;
}

interface AppSearchProps {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

export default function AppSearch({ onSearch, loading }: AppSearchProps) {
  const [iosId, setIosId] = useState("");
  const [androidId, setAndroidId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!iosId.trim() && !androidId.trim()) return;
    onSearch({ iosId: iosId.trim(), androidId: androidId.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="ios-id"
            className="block text-sm font-medium text-gray-700"
          >
            App Store ID
          </label>
          <input
            id="ios-id"
            type="text"
            value={iosId}
            onChange={(e) => setIosId(e.target.value)}
            placeholder="e.g. com.spotify.client"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="android-id"
            className="block text-sm font-medium text-gray-700"
          >
            Google Play Package
          </label>
          <input
            id="android-id"
            type="text"
            value={androidId}
            onChange={(e) => setAndroidId(e.target.value)}
            placeholder="e.g. com.spotify.music"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || (!iosId.trim() && !androidId.trim())}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Fetching…" : "Look up"}
      </button>
    </form>
  );
}
