/**
 * @jest-environment node
 */
import { fetchAndroidApp, AppNotFoundError, StoreScraperError } from "@/lib/android-store";

// google-play-scraper uses ES module default export — mock must include __esModule flag
const mockGplayApp = jest.fn();

jest.mock("google-play-scraper", () => ({
  __esModule: true,
  default: {
    app: (...args: unknown[]) => mockGplayApp(...args),
  },
}));

const UNIX_MS = 1731801600000; // 2024-11-17T00:00:00.000Z

const BASE_RAW = {
  appId: "com.spotify.music",
  url: "https://play.google.com/store/apps/details?id=com.spotify.music",
  title: "Spotify",
  summary: "Music",
  description: "Music streaming",
  developer: "Spotify AB",
  developerId: "Spotify+AB",
  icon: "https://example.com/icon.png",
  score: 4.3,
  scoreText: "4.3",
  ratings: 23456789,
  reviews: 1234567,
  histogram: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  price: 0,
  free: true,
  currency: "USD",
  priceText: "Free",
  available: true,
  offersIAP: false,
  IAPRange: "",
  size: "",
  androidVersion: "8.0",
  androidVersionText: "8.0 and up",
  developerInternalID: "123",
  developerEmail: "",
  developerWebsite: "",
  developerAddress: "",
  developerLegalName: "",
  developerLegalEmail: "",
  developerLegalAddress: "",
  developerLegalPhoneNumber: "",
  genre: "Music & Audio",
  genreId: "MUSIC_AND_AUDIO",
  categories: [],
  headerImage: "",
  screenshots: [],
  video: "",
  videoImage: "",
  contentRating: "Everyone",
  contentRatingDescription: "",
  adSupported: false,
  released: "2012-10-12",
  updated: UNIX_MS,
  version: "8.9.58",
  recentChanges: "",
  comments: [],
  hasEarlyAccess: false,
  preregister: false,
  isAvailableInPlayPass: false,
};

describe("fetchAndroidApp", () => {
  beforeEach(() => mockGplayApp.mockReset());

  it("maps raw scraper fields to AppData", async () => {
    mockGplayApp.mockResolvedValue(BASE_RAW);

    const result = await fetchAndroidApp("com.spotify.music");

    expect(result).toMatchObject({
      title: "Spotify",
      icon: "https://example.com/icon.png",
      score: 4.3,
      reviewCount: 23456789, // uses raw.ratings, not raw.reviews
      version: "8.9.58",
      developer: "Spotify AB",
      price: { type: "free" },
      store: "android",
      storeUrl: "https://play.google.com/store/apps/details?id=com.spotify.music",
    });
  });

  it("converts Unix ms timestamp to ISO 8601 string", async () => {
    mockGplayApp.mockResolvedValue({ ...BASE_RAW, updated: UNIX_MS });

    const result = await fetchAndroidApp("com.spotify.music");

    expect(result.updatedAt).toBe("2024-11-17T00:00:00.000Z");
  });

  it("maps a paid app price correctly", async () => {
    mockGplayApp.mockResolvedValue({ ...BASE_RAW, price: 4.99, free: false, currency: "USD" });

    const result = await fetchAndroidApp("com.example.paidapp");

    expect(result.price).toEqual({ type: "paid", amount: 4.99, currency: "USD" });
  });

  it("uses ratings (not reviews) for reviewCount", async () => {
    mockGplayApp.mockResolvedValue({ ...BASE_RAW, ratings: 5000000, reviews: 100000 });

    const result = await fetchAndroidApp("com.spotify.music");

    expect(result.reviewCount).toBe(5000000);
  });

  it("throws AppNotFoundError when scraper says not found", async () => {
    mockGplayApp.mockRejectedValue(new Error("app not found in play store"));

    await expect(fetchAndroidApp("com.missing.app")).rejects.toBeInstanceOf(
      AppNotFoundError
    );
  });

  it("throws StoreScraperError for other scraper failures", async () => {
    mockGplayApp.mockRejectedValue(new Error("Network timeout"));

    await expect(fetchAndroidApp("com.spotify.music")).rejects.toBeInstanceOf(
      StoreScraperError
    );
  });
});
