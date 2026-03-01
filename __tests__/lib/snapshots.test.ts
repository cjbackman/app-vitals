/**
 * @jest-environment node
 */
import type { Snapshot } from "@/types/app-data";

// Mock @/lib/db so tests never touch the real database.
const mockExecute = jest.fn().mockResolvedValue({
  rows: [],
  rowsAffected: 0,
  lastInsertRowid: undefined,
});
const mockBatch = jest.fn().mockResolvedValue([]);
const mockDb = { execute: mockExecute, batch: mockBatch };

jest.mock("@/lib/db", () => ({
  getDb: () => Promise.resolve(mockDb),
}));

// Import after mocks are set up.
import { saveSnapshot, getSnapshots } from "@/lib/snapshots";

describe("saveSnapshot", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1, lastInsertRowid: 42n });
  });

  it("returns a Snapshot with correct fields for iOS", async () => {
    const snapshot = await saveSnapshot("ios", "com.spotify.client", 4.5, 12000);

    expect(snapshot).toMatchObject<Partial<Snapshot>>({
      store: "ios",
      appId: "com.spotify.client",
      score: 4.5,
      reviewCount: 12000,
      id: 42,
    });
    expect(typeof snapshot.savedAt).toBe("string");
    expect(snapshot.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns a Snapshot with minInstalls for Android", async () => {
    const snapshot = await saveSnapshot("android", "com.spotify.music", 4.3, 23456789, 500000000);

    expect(snapshot.minInstalls).toBe(500000000);
  });

  it("omits minInstalls when not provided", async () => {
    const snapshot = await saveSnapshot("ios", "com.spotify.client", 4.5, 12000);

    expect(snapshot.minInstalls).toBeUndefined();
  });

  it("handles undefined lastInsertRowid safely", async () => {
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: undefined });
    const snapshot = await saveSnapshot("ios", "com.spotify.client", 4.5, 12000);
    expect(snapshot.id).toBe(0);
  });
});

describe("getSnapshots", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 0 });
  });

  it("returns empty array when no snapshots exist", async () => {
    const result = await getSnapshots("ios", "com.spotify.client");
    expect(result).toEqual([]);
  });

  it("maps DB rows to Snapshot objects", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          id: 1,
          store: "ios",
          app_id: "com.spotify.client",
          saved_at: "2026-01-01T00:00:00.000Z",
          score: 4.5,
          review_count: 12000,
          min_installs: null,
        },
      ],
    });

    const result = await getSnapshots("ios", "com.spotify.client");

    expect(result).toEqual([
      {
        id: 1,
        store: "ios",
        appId: "com.spotify.client",
        savedAt: "2026-01-01T00:00:00.000Z",
        score: 4.5,
        reviewCount: 12000,
      },
    ]);
    expect(result[0]?.minInstalls).toBeUndefined();
  });

  it("includes minInstalls when present in row", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          id: 2,
          store: "android",
          app_id: "com.spotify.music",
          saved_at: "2026-01-01T00:00:00.000Z",
          score: 4.3,
          review_count: 23456789,
          min_installs: 500000000,
        },
      ],
    });

    const result = await getSnapshots("android", "com.spotify.music");

    expect(result[0]?.minInstalls).toBe(500000000);
  });

  it("coerces bigint row values to number", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          id: 3n,
          store: "ios",
          app_id: "com.example",
          saved_at: "2026-01-01T00:00:00.000Z",
          score: 4n,
          review_count: 1000n,
          min_installs: null,
        },
      ],
    });

    const result = await getSnapshots("ios", "com.example");

    expect(typeof result[0]?.id).toBe("number");
    expect(typeof result[0]?.score).toBe("number");
    expect(typeof result[0]?.reviewCount).toBe("number");
  });
});
