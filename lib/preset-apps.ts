export interface PresetApp {
  name: string;
  /** Numeric App Store ID or bundle ID — both accepted by the iOS API route */
  iosId: string;
  /** Google Play package name */
  androidId: string;
  /**
   * Apple CDN artwork URL (100×100).
   * Refresh via: https://itunes.apple.com/lookup?id={iosId} → artworkUrl100
   * URL paths can change when an app updates its icon; update manually if broken.
   */
  iconUrl: string;
  /**
   * Optional brand hex color for sparkline strokes.
   * Omit for apps where the default indigo is acceptable.
   * Format: "#RRGGBB"
   */
  brandColor?: string;
}

export const PRESET_APPS: PresetApp[] = [
  {
    name: "Babbel",
    iosId: "829587759",
    androidId: "com.babbel.mobile.android.en",
    iconUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/66/87/3f/66873f01-ba57-4e60-2885-2c03cf94720d/AppIcon-Default-0-0-1x_U007epad-0-1-0-0-85-220.png/100x100bb.jpg",
    brandColor: "#FF6700",
  },
  {
    name: "Duolingo",
    iosId: "570060128",
    androidId: "com.duolingo",
    iconUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/8c/2e/fc/8c2efc2c-1efc-50ea-a0b1-16ab54db9102/AppIcon-0-0-1x_U007epad-0-1-85-220.png/100x100bb.jpg",
    brandColor: "#58CC02",
  },
  {
    name: "Learna AI",
    iosId: "6478287397",
    androidId: "com.codeway.aitutor",
    iconUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ac/ad/8f/acad8f73-9bb3-7826-c3c3-6fc7510bc322/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/100x100bb.jpg",
    brandColor: "#2B8CE3",
  },
  {
    name: "Speak",
    iosId: "1286609883",
    androidId: "com.selabs.speak",
    iconUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/36/a7/12/36a712a9-44d0-a96d-ea64-5ae345b37a19/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/100x100bb.jpg",
    brandColor: "#2D3FE0",
  },
];
