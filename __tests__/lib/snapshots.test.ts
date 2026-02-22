/**
 * @jest-environment node
 */
import type { Snapshot } from "@/types/app-data";

// Mock @/lib/db so tests never touch the real SQLite file.
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });
const mockAll = jest.fn().mockReturnValue([]);
const mockPrepare = jest.fn().mockReturnValue({ run: mockRun, all: mockAll });
const mockDb = { prepare: mockPrepare, exec: jest.fn() };

jest.mock("@/lib/db", () => ({
  getDb: () => mockDb,
}));

// Import after mocks are set up.
import { saveSnapshot, getSnapshots } from "@/lib/snapshots";

describe("saveSnapshot", () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockAll.mockReset();
    mockPrepare.mockReset();
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 42 });
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll });
  });

  it("returns a Snapshot with correct fields for iOS", () => {
    const snapshot = saveSnapshot("ios", "com.spotify.client", 4.5, 12000);

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

  it("returns a Snapshot with minInstalls for Android", () => {
    const snapshot = saveSnapshot("android", "com.spotify.music", 4.3, 23456789, 500000000);

    expect(snapshot.minInstalls).toBe(500000000);
  });

  it("omits minInstalls when not provided", () => {
    const snapshot = saveSnapshot("ios", "com.spotify.client", 4.5, 12000);

    expect(snapshot.minInstalls).toBeUndefined();
  });


});

describe("getSnapshots", () => {
  beforeEach(() => {
    mockRun.mockReset();
    mockAll.mockReset();
    mockPrepare.mockReset();
    mockAll.mockReturnValue([]);
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll });
  });

  it("returns empty array when no snapshots exist", () => {
    const result = getSnapshots("ios", "com.spotify.client");
    expect(result).toEqual([]);
  });

  it("maps DB rows to Snapshot objects", () => {
    mockAll.mockReturnValue([
      {
        id: 1,
        store: "ios",
        app_id: "com.spotify.client",
        saved_at: "2026-01-01T00:00:00.000Z",
        score: 4.5,
        review_count: 12000,
        min_installs: null,
      },
    ]);

    const result = getSnapshots("ios", "com.spotify.client");

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

  it("includes minInstalls when present in row", () => {
    mockAll.mockReturnValue([
      {
        id: 2,
        store: "android",
        app_id: "com.spotify.music",
        saved_at: "2026-01-01T00:00:00.000Z",
        score: 4.3,
        review_count: 23456789,
        min_installs: 500000000,
      },
    ]);

    const result = getSnapshots("android", "com.spotify.music");

    expect(result[0]?.minInstalls).toBe(500000000);
  });


});
