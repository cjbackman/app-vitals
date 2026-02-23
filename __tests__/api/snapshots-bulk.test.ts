/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockRun = jest.fn();
const mockPrepare = jest.fn().mockReturnValue({ run: mockRun });
// Simulate db.transaction(fn) → returns a function that calls fn synchronously.
const mockTransaction = jest.fn().mockImplementation(
  (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args)
);
const mockDb = { prepare: mockPrepare, transaction: mockTransaction };

jest.mock("@/lib/db", () => ({
  getDb: () => mockDb,
}));

import { POST, normalizeSavedAt } from "@/app/api/snapshots/bulk/route";

// ---------------------------------------------------------------------------
// normalizeSavedAt unit tests
// ---------------------------------------------------------------------------

describe("normalizeSavedAt", () => {
  it("normalises date-only to UTC midnight", () => {
    expect(normalizeSavedAt("2025-08-01")).toBe("2025-08-01T00:00:00.000Z");
  });

  it("passes through full ISO 8601 UTC string", () => {
    expect(normalizeSavedAt("2025-08-01T12:30:00.000Z")).toBe("2025-08-01T12:30:00.000Z");
  });

  it("passes through ISO 8601 without milliseconds", () => {
    expect(normalizeSavedAt("2025-08-01T00:00:00Z")).toBe("2025-08-01T00:00:00.000Z");
  });

  it("returns null for a non-date string", () => {
    expect(normalizeSavedAt("not-a-date")).toBeNull();
  });

  it("returns null for an invalid month", () => {
    expect(normalizeSavedAt("2025-13-01")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeSavedAt("")).toBeNull();
  });

  it("returns null for Feb 29 on a non-leap year", () => {
    expect(normalizeSavedAt("2025-02-29")).toBeNull();
  });

  it("returns null for Nov 31 (month with only 30 days)", () => {
    expect(normalizeSavedAt("2025-11-31")).toBeNull();
  });

  it("accepts Feb 29 on a leap year", () => {
    expect(normalizeSavedAt("2024-02-29")).toBe("2024-02-29T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// POST /api/snapshots/bulk
// ---------------------------------------------------------------------------

const VALID_ROW = {
  store: "ios",
  appId: "com.spotify.client",
  savedAt: "2025-08-01",
  score: 4.7,
  reviewCount: 12000000,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/snapshots/bulk", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/snapshots/bulk", () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockPrepare.mockReset();
    mockTransaction.mockReset();
    mockRun.mockReturnValue({ changes: 1 });
    mockPrepare.mockReturnValue({ run: mockRun });
    mockTransaction.mockImplementation(
      (fn: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) =>
          fn(...args)
    );
    // Ensure dedup is not marked disabled between tests.
    delete (global as { _dbDedupDisabled?: boolean })._dbDedupDisabled;
  });

  // --- Input validation ---

  it("returns 400 when rows is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when rows is not an array", async () => {
    const res = await POST(makeRequest({ rows: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when rows exceeds 1000", async () => {
    const rows = Array.from({ length: 1001 }, () => VALID_ROW);
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when a row element is null", async () => {
    const res = await POST(makeRequest({ rows: [null] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when score is null (typeof !== number)", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, score: null }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when score exceeds 5", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, score: 6 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when score is negative", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, score: -0.1 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when reviewCount is negative", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, reviewCount: -1 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when savedAt is an invalid date string", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, savedAt: "not-a-date" }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when savedAt is an overflowed calendar date", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, savedAt: "2025-02-29" }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when appId fails APP_ID_PATTERN", async () => {
    const res = await POST(makeRequest({ rows: [{ ...VALID_ROW, appId: "bad id!" }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/snapshots/bulk", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 413 when Content-Length exceeds 1 MB", async () => {
    const req = new NextRequest("http://localhost/api/snapshots/bulk", {
      method: "POST",
      body: JSON.stringify({ rows: [VALID_ROW] }),
      headers: { "Content-Type": "application/json", "Content-Length": "2000000" },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  // --- Success cases ---

  it("returns 200 { inserted: 1, skipped: 0 } for a valid iOS row", async () => {
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ inserted: 1, skipped: 0 });
  });

  it("returns 200 { inserted: 0, skipped: 1 } when changes is 0 (duplicate)", async () => {
    mockRun.mockReturnValue({ changes: 0 });
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ inserted: 0, skipped: 1 });
  });

  it("normalises date-only savedAt before inserting", async () => {
    await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(mockRun).toHaveBeenCalledWith(
      "ios",
      "com.spotify.client",
      "2025-08-01T00:00:00.000Z",
      4.7,
      12000000,
      null
    );
  });

  it("includes minInstalls for Android row", async () => {
    const row = { ...VALID_ROW, store: "android", appId: "com.spotify.music", minInstalls: 1000000000 };
    const res = await POST(makeRequest({ rows: [row] }));
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledWith(
      "android",
      "com.spotify.music",
      "2025-08-01T00:00:00.000Z",
      4.7,
      12000000,
      1000000000
    );
  });

  it("accepts 1000 rows (at the cap)", async () => {
    const rows = Array.from({ length: 1000 }, () => VALID_ROW);
    const res = await POST(makeRequest({ rows }));
    expect(res.status).toBe(200);
  });

  // --- Dedup disabled ---

  it("returns 503 when dedup index is disabled", async () => {
    (global as { _dbDedupDisabled?: boolean })._dbDedupDisabled = true;
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("IMPORT_ERROR");
  });

  // --- DB error ---

  it("returns 500 with IMPORT_ERROR when DB throws", async () => {
    mockPrepare.mockImplementation(() => { throw new Error("DB error"); });
    const res = await POST(makeRequest({ rows: [VALID_ROW] }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("IMPORT_ERROR");
  });
});
