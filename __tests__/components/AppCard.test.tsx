import { render, screen, act } from "@testing-library/react";
import AppCard from "@/components/AppCard";
import type { AppData, ApiError } from "@/types/app-data";

jest.mock("@/components/SnapshotHistory", () => ({
  __esModule: true,
  default: ({ color }: { color?: string }) => (
    <div data-testid="snapshot-history" data-color={color ?? ""} />
  ),
}));

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

  it("renders INVALID_SNAPSHOT_PARAMS error state", () => {
    const error: ApiError = { error: "Bad params", code: "INVALID_SNAPSHOT_PARAMS" };
    render(<AppCard store="ios" data={error} />);

    expect(screen.getByText("Invalid snapshot data.")).toBeInTheDocument();
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

  it("renders Installs field for Android data with minInstalls", () => {
    const android: AppData = {
      ...BASE_APP,
      store: "android",
      minInstalls: 1_000_000,
    };
    render(<AppCard store="android" data={android} />);
    expect(screen.getByText("Installs")).toBeInTheDocument();
    expect(screen.getByText("1M+")).toBeInTheDocument();
  });

  it("does not render Installs field for iOS data without minInstalls", () => {
    render(<AppCard store="ios" data={BASE_APP} />);
    expect(screen.queryByText("Installs")).not.toBeInTheDocument();
  });
});

describe("AppCard brandColor prop", () => {
  it("passes brandColor prop through to SnapshotHistory", async () => {
    await act(async () => {
      render(
        <AppCard
          store="ios"
          data={BASE_APP}
          appId="570060128"
          brandColor="#58CC02"
        />
      );
    });
    expect(screen.getByTestId("snapshot-history")).toHaveAttribute(
      "data-color",
      "#58CC02"
    );
  });

  it("passes undefined brandColor as empty string to SnapshotHistory", async () => {
    await act(async () => {
      render(<AppCard store="ios" data={BASE_APP} appId="570060128" />);
    });
    expect(screen.getByTestId("snapshot-history")).toHaveAttribute(
      "data-color",
      ""
    );
  });
});

