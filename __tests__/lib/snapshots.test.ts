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
    const snapshot = await saveSnapshot("ios", "com.spotify.client", {
      score: 4.5,
      reviewCount: 12000,
      version: "8.6.2",
    });

    expect(snapshot).toMatchObject<Partial<Snapshot>>({
      store: "ios",
      appId: "com.spotify.client",
      score: 4.5,
      reviewCount: 12000,
      version: "8.6.2",
      id: 42,
    });
    expect(typeof snapshot.savedAt).toBe("string");
    expect(snapshot.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles undefined lastInsertRowid safely", async () => {
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 0, lastInsertRowid: undefined });
    const snapshot = await saveSnapshot("ios", "com.spotify.client", {
      score: 4.5,
      reviewCount: 12000,
      version: "8.6.2",
    });
    expect(snapshot.id).toBe(0);
  });

  it("isRelease is always false on save (no predecessor available)", async () => {
    const snapshot = await saveSnapshot("ios", "com.spotify.client", {
      score: 4.5,
      reviewCount: 12000,
      version: "8.6.2",
    });
    expect(snapshot.isRelease).toBe(false);
  });

  it("stores null when version is null (e.g. normalised Varies with device)", async () => {
    const snapshot = await saveSnapshot("android", "com.example", {
      score: 4.0,
      reviewCount: 1000,
      version: null,
    });
    expect(snapshot.version).toBeNull();
  });

  it("stores null when version is omitted", async () => {
    const snapshot = await saveSnapshot("ios", "com.example", {
      score: 4.0,
      reviewCount: 1000,
    });
    expect(snapshot.version).toBeNull();
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

  it("maps DB rows to Snapshot objects including version and isRelease", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          id: 1,
          store: "ios",
          app_id: "com.spotify.client",
          saved_at: "2026-01-01T00:00:00.000Z",
          score: 4.5,
          review_count: 12000,
          version: "8.6.0",
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
        version: "8.6.0",
        isRelease: false,
      },
    ]);
  });

  it("returns version: null for rows saved before migration", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          id: 1,
          store: "ios",
          app_id: "com.example",
          saved_at: "2026-01-01T00:00:00.000Z",
          score: 4.0,
          review_count: 1000,
          version: null,
        },
      ],
    });

    const result = await getSnapshots("ios", "com.example");
    expect(result[0]?.version).toBeNull();
    expect(result[0]?.isRelease).toBe(false);
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
          version: "1.0",
        },
      ],
    });

    const result = await getSnapshots("ios", "com.example");

    expect(typeof result[0]?.id).toBe("number");
    expect(typeof result[0]?.score).toBe("number");
    expect(typeof result[0]?.reviewCount).toBe("number");
  });

  describe("isRelease computation", () => {
    it("is false for the first snapshot (no predecessor)", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: "1.0",
          },
        ],
      });

      const result = await getSnapshots("ios", "com.example");
      expect(result[0]?.isRelease).toBe(false);
    });

    it("is true when consecutive versions differ and both are non-null", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: "1.0",
          },
          {
            id: 2,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-08T00:00:00.000Z",
            score: 4.6,
            review_count: 1100,
            version: "2.0",
          },
        ],
      });

      const result = await getSnapshots("ios", "com.example");
      expect(result[0]?.isRelease).toBe(false); // first snapshot
      expect(result[1]?.isRelease).toBe(true);  // version changed
    });

    it("is false when consecutive versions are the same", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: "1.0",
          },
          {
            id: 2,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-08T00:00:00.000Z",
            score: 4.5,
            review_count: 1100,
            version: "1.0",
          },
        ],
      });

      const result = await getSnapshots("ios", "com.example");
      expect(result[1]?.isRelease).toBe(false);
    });

    it("is false when current version is null (pre-migration row)", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: "1.0",
          },
          {
            id: 2,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-08T00:00:00.000Z",
            score: 4.5,
            review_count: 1100,
            version: null, // old row
          },
        ],
      });

      const result = await getSnapshots("ios", "com.example");
      expect(result[1]?.isRelease).toBe(false);
    });

    it("is false when previous version is null (prevents false positive on first post-migration row)", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: null, // pre-migration
          },
          {
            id: 2,
            store: "ios",
            app_id: "com.example",
            saved_at: "2026-01-08T00:00:00.000Z",
            score: 4.5,
            review_count: 1100,
            version: "2.0", // first post-migration version — NOT a release
          },
        ],
      });

      const result = await getSnapshots("ios", "com.example");
      expect(result[1]?.isRelease).toBe(false);
    });

    it("is false for Android Varies-with-device (equal strings, not a release)", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: 1,
            store: "android",
            app_id: "com.example",
            saved_at: "2026-01-01T00:00:00.000Z",
            score: 4.5,
            review_count: 1000,
            version: "Varies with device",
          },
          {
            id: 2,
            store: "android",
            app_id: "com.example",
            saved_at: "2026-01-08T00:00:00.000Z",
            score: 4.5,
            review_count: 1100,
            version: "Varies with device",
          },
        ],
      });

      const result = await getSnapshots("android", "com.example");
      expect(result[1]?.isRelease).toBe(false);
    });
  });
});
