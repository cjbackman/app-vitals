/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "@/components/SearchPage";
import { PRESET_APPS } from "@/components/PresetApps";
import type { AppData, ApiError } from "@/types/app-data";

// next/image doesn't render in jsdom — mock as a plain <img>
jest.mock("next/image", () => ({
  __esModule: true,
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      sizes?: string;
    }
  ) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}));

// Mock SnapshotHistory to capture the color prop without rendering SVGs.
jest.mock("@/components/SnapshotHistory", () => ({
  __esModule: true,
  default: ({
    color,
    store,
  }: {
    color?: string;
    store: string;
    snapshots: unknown[];
  }) => (
    <div
      data-testid={`snapshot-history-${store}`}
      data-color={color ?? ""}
    />
  ),
}));

// Mock CompetitorTable to avoid competitor fetching side-effects in SearchPage tests.
jest.mock("@/components/CompetitorTable", () => ({
  __esModule: true,
  default: ({ store }: { store: string }) => (
    <div data-testid={`competitor-table-${store}`} />
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const babbel = PRESET_APPS[0]!;
const duolingo = PRESET_APPS[1]!;

const BABBEL_APP: AppData = {
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

const DUOLINGO_APP: AppData = {
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

const CUSTOM_APP: AppData = {
  title: "Custom App",
  icon: "https://example.com/custom.png",
  score: 3.5,
  reviewCount: 100,
  version: "1.0",
  developer: "Someone",
  price: { type: "free" },
  updatedAt: "2026-01-01T00:00:00Z",
  storeUrl: "https://example.com",
  store: "ios",
};

function ok(data: unknown): Promise<Response> {
  return Promise.resolve({ json: () => Promise.resolve(data), ok: true } as Response);
}

/** Sets up fetch responses based on URL — order-independent. */
function setupFetchByUrl(overrides: Record<string, AppData | ApiError> = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/snapshots")) return ok([]);
    if (url.includes(`appId=${encodeURIComponent(babbel.iosId)}`))
      return ok(overrides["babbel-ios"] ?? BABBEL_APP);
    if (url.includes(`appId=${encodeURIComponent(babbel.androidId)}`))
      return ok(overrides["babbel-android"] ?? { ...BABBEL_APP, store: "android" });
    if (url.includes(`appId=${encodeURIComponent(duolingo.iosId)}`))
      return ok(overrides["duolingo-ios"] ?? DUOLINGO_APP);
    if (url.includes(`appId=${encodeURIComponent(duolingo.androidId)}`))
      return ok(overrides["duolingo-android"] ?? { ...DUOLINGO_APP, store: "android" });
    return ok(CUSTOM_APP);
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SearchPage — comparison section", () => {
  it("renders CompetitorTable for both stores when a preset is selected", async () => {
    setupFetchByUrl();
    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() =>
      expect(screen.getByTestId("competitor-table-ios")).toBeInTheDocument()
    );
    expect(screen.getByTestId("competitor-table-android")).toBeInTheDocument();
  });

  it("does not render CompetitorTable for non-preset searches", async () => {
    setupFetchByUrl();

    await act(async () => {
      render(<SearchPage />);
    });

    // Wait for initial Babbel auto-search to settle
    await waitFor(() =>
      expect(screen.getAllByText("Babbel").length).toBeGreaterThan(0)
    );

    // Trigger a custom search with non-preset IDs
    const iosInput = screen.getByLabelText("App Store ID");
    const androidInput = screen.getByLabelText("Google Play Package");

    await userEvent.clear(iosInput);
    await userEvent.type(iosInput, "custom-ios-id");
    await userEvent.clear(androidInput);
    await userEvent.type(androidInput, "custom-android-id");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Look up" }));
    });

    await waitFor(() =>
      expect(screen.getAllByText("Custom App").length).toBeGreaterThan(0)
    );

    expect(screen.queryByTestId("competitor-table-ios")).not.toBeInTheDocument();
    expect(screen.queryByTestId("competitor-table-android")).not.toBeInTheDocument();
  });
});
