import "server-only";
import type { Snapshot } from "@/types/app-data";
import { getDb } from "@/lib/db";

export async function saveSnapshot(
  store: "ios" | "android",
  appId: string,
  opts: {
    score: number;
    reviewCount: number;
    version?: string | null;
    minInstalls?: number;
  },
): Promise<Snapshot> {
  const db = await getDb();
  const savedAt = new Date().toISOString();
  const version = opts.version ?? null;
  const result = await db.execute({
    sql: "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [store, appId, savedAt, opts.score, opts.reviewCount, opts.minInstalls ?? null, version],
  });
  return {
    id: Number(result.lastInsertRowid ?? 0),
    store,
    appId,
    savedAt,
    score: opts.score,
    reviewCount: opts.reviewCount,
    minInstalls: opts.minInstalls,
    version,
    isRelease: false,
  };
}

export async function getSnapshots(
  store: "ios" | "android",
  appId: string,
): Promise<Snapshot[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id, store, app_id, saved_at, score, review_count, min_installs, version
          FROM (SELECT id, store, app_id, saved_at, score, review_count, min_installs, version
                FROM snapshots WHERE store = ? AND app_id = ?
                ORDER BY saved_at DESC LIMIT 30)
          ORDER BY saved_at ASC`,
    args: [store, appId],
  });

  const rows = result.rows.map((r) => ({
    id: Number(r.id),
    store: r.store as "ios" | "android",
    appId: r.app_id as string,
    savedAt: r.saved_at as string,
    score: Number(r.score),
    reviewCount: Number(r.review_count),
    minInstalls: r.min_installs != null ? Number(r.min_installs) : undefined,
    version: r.version != null ? String(r.version) : null,
  }));

  // isRelease: true when both current and previous version are non-null and differ.
  // Guards against NULL-poisoning: "6.3.1" !== null is true so both must be checked.
  return rows.map((snap, i) => ({
    ...snap,
    isRelease:
      i > 0 &&
      snap.version !== null &&
      rows[i - 1]!.version !== null &&
      snap.version !== rows[i - 1]!.version,
  }));
}
