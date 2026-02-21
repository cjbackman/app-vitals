import "server-only";
import { unstable_cache } from "next/cache";
import store from "app-store-scraper";
import type { AppData, AppPrice } from "@/types/app-data";
import { AppNotFoundError, StoreScraperError, validateStoreUrl } from "@/lib/store-errors";

export { AppNotFoundError, StoreScraperError };

const IOS_STORE_HOSTNAMES = ["apps.apple.com", "itunes.apple.com"];

export async function fetchIosApp(
  appId: string,
  country = "us"
): Promise<AppData> {
  // Numeric strings (e.g. "829587759") are App Store numeric IDs — pass as id.
  // Everything else (e.g. "com.spotify.client") is a bundle ID — pass as appId.
  const opts = /^\d+$/.test(appId)
    ? { id: parseInt(appId, 10), country }
    : { appId, country };

  let raw;
  try {
    raw = await store.app(opts);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err);
    if (message.includes("not found") || message.includes("404")) {
      throw new AppNotFoundError(appId, "App Store");
    }
    throw new StoreScraperError("App Store", err);
  }

  const price: AppPrice =
    raw.price === 0
      ? { type: "free" }
      : { type: "paid", amount: raw.price, currency: raw.currency };

  return {
    title: raw.title,
    icon: raw.icon,
    score: raw.score,
    reviewCount: raw.reviews,
    version: raw.version,
    developer: raw.developer,
    price,
    // raw.updated is already an ISO 8601 string from the iTunes API
    updatedAt: raw.updated,
    storeUrl: validateStoreUrl(raw.url, IOS_STORE_HOSTNAMES),
    store: "ios",
  };
}

export const getIosApp = unstable_cache(
  fetchIosApp,
  ["ios-app"],
  { revalidate: 3600 }
);
