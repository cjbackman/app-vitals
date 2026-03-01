import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { PRESET_APPS } from "@/lib/preset-apps";
import { fetchIosApp } from "@/lib/ios-store";
import { fetchAndroidApp } from "@/lib/android-store";
import { saveSnapshot } from "@/lib/snapshots";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const results = await Promise.allSettled(
    PRESET_APPS.flatMap((preset) => [
      fetchIosApp(preset.iosId).then((data) =>
        saveSnapshot("ios", preset.iosId, {
          score: data.score,
          reviewCount: data.reviewCount,
          version: data.version,
        })
      ),
      fetchAndroidApp(preset.androidId).then((data) =>
        saveSnapshot("android", preset.androidId, {
          score: data.score,
          reviewCount: data.reviewCount,
          // "Varies with device" is an Android sentinel that means no single version —
          // normalise to null so it never produces spurious isRelease flags.
          version: data.version === "Varies with device" ? null : data.version,
          minInstalls: data.minInstalls,
        })
      ),
    ])
  );

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason as Error)?.message ?? "unknown");
  const failed = errors.length;
  const saved = results.length - failed;

  return NextResponse.json({ saved, failed, errors });
}
