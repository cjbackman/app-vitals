import { type NextRequest, NextResponse } from "next/server";
import { saveSnapshot, getSnapshots } from "@/lib/snapshots";
import { APP_ID_PATTERN, MAX_APP_ID_LENGTH } from "@/lib/make-store-handler";

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
    const snapshots = getSnapshots(store, appId);
    return NextResponse.json(snapshots);
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve snapshots", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Body must be an object", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;

  if (
    !isValidStore(b.store) ||
    !isValidAppId(b.appId) ||
    typeof b.score !== "number" ||
    !Number.isFinite(b.score) ||
    b.score < 0 ||
    b.score > 5 ||
    typeof b.reviewCount !== "number" ||
    !Number.isFinite(b.reviewCount) ||
    b.reviewCount < 0
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields: store, appId, score (0–5), reviewCount (≥0)", code: "INVALID_SNAPSHOT_PARAMS" },
      { status: 400 }
    );
  }

  const minInstalls =
    typeof b.minInstalls === "number" && Number.isFinite(b.minInstalls) && b.minInstalls >= 0
      ? b.minInstalls
      : undefined;

  try {
    const snapshot = saveSnapshot(b.store, b.appId, b.score, b.reviewCount, minInstalls);
    return NextResponse.json(snapshot, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save snapshot", code: "SCRAPER_ERROR" },
      { status: 500 }
    );
  }
}
