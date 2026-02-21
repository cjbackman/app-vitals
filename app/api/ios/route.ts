import { makeStoreHandler } from "@/lib/make-store-handler";
import { getIosApp } from "@/lib/ios-store";

// Cap serverless function runtime so hung scraper calls don't hold slots indefinitely
export const maxDuration = 15;

export const GET = makeStoreHandler(getIosApp, "api/ios");
