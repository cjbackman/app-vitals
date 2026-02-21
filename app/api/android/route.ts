import { makeStoreHandler } from "@/lib/make-store-handler";
import { getAndroidApp } from "@/lib/android-store";

// Cap serverless function runtime so hung scraper calls don't hold slots indefinitely
export const maxDuration = 15;

export const GET = makeStoreHandler(getAndroidApp, "api/android");
