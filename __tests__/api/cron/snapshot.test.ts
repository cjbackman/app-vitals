/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// Two preset apps (Babbel + Duolingo) → 4 jobs total (ios + android each)
const PRESET_COUNT = 2;

const mockFetchIosApp = jest.fn();
const mockFetchAndroidApp = jest.fn();
const mockSaveSnapshot = jest.fn();

jest.mock("@/lib/ios-store", () => ({
  fetchIosApp: (...args: unknown[]) => mockFetchIosApp(...args),
}));
jest.mock("@/lib/android-store", () => ({
  fetchAndroidApp: (...args: unknown[]) => mockFetchAndroidApp(...args),
}));
jest.mock("@/lib/snapshots", () => ({
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
}));

import { POST } from "@/app/api/cron/snapshot/route";

const VALID_APP_DATA = { score: 4.5, reviewCount: 12000, version: "8.6.2" };
const SECRET = "test-secret";

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/snapshot", { headers });
}

describe("POST /api/cron/snapshot", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  beforeEach(() => {
    mockFetchIosApp.mockReset();
    mockFetchAndroidApp.mockReset();
    mockSaveSnapshot.mockReset();
    mockFetchIosApp.mockResolvedValue(VALID_APP_DATA);
    mockFetchAndroidApp.mockResolvedValue(VALID_APP_DATA);
    mockSaveSnapshot.mockResolvedValue(undefined);
  });

  // --- Auth ---

  it("returns 401 without Authorization header", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with wrong secret", async () => {
    const res = await POST(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("returns 401 without Bearer prefix", async () => {
    const res = await POST(makeRequest(SECRET));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  // --- Success ---

  it("returns 200 with saved count when all fetches succeed", async () => {
    const res = await POST(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ saved: PRESET_COUNT * 2, failed: 0, errors: [] });
  });

  it("calls fetchIosApp and fetchAndroidApp for each preset", async () => {
    await POST(makeRequest(`Bearer ${SECRET}`));
    expect(mockFetchIosApp).toHaveBeenCalledTimes(PRESET_COUNT);
    expect(mockFetchAndroidApp).toHaveBeenCalledTimes(PRESET_COUNT);
  });

  it("calls saveSnapshot for each successful fetch", async () => {
    await POST(makeRequest(`Bearer ${SECRET}`));
    expect(mockSaveSnapshot).toHaveBeenCalledTimes(PRESET_COUNT * 2);
  });

  it("passes version to saveSnapshot as options object", async () => {
    await POST(makeRequest(`Bearer ${SECRET}`));
    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      expect.any(String), // store
      expect.any(String), // appId
      expect.objectContaining({ score: 4.5, reviewCount: 12000, version: "8.6.2" }),
    );
  });

  // --- Partial failure ---

  it("returns saved/failed counts when one fetch throws", async () => {
    mockFetchIosApp.mockRejectedValueOnce(new Error("App not found"));

    const res = await POST(makeRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(PRESET_COUNT * 2 - 1);
    expect(data.failed).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toBe("App not found");
  });

  it("does not call saveSnapshot for a failed fetch", async () => {
    mockFetchIosApp.mockRejectedValue(new Error("fetch failed"));

    await POST(makeRequest(`Bearer ${SECRET}`));
    // Only android calls should save (PRESET_COUNT of them)
    expect(mockSaveSnapshot).toHaveBeenCalledTimes(PRESET_COUNT);
  });

  it("includes error messages for all failed jobs", async () => {
    mockFetchIosApp.mockRejectedValue(new Error("iOS error"));
    mockFetchAndroidApp.mockRejectedValue(new Error("Android error"));

    const res = await POST(makeRequest(`Bearer ${SECRET}`));
    const data = await res.json();
    expect(data.saved).toBe(0);
    expect(data.failed).toBe(PRESET_COUNT * 2);
    expect(data.errors).toContain("iOS error");
    expect(data.errors).toContain("Android error");
  });
});
