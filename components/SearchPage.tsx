"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppSearch, { type SearchParams } from "@/components/AppSearch";
import AppPicker from "@/components/AppPicker";
import AppCard from "@/components/AppCard";
import { PRESET_APPS, type PresetApp } from "@/components/PresetApps";
import type { AppData, ApiError } from "@/types/app-data";

interface Results {
  ios: AppData | ApiError | null;
  android: AppData | ApiError | null;
}

// PRESET_APPS always has at least one entry; update this line if removing presets.
const DEFAULT = PRESET_APPS[0]!;

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

  async function handleSearch({ iosId, androidId }: SearchParams) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResults(null);

    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const fetches = await Promise.allSettled([
        iosId
          ? fetch(`/api/ios?appId=${encodeURIComponent(iosId)}`, {
              signal: controller.signal,
            }).then((r) => r.json() as Promise<AppData | ApiError>)
          : Promise.resolve(null),
        androidId
          ? fetch(`/api/android?appId=${encodeURIComponent(androidId)}`, {
              signal: controller.signal,
            }).then((r) => r.json() as Promise<AppData | ApiError>)
          : Promise.resolve(null),
      ]);

      // Ignore results if this request was superseded by a newer one.
      if (controller.signal.aborted) return;

      setResults({
        ios:
          fetches[0].status === "fulfilled"
            ? fetches[0].value
            : ({ error: "Request failed", code: "SCRAPER_ERROR" } as ApiError),
        android:
          fetches[1].status === "fulfilled"
            ? fetches[1].value
            : ({ error: "Request failed", code: "SCRAPER_ERROR" } as ApiError),
      });
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

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Link href="/import" className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
          Import history →
        </Link>
      </div>
      <div className="space-y-3">
        <AppPicker selectedPreset={selectedPreset} onSelect={handleSelect} />
        <AppSearch
          iosId={iosId}
          androidId={androidId}
          onIosIdChange={setIosId}
          onAndroidIdChange={setAndroidId}
          onSearch={handleSearch}
          loading={loading}
        />
      </div>

      {showResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AppCard
            store="ios"
            data={results?.ios ?? null}
            loading={loading}
            appId={iosId}
          />
          <AppCard
            store="android"
            data={results?.android ?? null}
            loading={loading}
            appId={androidId}
          />
        </div>
      )}
    </div>
  );
}
