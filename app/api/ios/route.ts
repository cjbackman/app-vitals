import { type NextRequest, NextResponse } from "next/server";
import {
  getIosApp,
  AppNotFoundError,
  StoreScraperError,
} from "@/lib/ios-store";

const APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get("appId");

  if (!appId || !APP_ID_PATTERN.test(appId)) {
    return NextResponse.json(
      { error: "Missing or invalid appId parameter", code: "INVALID_APP_ID" },
      { status: 400 }
    );
  }

  try {
    const data = await getIosApp(appId);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AppNotFoundError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 404 }
      );
    }
    if (err instanceof StoreScraperError) {
      console.error("[api/ios] scraper error:", err.cause);
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 502 }
      );
    }
    console.error("[api/ios] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", code: "SCRAPER_ERROR" },
      { status: 502 }
    );
  }
}
