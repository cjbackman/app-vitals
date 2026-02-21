/**
 * @jest-environment node
 */
import { fetchIosApp, AppNotFoundError, StoreScraperError } from "@/lib/ios-store";

const mockApp = jest.fn();

jest.mock("app-store-scraper", () => ({
  app: (...args: unknown[]) => mockApp(...args),
}));

const BASE_RAW = {
  id: 324684580,
  appId: "com.spotify.client",
  title: "Spotify",
  icon: "https://example.com/icon.png",
  score: 4.8,
  reviews: 12345678,
  version: "8.9.58",
  developer: "Spotify AB",
  developerUrl: "https://apps.apple.com/developer",
  price: 0,
  currency: "USD",
  free: true,
  updated: "2024-11-15T10:00:00Z",
  url: "https://apps.apple.com/us/app/spotify/id324684580",
  description: "Music streaming",
  primaryGenre: "Music",
  contentRating: "4+",
  screenshots: [],
};

describe("fetchIosApp", () => {
  beforeEach(() => mockApp.mockReset());

  it("maps raw scraper fields to AppData", async () => {
    mockApp.mockResolvedValue(BASE_RAW);

    const result = await fetchIosApp("com.spotify.client");

    expect(result).toMatchObject({
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
    });
  });

  it("maps a paid app price correctly", async () => {
    mockApp.mockResolvedValue({ ...BASE_RAW, price: 2.99, free: false });

    const result = await fetchIosApp("com.example.paidapp");

    expect(result.price).toEqual({ type: "paid", amount: 2.99, currency: "USD" });
  });

  it("passes updatedAt through as the ISO string from the scraper", async () => {
    mockApp.mockResolvedValue({ ...BASE_RAW, updated: "2025-06-01T08:30:00Z" });

    const result = await fetchIosApp("com.spotify.client");

    expect(result.updatedAt).toBe("2025-06-01T08:30:00Z");
  });

  it("throws AppNotFoundError when scraper says not found", async () => {
    mockApp.mockRejectedValue(new Error("App not found (404)"));

    await expect(fetchIosApp("com.missing.app")).rejects.toBeInstanceOf(
      AppNotFoundError
    );
  });

  it("throws StoreScraperError for other scraper failures", async () => {
    mockApp.mockRejectedValue(new Error("Network timeout"));

    await expect(fetchIosApp("com.spotify.client")).rejects.toBeInstanceOf(
      StoreScraperError
    );
  });

  it("passes country param to the scraper", async () => {
    mockApp.mockResolvedValue(BASE_RAW);

    await fetchIosApp("com.spotify.client", "gb");

    expect(mockApp).toHaveBeenCalledWith({ appId: "com.spotify.client", country: "gb" });
  });
});
