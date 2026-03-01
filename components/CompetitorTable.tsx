"use client";

import { useEffect, useState } from "react";
import type { PresetApp } from "@/components/PresetApps";
import type { AppData, ApiError, Snapshot } from "@/types/app-data";
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

interface SnapshotDelta {
  scoreDelta: number;
  reviewDelta: number;
}

interface CompetitorRow {
  preset: PresetApp;
  data: AppData | ApiError | null; // null = loading or fetch failed
  delta: SnapshotDelta | null;
}

function computeSnapshotDelta(snapshots: Snapshot[]): SnapshotDelta | null {
  if (snapshots.length < 2) return null;
  const curr = snapshots.at(-1)!;
  const prev = snapshots.at(-2)!;
  return {
    scoreDelta: curr.score - prev.score,
    reviewDelta: curr.reviewCount - prev.reviewCount,
  };
}

function reviewRatio(competitor: number, leading: number): string {
  if (leading === 0) return "—";
  const ratio = competitor / leading;
  if (ratio >= 10) return `×${Math.round(ratio)}`;
  if (ratio >= 1) return `×${ratio.toFixed(1)}`;
  return `×${ratio.toFixed(2)}`;
}

function deltaColor(delta: number): string {
  if (delta > 0) return "text-green-600";
  if (delta < 0) return "text-red-400";
  return "text-gray-400";
}

export default function CompetitorTable({
  store,
  leadingPreset,
  leadingData,
  competitors,
}: CompetitorTableProps) {
  const [rows, setRows] = useState<CompetitorRow[]>(() =>
    competitors.map((preset) => ({ preset, data: null, delta: null }))
  );
  const [leadingDelta, setLeadingDelta] = useState<SnapshotDelta | null>(null);

  // storeIdKey selects the correct preset ID field for this store (used in render and effect).
  const storeIdKey = store === "ios" ? "iosId" : "androidId";

  useEffect(() => {
    setRows(competitors.map((preset) => ({ preset, data: null, delta: null })));
    setLeadingDelta(null);

    const controller = new AbortController();
    // Abort after 10 s, matching SearchPage's timeout.
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const apiRoute = store === "ios" ? "ios" : "android";

    const fetchSnaps = (appId: string): Promise<Snapshot[]> =>
      fetch(`/api/snapshots?store=${store}&appId=${encodeURIComponent(appId)}`, {
        signal: controller.signal,
      }).then((r) => (r.ok ? (r.json() as Promise<Snapshot[]>) : Promise.resolve([])));

    // App-data fetches: one per competitor.
    const dataFetches = competitors.map((preset) =>
      fetch(`/api/${apiRoute}?appId=${encodeURIComponent(preset[storeIdKey])}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<AppData | ApiError>) : Promise.reject(r)))
        .then((d) => ({ preset, data: d }))
    );

    // Leading snapshot fetched independently; competitor snapshots are 1:1 with dataFetches
    // so snapshotResults[i] aligns with dataResults[i] — no index offset needed.
    const leadingSnapshotFetch = fetchSnaps(leadingPreset[storeIdKey]);
    const snapshotFetches = competitors.map((preset) => fetchSnaps(preset[storeIdKey]));

    Promise.all([
      Promise.allSettled(dataFetches),
      Promise.allSettled(snapshotFetches),
      leadingSnapshotFetch.then(computeSnapshotDelta).catch(() => null),
    ])
      .then(([dataResults, snapshotResults, newLeadingDelta]) => {
        if (controller.signal.aborted) return;
        clearTimeout(timeoutId);
        setLeadingDelta(newLeadingDelta);
        setRows(
          dataResults.map((result, i) => {
            const data =
              result.status === "fulfilled" ? result.value.data : null;
            const snaps =
              snapshotResults[i]?.status === "fulfilled" ? snapshotResults[i].value : [];
            return { preset: competitors[i]!, data, delta: computeSnapshotDelta(snaps) };
          })
        );
      })
      .catch(() => {
        // Promise.allSettled cannot reject; this path is unreachable under normal conditions.
        if (!controller.signal.aborted) {
          setRows(competitors.map((preset) => ({ preset, data: null, delta: null })));
        }
      });

    // competitors and leadingPreset are intentionally omitted from deps: SearchPage remounts
    // this component via a store+preset key prop when the selected preset changes, so each
    // mount has stable values for its lifetime.
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
            <th className="text-right font-normal text-gray-300 pb-1.5 pl-1">Δ</th>
            <th className="text-right font-normal text-gray-300 pb-1.5 pl-1">vs you</th>
            <th className="text-right font-normal text-gray-400 pb-1.5 pl-3">Reviews</th>
            <th className="text-right font-normal text-gray-300 pb-1.5 pl-1">Δ</th>
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
            <td
              className={`py-1.5 text-right tabular-nums pl-1 ${
                leadingDelta
                  ? deltaColor(leadingDelta.scoreDelta)
                  : "text-gray-300"
              }`}
            >
              {leadingDelta
                ? formatDelta(leadingDelta.scoreDelta, (n) => n.toFixed(2))
                : "—"}
            </td>
            <td className="py-1.5 text-right text-gray-300 tabular-nums pl-1">—</td>
            <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums pl-3">
              {leadingData ? formatCount(leadingData.reviewCount) : "—"}
            </td>
            <td
              className={`py-1.5 text-right tabular-nums pl-1 ${
                leadingDelta
                  ? deltaColor(leadingDelta.reviewDelta)
                  : "text-gray-300"
              }`}
            >
              {leadingDelta
                ? formatDelta(leadingDelta.reviewDelta, formatCount)
                : "—"}
            </td>
            <td className="py-1.5 text-right text-gray-300 tabular-nums pl-1">—</td>
          </tr>

          {/* Competitor rows */}
          {rows.map(({ preset, data, delta }) => {
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
                    delta ? deltaColor(delta.scoreDelta) : "text-gray-300"
                  }`}
                >
                  {delta
                    ? formatDelta(delta.scoreDelta, (n) => n.toFixed(2))
                    : "—"}
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
                    delta ? deltaColor(delta.reviewDelta) : "text-gray-300"
                  }`}
                >
                  {delta
                    ? formatDelta(delta.reviewDelta, formatCount)
                    : "—"}
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
