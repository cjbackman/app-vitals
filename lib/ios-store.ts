import "server-only";
import { unstable_cache } from "next/cache";
import store from "app-store-scraper";
import type { AppData, AppPrice } from "@/types/app-data";

export class AppNotFoundError extends Error {
  readonly code = "APP_NOT_FOUND" as const;
  constructor(appId: string) {
    super(`App not found in App Store: ${appId}`);
  }
}

export class StoreScraperError extends Error {
  readonly code = "SCRAPER_ERROR" as const;
  constructor(cause: unknown) {
    super("App Store scraper failed");
    this.cause = cause;
  }
}

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
      throw new AppNotFoundError(appId);
    }
    throw new StoreScraperError(err);
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
    updatedAt: raw.updated,
    storeUrl: raw.url,
    store: "ios",
  };
}

export const getIosApp = unstable_cache(
  fetchIosApp,
  ["ios-app"],
  { revalidate: 3600 }
);
