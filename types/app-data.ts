export type AppPrice =
  | { type: "free" }
  | { type: "paid"; amount: number; currency: string };

export interface AppData {
  title: string;
  /** Absolute URL to the app icon image */
  icon: string;
  /** Average rating, 0–5 */
  score: number;
  /** Total number of ratings/reviews */
  reviewCount: number;
  /** Current version string. May be "Varies with device" for Android. Do not parse as semver. */
  version: string;
  developer: string;
  price: AppPrice;
  /** ISO 8601 string — safe across the JSON boundary */
  updatedAt: string;
  /** Fully-qualified URL to the app's store page */
  storeUrl: string;
  store: "ios" | "android";
  /** Android-only: minimum install count from Google Play. Not available for iOS. */
  minInstalls?: number;
}

/** A saved snapshot of app metrics at a point in time. */
export interface Snapshot {
  id: number;
  store: "ios" | "android";
  appId: string;
  savedAt: string; // ISO 8601
  score: number;
  reviewCount: number;
  /** Android only; never present on iOS snapshots. */
  minInstalls?: number;
}

export interface ApiError {
  error: string;
  code: "APP_NOT_FOUND" | "SCRAPER_ERROR" | "INVALID_APP_ID" | "INVALID_SNAPSHOT_PARAMS";
}

/** Type guard that narrows AppData | ApiError to ApiError. */
export function isApiError(data: AppData | ApiError): data is ApiError {
  return "error" in data && "code" in data;
}
