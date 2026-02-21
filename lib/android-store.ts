import "server-only";
import { unstable_cache } from "next/cache";
import gplay from "google-play-scraper";
import type { AppData, AppPrice } from "@/types/app-data";

export class AppNotFoundError extends Error {
  readonly code = "APP_NOT_FOUND" as const;
  constructor(appId: string) {
    super(`App not found in Google Play: ${appId}`);
  }
}

export class StoreScraperError extends Error {
  readonly code = "SCRAPER_ERROR" as const;
  constructor(cause: unknown) {
    super("Google Play scraper failed");
    this.cause = cause;
  }
}

export async function fetchAndroidApp(
  appId: string,
  country = "us"
): Promise<AppData> {
  let raw;
  try {
    raw = await gplay.app({ appId, lang: "en", country });
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
    // raw.ratings = total rating count (matches iOS's raw.reviews scale)
    reviewCount: raw.ratings,
    version: raw.version,
    developer: raw.developer,
    price,
    // raw.updated is a Unix ms timestamp — convert to ISO string
    updatedAt: new Date(raw.updated).toISOString(),
    storeUrl: raw.url,
    store: "android",
  };
}

export const getAndroidApp = unstable_cache(
  fetchAndroidApp,
  ["android-app"],
  { revalidate: 3600 }
);
