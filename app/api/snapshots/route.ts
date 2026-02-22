import { type NextRequest, NextResponse } from "next/server";
import { saveSnapshot, getSnapshots } from "@/lib/snapshots";

const APP_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_APP_ID_LENGTH = 256;

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
      { error: "Missing or invalid store/appId parameters" },
      { status: 400 }
    );
  }

  const snapshots = getSnapshots(store, appId);
  return NextResponse.json(snapshots);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (
    !isValidStore(b.store) ||
    !isValidAppId(b.appId) ||
    typeof b.score !== "number" ||
    typeof b.reviewCount !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields: store, appId, score, reviewCount" },
      { status: 400 }
    );
  }

  const minInstalls =
    typeof b.minInstalls === "number" ? b.minInstalls : undefined;

  const snapshot = saveSnapshot(b.store, b.appId, b.score, b.reviewCount, minInstalls);
  return NextResponse.json(snapshot, { status: 201 });
}
