// Shared error classes and URL validation for store scrapers.
// Both lib/ios-store.ts and lib/android-store.ts re-export from here so that
// instanceof checks in API routes work against a single class identity.

export class AppNotFoundError extends Error {
  readonly code = "APP_NOT_FOUND" as const;
  constructor(appId: string, store: "App Store" | "Google Play") {
    super(`App not found in ${store}: ${appId}`);
  }
}

export class StoreScraperError extends Error {
  readonly code = "SCRAPER_ERROR" as const;
  constructor(store: "App Store" | "Google Play", cause: unknown) {
    super(`${store} scraper failed`);
    this.cause = cause;
  }
}

/**
 * Returns the URL unchanged if it is an HTTPS URL on one of the allowed
 * hostnames, or an empty string otherwise. Prevents javascript: URIs or
 * unexpected origins returned by scrapers from being used as anchor hrefs.
 */
export function validateStoreUrl(url: string, allowedHostnames: string[]): string {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && allowedHostnames.includes(hostname)
      ? url
      : "";
  } catch {
    return "";
  }
}
