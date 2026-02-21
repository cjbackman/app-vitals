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
}

export const PRESET_APPS: PresetApp[] = [
  {
    name: "Babbel",
    iosId: "829587759",
    androidId: "com.babbel.mobile.android.en",
    iconUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/66/87/3f/66873f01-ba57-4e60-2885-2c03cf94720d/AppIcon-Default-0-0-1x_U007epad-0-1-0-0-85-220.png/100x100bb.jpg",
  },
];
