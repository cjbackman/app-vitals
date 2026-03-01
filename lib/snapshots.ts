import "server-only";
import type { Snapshot } from "@/types/app-data";
import { getDb } from "@/lib/db";

export async function saveSnapshot(
  store: "ios" | "android",
  appId: string,
  score: number,
  reviewCount: number,
  minInstalls?: number,
): Promise<Snapshot> {
  const db = await getDb();
  const savedAt = new Date().toISOString();
  const result = await db.execute({
    sql: "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)",
    args: [store, appId, savedAt, score, reviewCount, minInstalls ?? null],
  });
  return {
    id: Number(result.lastInsertRowid ?? 0),
    store,
    appId,
    savedAt,
    score,
    reviewCount,
    minInstalls,
  };
}

export async function getSnapshots(
  store: "ios" | "android",
  appId: string,
): Promise<Snapshot[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id, store, app_id, saved_at, score, review_count, min_installs
          FROM (SELECT id, store, app_id, saved_at, score, review_count, min_installs
                FROM snapshots WHERE store = ? AND app_id = ?
                ORDER BY saved_at DESC LIMIT 30)
          ORDER BY saved_at ASC`,
    args: [store, appId],
  });
  return result.rows.map((r) => ({
    id: Number(r.id),
    store: r.store as "ios" | "android",
    appId: r.app_id as string,
    savedAt: r.saved_at as string,
    score: Number(r.score),
    reviewCount: Number(r.review_count),
    minInstalls: r.min_installs != null ? Number(r.min_installs) : undefined,
  }));
}
