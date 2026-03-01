import { type NextRequest, NextResponse } from "next/server";
import { getSnapshots } from "@/lib/snapshots";
import { APP_ID_PATTERN, MAX_APP_ID_LENGTH } from "@/lib/make-store-handler";

export const runtime = "nodejs";

function isValidStore(value: unknown): value is "ios" | "android" {
  return value === "ios" || value === "android";
}

function isValidAppId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_APP_ID_LENGTH &&
    APP_ID_PATTERN.test(value)
  );
}

export async function GET(request: NextRequest) {
  const store = request.nextUrl.searchParams.get("store");
  const appId = request.nextUrl.searchParams.get("appId");

  if (!isValidStore(store) || !isValidAppId(appId)) {
    return NextResponse.json(
      { error: "Missing or invalid store/appId parameters", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  try {
    const snapshots = await getSnapshots(store, appId);
    return NextResponse.json(snapshots);
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve snapshots", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}
