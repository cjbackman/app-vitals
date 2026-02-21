declare module "app-store-scraper" {
  export interface AppStoreResult {
    id: number;
    appId: string;
    title: string;
    /** Absolute URL to the app icon image */
    icon: string;
    score: number;
    /** Total number of written reviews */
    reviews: number;
    /** Current version string */
    version: string;
    developer: string;
    developerUrl: string;
    developerWebsite?: string;
    /** Numeric price — 0 means free */
    price: number;
    currency: string;
    free: boolean;
    /** ISO 8601 date string */
    updated: string;
    /** Fully-qualified URL to the app's store page */
    url: string;
    description: string;
    releaseNotes?: string;
    primaryGenre: string;
    contentRating: string;
    screenshots: string[];
  }

  export interface AppOptions {
    /** Bundle ID (e.g. com.netflix.Netflix) — preferred over numeric id */
    appId?: string;
    /** Numeric App Store ID */
    id?: number;
    /** ISO 3166-1 alpha-2 country code. Defaults to 'us' */
    country?: string;
    lang?: string;
    /** If true, fetches rating histogram (extra request) */
    ratings?: boolean;
  }

  const store: {
    app(options: AppOptions): Promise<AppStoreResult>;
  };

  export = store;
}
