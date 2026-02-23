import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { APP_ID_PATTERN, MAX_APP_ID_LENGTH } from "@/lib/make-store-handler";

const MAX_ROWS = 1000;

export function normalizeSavedAt(value: string): string | null {
  // Full ISO 8601 with time component — validate and normalise to UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Date-only: always append explicit UTC midnight to avoid TZ ambiguity.
  // Round-trip check rejects overflowed calendar dates (e.g. "2025-02-29" → null).
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const d = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return d.toISOString();
  }
  return null;
}

type ValidatedRow = {
  store: string;
  appId: string;
  savedAt: string;
  score: number;
  reviewCount: number;
  minInstalls: number | null;
};

export async function POST(request: NextRequest) {
  // Content-Length guard — reject clearly oversized bodies before buffering.
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return NextResponse.json(
      { error: "Request body too large (max 1 MB)", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Body must be an object", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.rows)) {
    return NextResponse.json(
      { error: "rows must be an array", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  if (b.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `rows must not exceed ${MAX_ROWS}`, code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  // Validate all rows up-front — reject the whole request if any row is invalid.
  // Collect pre-normalized rows so the insert loop doesn't re-derive values.
  const validatedRows: ValidatedRow[] = [];
  const rawRows = b.rows as unknown[];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (typeof row !== "object" || row === null) {
      return NextResponse.json(
        { error: `row ${i + 1}: must be an object`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    const r = row as Record<string, unknown>;

    if (r.store !== "ios" && r.store !== "android") {
      return NextResponse.json(
        { error: `row ${i + 1}: store must be "ios" or "android"`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    if (
      typeof r.appId !== "string" ||
      r.appId.length === 0 ||
      r.appId.length > MAX_APP_ID_LENGTH ||
      !APP_ID_PATTERN.test(r.appId)
    ) {
      return NextResponse.json(
        { error: `row ${i + 1}: invalid appId`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    const savedAt = typeof r.savedAt === "string" ? normalizeSavedAt(r.savedAt) : null;
    if (savedAt === null) {
      return NextResponse.json(
        { error: `row ${i + 1}: invalid savedAt`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    if (
      typeof r.score !== "number" ||
      !Number.isFinite(r.score) ||
      r.score < 0 ||
      r.score > 5
    ) {
      return NextResponse.json(
        { error: `row ${i + 1}: score must be a number 0–5`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    if (
      typeof r.reviewCount !== "number" ||
      !Number.isFinite(r.reviewCount) ||
      r.reviewCount < 0
    ) {
      return NextResponse.json(
        { error: `row ${i + 1}: reviewCount must be a non-negative number`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    if (
      r.minInstalls !== undefined &&
      (typeof r.minInstalls !== "number" ||
        !Number.isFinite(r.minInstalls) ||
        r.minInstalls < 0)
    ) {
      return NextResponse.json(
        { error: `row ${i + 1}: minInstalls must be a non-negative number`, code: "INVALID_SNAPSHOT_PARAMS" },
        { status: 400 }
      );
    }
    validatedRows.push({
      store: r.store,
      appId: r.appId as string,
      savedAt,
      score: r.score as number,
      reviewCount: r.reviewCount as number,
      minInstalls: (r.minInstalls as number | undefined) ?? null,
    });
  }

  try {
    const db = getDb();

    // Deduplication depends on the UNIQUE INDEX. If getDb() couldn't create it
    // (e.g., dev DB has pre-existing duplicate rows), surface a clear error.
    const g = global as typeof global & { _dbDedupDisabled?: boolean };
    if (g._dbDedupDisabled) {
      return NextResponse.json(
        {
          error:
            "Deduplication index is unavailable — import disabled. " +
            "See server logs for cleanup instructions.",
          code: "IMPORT_ERROR",
        },
        { status: 503 }
      );
    }

    const stmt = db.prepare(
      "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const importAll = db.transaction((rows: ValidatedRow[]) => {
      let inserted = 0;
      let skipped = 0;
      for (const row of rows) {
        const result = stmt.run(
          row.store,
          row.appId,
          row.savedAt,
          row.score,
          row.reviewCount,
          row.minInstalls
        );
        result.changes === 1 ? inserted++ : skipped++;
      }
      return { inserted, skipped };
    });

    return NextResponse.json(importAll(validatedRows));
  } catch {
    return NextResponse.json(
      { error: "Failed to import snapshots", code: "IMPORT_ERROR" },
      { status: 500 }
    );
  }
}
