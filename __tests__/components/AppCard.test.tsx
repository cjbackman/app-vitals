import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppCard from "@/components/AppCard";
import type { AppData, ApiError } from "@/types/app-data";

// Mock fetch globally for snapshot API calls.
const mockFetch = jest.fn();
global.fetch = mockFetch;

const BASE_APP: AppData = {
  title: "Spotify",
  icon: "https://example.com/icon.png",
  score: 4.8,
  reviewCount: 12345678,
  version: "8.9.58",
  developer: "Spotify AB",
  price: { type: "free" },
  updatedAt: "2024-11-15T10:00:00Z",
  storeUrl: "https://apps.apple.com/us/app/spotify/id324684580",
  store: "ios",
};

// Default: snapshot fetch returns empty array.
function setupEmptySnapshots() {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve([]),
    ok: true,
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
  setupEmptySnapshots();
});

describe("AppCard", () => {
  it("renders app data correctly", () => {
    // No appId — avoids triggering async snapshot fetch in this test.
    render(<AppCard store="ios" data={BASE_APP} />);

    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Spotify AB")).toBeInTheDocument();
    expect(screen.getByText("4.8 / 5")).toBeInTheDocument();
    expect(screen.getByText("8.9.58")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders APP_NOT_FOUND error state", () => {
    const error: ApiError = { error: "App not found", code: "APP_NOT_FOUND" };
    render(<AppCard store="ios" data={error} />);

    expect(
      screen.getByText("App not found. Check the ID and try again.")
    ).toBeInTheDocument();
  });

  it("renders SCRAPER_ERROR error state", () => {
    const error: ApiError = { error: "Scraper failed", code: "SCRAPER_ERROR" };
    render(<AppCard store="android" data={error} />);

    expect(
      screen.getByText("Could not reach the store. Try again later.")
    ).toBeInTheDocument();
  });

  it("renders INVALID_APP_ID error state", () => {
    const error: ApiError = { error: "Bad ID", code: "INVALID_APP_ID" };
    render(<AppCard store="ios" data={error} />);

    expect(screen.getByText("Invalid app ID format.")).toBeInTheDocument();
  });

  it("shows store label for ios", () => {
    // No appId — avoids async snapshot fetch side-effect.
    render(<AppCard store="ios" data={BASE_APP} />);
    expect(screen.getByText("App Store")).toBeInTheDocument();
  });

  it("shows store label for android", () => {
    render(<AppCard store="android" data={{ ...BASE_APP, store: "android" }} />);
    expect(screen.getByText("Google Play")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading=true", () => {
    const { container } = render(<AppCard store="ios" data={null} loading />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders nothing when data is null and not loading", () => {
    const { container } = render(<AppCard store="ios" data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders paid price correctly", () => {
    const paid: AppData = {
      ...BASE_APP,
      price: { type: "paid", amount: 2.99, currency: "USD" },
    };
    render(<AppCard store="ios" data={paid} />);
    expect(screen.getByText("$2.99")).toBeInTheDocument();
  });
});

describe("AppCard Save snapshot button", () => {
  it("shows Save snapshot button when data is loaded and appId provided", async () => {
    await act(async () => {
      render(<AppCard store="ios" data={BASE_APP} appId="com.spotify.client" />);
    });
    expect(screen.getByText("Save snapshot")).toBeInTheDocument();
  });

  it("does not show Save snapshot button when loading", () => {
    render(<AppCard store="ios" data={null} loading appId="com.spotify.client" />);
    expect(screen.queryByText("Save snapshot")).not.toBeInTheDocument();
  });

  it("does not show Save snapshot button when data is an error", () => {
    const error: ApiError = { error: "not found", code: "APP_NOT_FOUND" };
    render(<AppCard store="ios" data={error} appId="com.spotify.client" />);
    expect(screen.queryByText("Save snapshot")).not.toBeInTheDocument();
  });

  it("does not show Save snapshot button when data is null", () => {
    const { container } = render(<AppCard store="ios" data={null} appId="com.spotify.client" />);
    expect(container.firstChild).toBeNull();
  });

  it("Save button is disabled when appId is not provided", () => {
    render(<AppCard store="ios" data={BASE_APP} />);
    const button = screen.getByText("Save snapshot");
    expect(button).toBeDisabled();
  });

  it("calls POST /api/snapshots when Save is clicked", async () => {
    // First call: GET snapshots (returns []). Second call: POST save. Third: GET refresh.
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([]), ok: true } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve({}), ok: true } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([]), ok: true } as Response);

    render(<AppCard store="ios" data={BASE_APP} appId="com.spotify.client" />);

    const button = screen.getByText("Save snapshot");
    await userEvent.click(button);

    const postCall = mockFetch.mock.calls.find(
      (call) => call[1]?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(postCall![0]).toBe("/api/snapshots");
  });

  it("shows Saving… while in flight, then Saved! on success", async () => {
    let resolvePost!: (v: unknown) => void;
    const postPromise = new Promise((r) => (resolvePost = r));

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([]), ok: true } as Response)
      .mockReturnValueOnce({ json: () => postPromise, ok: true } as unknown as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([]), ok: true } as Response);

    render(<AppCard store="ios" data={BASE_APP} appId="com.spotify.client" />);

    const button = screen.getByText("Save snapshot");
    userEvent.click(button);

    await waitFor(() =>
      expect(screen.queryByText("Saving…")).toBeInTheDocument()
    );

    resolvePost({});

    await waitFor(() =>
      expect(screen.queryByText("Saved!")).toBeInTheDocument()
    );
  });
});
