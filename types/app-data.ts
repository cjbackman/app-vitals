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
}

export interface ApiError {
  error: string;
  code: "APP_NOT_FOUND" | "SCRAPER_ERROR" | "INVALID_APP_ID";
}
