import type { LandingPageLocale } from "./landingPage.types.js";

export interface AsoTemplate {
  intro: string;
  keyFeaturesHeading?: string;
  featuresHeading?: string;
  outro: string;
  includeSupportLinks?: boolean;
}

export interface AsoLocaleContent {
  title?: string;
  subtitle?: string;
  shortDescription?: string;
  keywords?: string[] | string;
  template?: AsoTemplate;
}

/** Store platform a locale override applies to. */
export type ProductLocalePlatform = "ios" | "android";

export interface ProductLocalePlatformScreenshotOverride {
  title?: string;
  description?: string;
}

export interface ProductLocalePlatformFeatureOverride {
  title?: string;
  body?: string;
  iconName?: string;
  iconPath?: string;
  badge?: string;
}

/**
 * List overrides merge by index: `null` keeps the shared entry, and the
 * override's length wins so a platform can also drop trailing entries.
 */
export interface ProductLocalePlatformLandingOverride {
  hero?: LandingPageLocale["hero"];
  screenshots?: {
    title?: string;
    images?: (ProductLocalePlatformScreenshotOverride | null)[];
  };
  features?: {
    title?: string;
    items?: (ProductLocalePlatformFeatureOverride | null)[];
  };
  reviews?: LandingPageLocale["reviews"];
  cta?: LandingPageLocale["cta"];
}

/**
 * Narrows the shared locale copy for one store. Anything omitted falls back to
 * the shared `aso`/`landing` values.
 */
export interface ProductLocalePlatformOverride {
  aso?: AsoLocaleContent;
  landing?: ProductLocalePlatformLandingOverride;
}

export interface ProductLocale {
  aso?: AsoLocaleContent;
  landing?: LandingPageLocale;
  /**
   * Per-store overrides. The App Store reads `ios`, Google Play reads
   * `android`, and product detail pages render the `ios` result.
   */
  platforms?: Partial<
    Record<ProductLocalePlatform, ProductLocalePlatformOverride>
  >;
}
