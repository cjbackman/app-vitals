import "server-only";
import type { Snapshot } from "@/types/app-data";
import { getDb } from "@/lib/db";

export function saveSnapshot(
  store: "ios" | "android",
  appId: string,
  score: number,
  reviewCount: number,
  minInstalls?: number
): Snapshot {
  const db = getDb();
  const savedAt = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(store, appId, savedAt, score, reviewCount, minInstalls ?? null);

  return {
    id: Number(result.lastInsertRowid),
    store,
    appId,
    savedAt,
    score,
    reviewCount,
    minInstalls,
  };
}

type SnapshotRow = {
  id: number;
  store: string;
  app_id: string;
  saved_at: string;
  score: number;
  review_count: number;
  min_installs: number | null;
};

export function getSnapshots(
  store: "ios" | "android",
  appId: string
): Snapshot[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, store, app_id, saved_at, score, review_count, min_installs FROM (SELECT id, store, app_id, saved_at, score, review_count, min_installs FROM snapshots WHERE store = ? AND app_id = ? ORDER BY saved_at DESC LIMIT 30) ORDER BY saved_at ASC"
    )
    .all(store, appId) as SnapshotRow[];

  return rows.map((row) => ({
    id: row.id,
    store: row.store as "ios" | "android",
    appId: row.app_id,
    savedAt: row.saved_at,
    score: row.score,
    reviewCount: row.review_count,
    ...(row.min_installs !== null ? { minInstalls: row.min_installs } : {}),
  }));
}
