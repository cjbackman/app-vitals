import "server-only";
import { unstable_cache } from "next/cache";
import gplay from "google-play-scraper";
import type { AppData, AppPrice } from "@/types/app-data";
import { AppNotFoundError, StoreScraperError, validateStoreUrl } from "@/lib/store-errors";

export { AppNotFoundError, StoreScraperError };

const ANDROID_STORE_HOSTNAMES = ["play.google.com"];

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
      throw new AppNotFoundError(appId, "Google Play");
    }
    throw new StoreScraperError("Google Play", err);
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
    storeUrl: validateStoreUrl(raw.url, ANDROID_STORE_HOSTNAMES),
    store: "android",
  };
}

export const getAndroidApp = unstable_cache(
  fetchAndroidApp,
  ["android-app"],
  { revalidate: 3600 }
);
