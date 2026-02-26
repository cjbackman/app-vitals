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

interface CompetitorResult {
  preset: PresetApp;
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
  const [competitorResults, setCompetitorResults] = useState<CompetitorResult[]>([]);

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
    setCompetitorResults([]);

    // Re-derives from function args rather than selectedPreset — state may not have flushed yet
    // when called from handleSelect. If a user manually types IDs that match a preset, competitors
    // will still appear — intentional (simpler than tracking how the search was triggered).
    const leadingPreset =
      PRESET_APPS.find((p) => p.iosId === iosId && p.androidId === androidId) ?? null;
    const competitors = leadingPreset
      ? PRESET_APPS.filter((p) => p !== leadingPreset)
      : [];

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
      // allSettled at the outer level: a single unexpected fetchPair rejection won't wipe
      // all other results. Each competitor carries its preset inline to avoid index arithmetic.
      const [leadingSettled, ...competitorSettled] = await Promise.allSettled([
        fetchPair(iosId, androidId),
        ...competitors.map(async (p): Promise<CompetitorResult> => ({
          preset: p,
          ...(await fetchPair(p.iosId, p.androidId)),
        })),
      ]);

      // Ignore results if this request was superseded by a newer one.
      if (controller.signal.aborted) return;

      setResults(
        leadingSettled.status === "fulfilled"
          ? leadingSettled.value
          : { ios: SCRAPER_ERROR, android: SCRAPER_ERROR }
      );
      setCompetitorResults(
        competitorSettled.map((settled, i) =>
          settled.status === "fulfilled"
            ? settled.value
            : { preset: competitors[i]!, ios: SCRAPER_ERROR, android: SCRAPER_ERROR }
        )
      );
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

      {/* Competitors — no loading prop: they resolve alongside the leading app */}
      {competitorResults.map(({ preset, ios, android }) => (
        <div key={preset.iosId} data-testid="competitor-section" className="space-y-3">
          <p className="text-sm font-medium text-gray-500">{preset.name}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppCard store="ios" data={ios} appId={preset.iosId} brandColor={preset.brandColor} />
            <AppCard store="android" data={android} appId={preset.androidId} brandColor={preset.brandColor} />
          </div>
        </div>
      ))}
    </div>
  );
}
