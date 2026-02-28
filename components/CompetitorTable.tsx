"use client";

import { useEffect, useState } from "react";
import type { PresetApp } from "@/components/PresetApps";
import type { AppData, ApiError } from "@/types/app-data";
import { isApiError } from "@/types/app-data";
import { formatCount, formatDelta } from "@/lib/format";

interface CompetitorTableProps {
  store: "ios" | "android";
  /** The preset currently selected as the leading app. */
  leadingPreset: PresetApp;
  /**
   * Current live data for the leading app (null while loading or on error).
   * Note: leadingData (from SearchPage's fetch) and rows (fetched internally)
   * may resolve at different times. The "vs you" columns show — whenever
   * either value is null, preventing a stale comparison from being displayed.
   */
  leadingData: AppData | null;
  /** Competitor presets to show in the table. */
  competitors: PresetApp[];
}

interface CompetitorRow {
  preset: PresetApp;
  data: AppData | ApiError | null; // null = loading or fetch failed
}

function reviewRatio(competitor: number, leading: number): string {
  if (leading === 0) return "—";
  const ratio = competitor / leading;
  if (ratio >= 10) return `×${Math.round(ratio)}`;
  if (ratio >= 1) return `×${ratio.toFixed(1)}`;
  return `×${ratio.toFixed(2)}`;
}

export default function CompetitorTable({
  store,
  leadingPreset,
  leadingData,
  competitors,
}: CompetitorTableProps) {
  const [rows, setRows] = useState<CompetitorRow[]>(() =>
    competitors.map((preset) => ({ preset, data: null }))
  );

  // storeIdKey selects the correct preset ID field for this store (used in render and effect).
  const storeIdKey = store === "ios" ? "iosId" : "androidId";

  useEffect(() => {
    setRows(competitors.map((preset) => ({ preset, data: null })));

    const controller = new AbortController();
    // Abort after 15 s to match the server's maxDuration safety net.
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const apiRoute = store === "ios" ? "ios" : "android";
    const idKey = store === "ios" ? "iosId" : "androidId";

    Promise.allSettled(
      competitors.map((preset) =>
        fetch(`/api/${apiRoute}?appId=${encodeURIComponent(preset[idKey])}`, {
          signal: controller.signal,
        })
          .then((r) => (r.ok ? (r.json() as Promise<AppData | ApiError>) : Promise.reject(r)))
          .then((d) => ({ preset, data: d }))
      )
    ).then((results) => {
      if (controller.signal.aborted) return;
      setRows(
        results.map((result, i) =>
          result.status === "fulfilled"
            ? result.value
            : { preset: competitors[i]!, data: null }
        )
      );
    });

    // competitors is intentionally omitted from deps: SearchPage remounts this component via
    // a store+preset key prop when the selected preset changes, so each mount has a stable
    // competitors value for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [store]);

  const storeLabel = store === "ios" ? "App Store" : "Google Play";

  return (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-2">{storeLabel}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left font-normal text-gray-400 pb-1.5" />
            <th className="text-right font-normal text-gray-400 pb-1.5">Rating</th>
            <th className="text-right font-normal text-gray-300 pb-1.5 pl-1">vs you</th>
            <th className="text-right font-normal text-gray-400 pb-1.5 pl-3">Reviews</th>
            <th className="text-right font-normal text-gray-300 pb-1.5 pl-1">vs you</th>
          </tr>
        </thead>
        <tbody>
          {/* Leading app — "you" row */}
          <tr className="border-b border-gray-50">
            <td
              className="py-1.5 font-medium"
              style={{ color: leadingPreset.brandColor ?? "#6366f1" }}
            >
              {leadingPreset.name}
            </td>
            <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums">
              {leadingData ? leadingData.score.toFixed(1) : "—"}
            </td>
            <td className="py-1.5 text-right text-gray-300 tabular-nums pl-1">—</td>
            <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums pl-3">
              {leadingData ? formatCount(leadingData.reviewCount) : "—"}
            </td>
            <td className="py-1.5 text-right text-gray-300 tabular-nums pl-1">—</td>
          </tr>

          {/* Competitor rows */}
          {rows.map(({ preset, data }) => {
            const appData = data !== null && !isApiError(data) ? data : null;
            const score = appData?.score ?? null;
            const reviewCount = appData?.reviewCount ?? null;
            const leadingScore = leadingData?.score ?? null;
            const leadingReviews = leadingData?.reviewCount ?? null;

            const ratingDeltaStr =
              score !== null && leadingScore !== null
                ? formatDelta(score - leadingScore, (n) => n.toFixed(1))
                : "—";
            const ratioStr =
              reviewCount !== null && leadingReviews !== null
                ? reviewRatio(reviewCount, leadingReviews)
                : "—";

            // "vs you" color: green = competitor is behind (good for you),
            // red = competitor is ahead (bad for you).
            const ratingAhead =
              score !== null && leadingScore !== null && score > leadingScore;
            const reviewAhead =
              reviewCount !== null && leadingReviews !== null && reviewCount > leadingReviews;

            return (
              <tr key={preset[storeIdKey]} className="border-b border-gray-50 last:border-0">
                <td
                  className="py-1.5"
                  style={{ color: preset.brandColor ?? "#6b7280" }}
                >
                  {preset.name}
                </td>
                <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums">
                  {score !== null ? score.toFixed(1) : "—"}
                </td>
                <td
                  className={`py-1.5 text-right tabular-nums pl-1 ${
                    ratingDeltaStr === "—"
                      ? "text-gray-300"
                      : ratingAhead
                      ? "text-red-400"
                      : "text-green-600"
                  }`}
                >
                  {ratingDeltaStr}
                </td>
                <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums pl-3">
                  {reviewCount !== null ? formatCount(reviewCount) : "—"}
                </td>
                <td
                  className={`py-1.5 text-right tabular-nums pl-1 ${
                    ratioStr === "—"
                      ? "text-gray-300"
                      : reviewAhead
                      ? "text-red-400"
                      : "text-green-600"
                  }`}
                >
                  {ratioStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
