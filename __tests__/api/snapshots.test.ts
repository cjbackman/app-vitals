/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockGetSnapshots = jest.fn();

jest.mock("@/lib/snapshots", () => ({
  getSnapshots: (...args: unknown[]) => mockGetSnapshots(...args),
}));

import { GET } from "@/app/api/snapshots/route";

describe("GET /api/snapshots", () => {
  beforeEach(() => {
    mockGetSnapshots.mockReset();
    mockGetSnapshots.mockResolvedValue([]);
  });

  it("returns 400 when store param is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?appId=com.spotify.client"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 when appId param is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 400 for invalid store value", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?store=windows&appId=com.app"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_SNAPSHOT_PARAMS");
  });

  it("returns 500 with SCRAPER_ERROR when getSnapshots throws", async () => {
    mockGetSnapshots.mockRejectedValue(new Error("DB failure"));

    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios&appId=com.spotify.client"
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SCRAPER_ERROR");
  });

  it("returns 200 with snapshot array", async () => {
    const mockData = [
      {
        id: 1,
        store: "ios",
        appId: "com.spotify.client",
        savedAt: "2026-01-01T00:00:00.000Z",
        score: 4.5,
        reviewCount: 12000,
      },
    ];
    mockGetSnapshots.mockResolvedValue(mockData);

    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios&appId=com.spotify.client"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockData);
  });

  it("returns 200 with empty array when no history", async () => {
    mockGetSnapshots.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios&appId=com.new.app"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

