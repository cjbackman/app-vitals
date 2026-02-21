"use client";

import { useState } from "react";
import AppSearch, { type SearchParams } from "@/components/AppSearch";
import AppCard from "@/components/AppCard";
import type { AppData, ApiError } from "@/types/app-data";

interface Results {
  ios: AppData | ApiError | null;
  android: AppData | ApiError | null;
}

export default function SearchPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  async function handleSearch({ iosId, androidId }: SearchParams) {
    setLoading(true);
    setResults(null);

    const controller = new AbortController();
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
      setLoading(false);
    }
  }

  const showResults = loading || results !== null;

  return (
    <div className="space-y-8">
      <AppSearch onSearch={handleSearch} loading={loading} />

      {showResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AppCard store="ios" data={results?.ios ?? null} loading={loading} />
          <AppCard
            store="android"
            data={results?.android ?? null}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
