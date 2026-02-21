import { type NextRequest, NextResponse } from "next/server";
import type { AppData } from "@/types/app-data";
import { AppNotFoundError, StoreScraperError } from "@/lib/store-errors";

const APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_APP_ID_LENGTH = 256;

/**
 * Returns a Next.js GET route handler for a store scraper.
 *
 * Handles: input validation (pattern + length), calling the fetcher with an
 * explicit country so unstable_cache keys include it, typed error → HTTP
 * status mapping, and Cache-Control headers aligned with the 1-hour cache TTL.
 */
export function makeStoreHandler(
  fetcher: (appId: string, country: string) => Promise<AppData>,
  logPrefix: string
) {
  return async function GET(request: NextRequest) {
    const appId = request.nextUrl.searchParams.get("appId");

    if (!appId || appId.length > MAX_APP_ID_LENGTH || !APP_ID_PATTERN.test(appId)) {
      return NextResponse.json(
        { error: "Missing or invalid appId parameter", code: "INVALID_APP_ID" },
        { status: 400 }
      );
    }

    try {
      // Pass country explicitly so unstable_cache includes it in the cache key.
      // Country selection is not yet user-facing; hardcoded to "us" for now.
      const data = await fetcher(appId, "us");
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60",
        },
      });
    } catch (err) {
      if (err instanceof AppNotFoundError) {
        return NextResponse.json(
          { error: "App not found", code: err.code },
          { status: 404 }
        );
      }
      if (err instanceof StoreScraperError) {
        console.error(`[${logPrefix}] scraper error:`, err.cause);
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 502 }
        );
      }
      console.error(`[${logPrefix}] unexpected error:`, err);
      return NextResponse.json(
        { error: "Unexpected error", code: "SCRAPER_ERROR" },
        { status: 502 }
      );
    }
  };
}
