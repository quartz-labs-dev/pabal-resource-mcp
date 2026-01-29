import type { LayoutColors } from "./app-pages.types.js";
import type { LandingPage } from "./landingPage.types.js";

/**
 * Product Config JSON file type definitions
 * Structure for public/products/{slug}/config.json
 */

/**
 * Screenshot metadata
 */
export interface ProductScreenshots {
  phone?: string[];
  tablet?: string[];
}

/**
 * Product Metadata (store-common metadata)
 */
export interface ProductMetadata {
  category?: string;
  contactEmail?: string;
  instagram?: string;
  supportUrl?: string;
  marketingUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  youtubeUrl?: string;
  screenshots?: ProductScreenshots;
  featureGraphic?: string;
}

/**
 * Product Content settings
 */
export interface ProductContent {
  defaultLocale?: string;
}

/**
 * Product Config (complete config.json structure)
 *
 * Based on actual config.json file structure,
 * includes additional fields used by existing code.
 */
export interface ProductConfig {
  // Required fields
  slug: string;

  // Sorting and identification
  order?: number;
  appStoreAppId?: string;
  packageName?: string;
  bundleId?: string;
  isHiddenAtHomepage?: boolean;

  // Styling
  layoutColors?: LayoutColors;

  // Metadata (exists in actual config.json)
  metadata?: ProductMetadata;

  // Content settings (exists in actual config.json)
  content?: ProductContent;

  // Legacy/optional fields (used in code but may not exist in config.json)
  name?: string;
  tagline?: string;
  webUrl?: string;
  hasDetailPage?: boolean;
  isDarkIcon?: boolean;
  landing?: LandingPage;
}
