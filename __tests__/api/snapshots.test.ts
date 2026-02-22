/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockGetSnapshots = jest.fn();
const mockSaveSnapshot = jest.fn();

jest.mock("@/lib/snapshots", () => ({
  getSnapshots: (...args: unknown[]) => mockGetSnapshots(...args),
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
}));

import { GET, POST } from "@/app/api/snapshots/route";

describe("GET /api/snapshots", () => {
  beforeEach(() => {
    mockGetSnapshots.mockReset();
    mockGetSnapshots.mockReturnValue([]);
  });

  it("returns 400 when store param is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?appId=com.spotify.client"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when appId param is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid store value", async () => {
    const req = new NextRequest(
      "http://localhost/api/snapshots?store=windows&appId=com.app"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
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
    mockGetSnapshots.mockReturnValue(mockData);

    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios&appId=com.spotify.client"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockData);
  });

  it("returns 200 with empty array when no history", async () => {
    mockGetSnapshots.mockReturnValue([]);

    const req = new NextRequest(
      "http://localhost/api/snapshots?store=ios&appId=com.new.app"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/snapshots", () => {
  beforeEach(() => {
    mockSaveSnapshot.mockReset();
    mockSaveSnapshot.mockReturnValue({
      id: 1,
      store: "ios",
      appId: "com.spotify.client",
      savedAt: "2026-01-01T00:00:00.000Z",
      score: 4.5,
      reviewCount: 12000,
    });
  });

  it("returns 400 when store is missing", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ appId: "com.app", score: 4.5, reviewCount: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is missing", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ store: "ios", appId: "com.app", reviewCount: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when reviewCount is missing", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ store: "ios", appId: "com.app", score: 4.5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid store value", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ store: "windows", appId: "com.app", score: 4.5, reviewCount: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with saved snapshot for iOS", async () => {
    const mockSnapshot = {
      id: 1,
      store: "ios",
      appId: "com.spotify.client",
      savedAt: "2026-01-01T00:00:00.000Z",
      score: 4.5,
      reviewCount: 12000,
    };
    mockSaveSnapshot.mockReturnValue(mockSnapshot);

    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({
        store: "ios",
        appId: "com.spotify.client",
        score: 4.5,
        reviewCount: 12000,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(mockSnapshot);
  });

  it("passes minInstalls to saveSnapshot for Android", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: JSON.stringify({
        store: "android",
        appId: "com.spotify.music",
        score: 4.3,
        reviewCount: 23456789,
        minInstalls: 500000000,
      }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req);

    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      "android",
      "com.spotify.music",
      4.3,
      23456789,
      500000000
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/snapshots", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
