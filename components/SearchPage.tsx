"use client";

import { useEffect, useRef, useState } from "react";
import AppPicker from "@/components/AppPicker";
import AppCard from "@/components/AppCard";
import CompetitorTable from "@/components/CompetitorTable";
import { PRESET_APPS, type PresetApp } from "@/components/PresetApps";
import type { AppData, ApiError } from "@/types/app-data";
import { isApiError } from "@/types/app-data";

interface Results {
  ios: AppData | ApiError | null;
  android: AppData | ApiError | null;
}

// PRESET_APPS always has at least one entry; update this line if removing presets.
const DEFAULT = PRESET_APPS[0]!;

const SCRAPER_ERROR: ApiError = { error: "Request failed", code: "SCRAPER_ERROR" };

export default function SearchPage() {
  const [iosId, setIosId] = useState(DEFAULT.iosId);
  const [androidId, setAndroidId] = useState(DEFAULT.androidId);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  // Abort any in-flight request when a new search starts.
  const abortRef = useRef<AbortController | null>(null);

  // Derive active preset — no need to store it separately.
  const selectedPreset: PresetApp | null =
    PRESET_APPS.find((p) => p.iosId === iosId && p.androidId === androidId) ?? null;

  async function handleSearch({ iosId, androidId }: { iosId: string; androidId: string }) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResults(null);

    async function fetchPair(pIosId: string, pAndroidId: string): Promise<Results> {
      const [ios, android] = await Promise.allSettled([
        fetch(`/api/ios?appId=${encodeURIComponent(pIosId)}`, { signal: controller.signal })
          .then((r) => r.json() as Promise<AppData | ApiError>),
        fetch(`/api/android?appId=${encodeURIComponent(pAndroidId)}`, { signal: controller.signal })
          .then((r) => r.json() as Promise<AppData | ApiError>),
      ]);
      return {
        ios: ios.status === "fulfilled" ? ios.value : SCRAPER_ERROR,
        android: android.status === "fulfilled" ? android.value : SCRAPER_ERROR,
      };
    }

    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const data = await fetchPair(iosId, androidId);

      // Ignore results if this request was superseded by a newer one.
      if (controller.signal.aborted) return;

      setResults(data);
    } finally {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function handleSelect(preset: PresetApp) {
    setIosId(preset.iosId);
    setAndroidId(preset.androidId);
    // Pass IDs as explicit arguments — state setters above are async and haven't flushed yet.
    handleSearch({ iosId: preset.iosId, androidId: preset.androidId });
  }

  useEffect(() => {
    // Auto-search the default preset on mount.
    // handleSearch is omitted from deps intentionally: it only reads its arguments (never
    // component state), so the mounted closure is safe for the lifetime of this effect.
    handleSearch({ iosId: DEFAULT.iosId, androidId: DEFAULT.androidId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showResults = loading || results !== null;

  // Derive clean AppData for the leading app (null when loading or errored).
  const leadingIos =
    results?.ios && !isApiError(results.ios) ? results.ios : null;
  const leadingAndroid =
    results?.android && !isApiError(results.android) ? results.android : null;

  const competitors = selectedPreset
    ? PRESET_APPS.filter((p) => p !== selectedPreset)
    : [];

  return (
    <div className="space-y-8">
      <AppPicker selectedPreset={selectedPreset} onSelect={handleSelect} />

      {showResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AppCard
            store="ios"
            data={results?.ios ?? null}
            loading={loading}
            appId={iosId}
            brandColor={selectedPreset?.brandColor}
          />
          <AppCard
            store="android"
            data={results?.android ?? null}
            loading={loading}
            appId={androidId}
            brandColor={selectedPreset?.brandColor}
          />
        </div>
      )}

      {selectedPreset !== null && competitors.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500">Comparison</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <CompetitorTable
              key={`ios-${selectedPreset.iosId}`}
              store="ios"
              leadingPreset={selectedPreset}
              leadingData={leadingIos}
              competitors={competitors}
            />
            <CompetitorTable
              key={`android-${selectedPreset.androidId}`}
              store="android"
              leadingPreset={selectedPreset}
              leadingData={leadingAndroid}
              competitors={competitors}
            />
          </div>
        </div>
      )}
    </div>
  );
}
