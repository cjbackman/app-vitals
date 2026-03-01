/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import CompetitorTable from "@/components/CompetitorTable";
import type { PresetApp } from "@/components/PresetApps";
import type { AppData, ApiError, Snapshot } from "@/types/app-data";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const BABBEL: PresetApp = {
  name: "Babbel",
  iosId: "829587759",
  androidId: "com.babbel.mobile.android.en",
  iconUrl: "https://example.com/babbel.png",
  brandColor: "#FF6700",
};

const DUOLINGO: PresetApp = {
  name: "Duolingo",
  iosId: "570060128",
  androidId: "com.duolingo",
  iconUrl: "https://example.com/duolingo.png",
  brandColor: "#58CC02",
};

const DUOLINGO_DATA: AppData = {
  title: "Duolingo",
  icon: "https://example.com/duolingo.png",
  score: 4.9,
  reviewCount: 2_000_000,
  version: "8.0",
  developer: "Duolingo",
  price: { type: "free" },
  updatedAt: "2026-01-01T00:00:00Z",
  storeUrl: "https://apps.apple.com/app/id570060128",
  store: "ios",
};

const BABBEL_DATA: AppData = {
  title: "Babbel",
  icon: "https://example.com/babbel.png",
  score: 4.7,
  reviewCount: 50_000,
  version: "21.0",
  developer: "Babbel GmbH",
  price: { type: "free" },
  updatedAt: "2026-01-01T00:00:00Z",
  storeUrl: "https://apps.apple.com/app/id829587759",
  store: "ios",
};

function makeSnapshot(
  appId: string,
  store: "ios" | "android",
  overrides: Partial<Snapshot> = {}
): Snapshot {
  return {
    id: 1,
    store,
    appId,
    savedAt: "2026-01-01T00:00:00Z",
    score: 4.7,
    reviewCount: 50_000,
    version: null,
    isRelease: false,
    ...overrides,
  };
}

function ok(data: unknown): Promise<Response> {
  return Promise.resolve({ json: () => Promise.resolve(data), ok: true } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
  // Default: snapshots return empty array; app-data fetches return DUOLINGO_DATA.
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/snapshots")) return ok([]);
    return ok(DUOLINGO_DATA);
  });
});

describe("CompetitorTable", () => {
  it("renders store label for ios", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    expect(screen.getByText("App Store")).toBeInTheDocument();
  });

  it("renders store label for android", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="android"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    expect(screen.getByText("Google Play")).toBeInTheDocument();
  });

  it("renders the leading app as the 'you' row with its values", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    expect(screen.getByText("Babbel")).toBeInTheDocument();
    // Leading row shows leading data
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("50k")).toBeInTheDocument();
  });

  it("shows dashes for leading row vs-you columns", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    // The leading row has two "—" cells (vs you rating + vs you reviews)
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows dashes when leadingData is null", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={null}
          competitors={[DUOLINGO]}
        />
      );
    });

    // Score and review columns for leading row show "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("fetches competitor data and renders the competitor row", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      if (url.includes(DUOLINGO.iosId)) return ok(DUOLINGO_DATA);
      return ok(BABBEL_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() =>
      expect(screen.getByText("Duolingo")).toBeInTheDocument()
    );

    expect(screen.getByText("4.9")).toBeInTheDocument();
  });

  it("shows positive rating delta in red when competitor is ahead", async () => {
    // Duolingo (4.9) > Babbel (4.7) → competitor is ahead → red
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("+0.2")).toBeInTheDocument());

    const deltaCell = screen.getByText("+0.2");
    expect(deltaCell.className).toContain("text-red-400");
  });

  it("shows negative rating delta in green when competitor is behind", async () => {
    // Use Babbel as competitor against Duolingo leading → Babbel (4.7) < Duolingo (4.9) → green
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(BABBEL_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={DUOLINGO}
          leadingData={DUOLINGO_DATA}
          competitors={[BABBEL]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("-0.2")).toBeInTheDocument());

    const deltaCell = screen.getByText("-0.2");
    expect(deltaCell.className).toContain("text-green-600");
  });

  it("shows review ratio for competitor", async () => {
    // Duolingo (2M) / Babbel (50k) = ×40
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("×40")).toBeInTheDocument());
  });

  it("shows review ratio in red when competitor has more reviews", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("×40")).toBeInTheDocument());

    const ratioCell = screen.getByText("×40");
    expect(ratioCell.className).toContain("text-red-400");
  });

  it("shows review ratio in green when competitor has fewer reviews", async () => {
    // Babbel (50k) / Duolingo (2M) → ×0.03 — competitor has fewer reviews (good for leading)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(BABBEL_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={DUOLINGO}
          leadingData={DUOLINGO_DATA}
          competitors={[BABBEL]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("×0.03")).toBeInTheDocument());

    const ratioCell = screen.getByText("×0.03");
    expect(ratioCell.className).toContain("text-green-600");
  });

  it("shows dashes for competitor vs-you columns while loading", async () => {
    // Never resolve the fetch so competitor stays in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    // All vs-you cells should be "—" while loading
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows dashes when fetch fails for a competitor", async () => {
    const error: ApiError = { error: "Request failed", code: "SCRAPER_ERROR" };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(error);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("Duolingo")).toBeInTheDocument());

    // Error response → isApiError → no data → dashes shown for rating + reviews
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("aborts in-flight fetch on unmount", async () => {
    let aborted = false;
    mockFetch.mockImplementation((_url: string, options: RequestInit) => {
      options.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {}); // never resolves
    });

    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      ));
    });

    act(() => { unmount(); });

    expect(aborted).toBe(true);
  });

  it("fetches from /api/ios for ios store", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const calledUrls: string[] = mockFetch.mock.calls.map((c) => c[0] as string);
    const appDataUrl = calledUrls.find((u) => u.includes("/api/ios") && !u.includes("snapshots"));
    expect(appDataUrl).toBeDefined();
    expect(appDataUrl).toContain(encodeURIComponent(DUOLINGO.iosId));
  });

  it("fetches from /api/android for android store", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([]);
      return ok({ ...DUOLINGO_DATA, store: "android" });
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="android"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const calledUrls: string[] = mockFetch.mock.calls.map((c) => c[0] as string);
    const appDataUrl = calledUrls.find(
      (u) => u.includes("/api/android") && !u.includes("snapshots")
    );
    expect(appDataUrl).toBeDefined();
    expect(appDataUrl).toContain(encodeURIComponent(DUOLINGO.androidId));
  });
});

describe("CompetitorTable — velocity columns", () => {
  it("renders Δ column headers", async () => {
    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    // Two "Δ" headers — one for rating, one for reviews
    const deltaHeaders = screen.getAllByText("Δ");
    expect(deltaHeaders.length).toBe(2);
  });

  it("shows — for velocity when fewer than 2 snapshots exist", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/snapshots")) return ok([makeSnapshot(BABBEL.iosId, "ios")]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("Duolingo")).toBeInTheDocument());

    // With only 1 snapshot, velocity is null → all Δ cells show "—"
    const dashes = screen.getAllByText("—");
    // Leading row: velocity Δ score + velocity Δ reviews + vs-you score + vs-you reviews = 4
    // Competitor row: velocity Δ score + velocity Δ reviews = 2 (plus vs-you if leadingData null)
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it("shows velocity delta for leading app when 2+ snapshots exist", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/snapshots") &&
        url.includes(`appId=${encodeURIComponent(BABBEL.iosId)}`)
      ) {
        return ok([
          makeSnapshot(BABBEL.iosId, "ios", { score: 4.5, reviewCount: 40_000, savedAt: "2026-01-01T00:00:00Z" }),
          makeSnapshot(BABBEL.iosId, "ios", { id: 2, score: 4.7, reviewCount: 50_000, savedAt: "2026-01-08T00:00:00Z" }),
        ]);
      }
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("+0.20")).toBeInTheDocument());
    expect(screen.getByText("+10k")).toBeInTheDocument();
  });

  it("shows velocity delta for competitor when 2+ snapshots exist", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/snapshots") &&
        url.includes(`appId=${encodeURIComponent(DUOLINGO.iosId)}`)
      ) {
        return ok([
          makeSnapshot(DUOLINGO.iosId, "ios", { score: 4.8, reviewCount: 1_900_000, savedAt: "2026-01-01T00:00:00Z" }),
          makeSnapshot(DUOLINGO.iosId, "ios", { id: 2, score: 4.9, reviewCount: 2_000_000, savedAt: "2026-01-08T00:00:00Z" }),
        ]);
      }
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    await waitFor(() => expect(screen.getByText("Duolingo")).toBeInTheDocument());

    // Duolingo score: +0.10 (4.9 - 4.8), reviews: +100k (2M - 1.9M)
    await waitFor(() => expect(screen.getByText("+0.10")).toBeInTheDocument());
    expect(screen.getByText("+100k")).toBeInTheDocument();
  });

  it("colors improving velocity green and declining velocity red", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (
        url.includes("/api/snapshots") &&
        url.includes(`appId=${encodeURIComponent(BABBEL.iosId)}`)
      ) {
        return ok([
          makeSnapshot(BABBEL.iosId, "ios", { score: 4.8, reviewCount: 60_000, savedAt: "2026-01-01T00:00:00Z" }),
          makeSnapshot(BABBEL.iosId, "ios", { id: 2, score: 4.6, reviewCount: 50_000, savedAt: "2026-01-08T00:00:00Z" }),
        ]);
      }
      if (url.includes("/api/snapshots")) return ok([]);
      return ok(DUOLINGO_DATA);
    });

    await act(async () => {
      render(
        <CompetitorTable
          store="ios"
          leadingPreset={BABBEL}
          leadingData={BABBEL_DATA}
          competitors={[DUOLINGO]}
        />
      );
    });

    // score: 4.6 - 4.8 = -0.20 (declining → red)
    await waitFor(() => expect(screen.getByText("-0.20")).toBeInTheDocument());
    expect(screen.getByText("-0.20").className).toContain("text-red-400");

    // reviews: 50k - 60k = -10k (declining → red)
    expect(screen.getByText("-10k")).toBeInTheDocument();
    expect(screen.getByText("-10k").className).toContain("text-red-400");
  });
});
