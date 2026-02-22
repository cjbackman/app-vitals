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
  // new Date("2025-08-01") is technically UTC per spec but ambiguous in practice;
  // new Date("2025-08-01T00:00:00.000Z") is always UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export async function POST(request: NextRequest) {
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
  const rows = b.rows as unknown[];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
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
    if (typeof r.savedAt !== "string" || normalizeSavedAt(r.savedAt) === null) {
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
  }

  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO snapshots (store, app_id, saved_at, score, review_count, min_installs) VALUES (?, ?, ?, ?, ?, ?)"
    );
    let inserted = 0;
    let skipped = 0;

    for (const row of rows as Array<Record<string, unknown>>) {
      const savedAt = normalizeSavedAt(row.savedAt as string)!;
      const result = stmt.run(
        row.store,
        row.appId,
        savedAt,
        row.score,
        row.reviewCount,
        (row.minInstalls as number | undefined) ?? null
      );
      result.changes === 1 ? inserted++ : skipped++;
    }

    return NextResponse.json({ inserted, skipped });
  } catch {
    return NextResponse.json(
      { error: "Failed to import snapshots", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}
