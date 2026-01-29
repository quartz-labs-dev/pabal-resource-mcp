/**
 * ASO (App Store Optimization) data type definitions
 */

import {
  UNIFIED_LOCALES,
  APP_STORE_SUPPORTED_LOCALES,
  GOOGLE_PLAY_SUPPORTED_LOCALES,
  type UnifiedLocale,
} from "../../constants/unified-locales.js";
import type { androidpublisher_v3 } from "@googleapis/androidpublisher";
import type {
  AppInfoLocalizationAttributes,
  AppStoreVersionAttributes,
  AppStoreVersionLocalizationAttributes,
  ScreenshotDisplayType,
} from "appstore-connect-sdk/openapi";

/**
 * Unified locale type used across the application
 * This type represents the unified locale codes used in /locales directory
 */
export type SupportedLocale = UnifiedLocale;

/**
 * App Store Connect specific locale type
 */
export type AppStoreLocale = (typeof APP_STORE_SUPPORTED_LOCALES)[number];

/**
 * Google Play Console specific locale type
 */
export type GooglePlayLocale = (typeof GOOGLE_PLAY_SUPPORTED_LOCALES)[number];

/**
 * Check if locale is supported by our unified system
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return UNIFIED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Check if locale is supported by App Store
 */
export function isAppStoreLocale(locale: string): locale is AppStoreLocale {
  return APP_STORE_SUPPORTED_LOCALES.includes(locale as AppStoreLocale);
}

/**
 * Check if locale is supported by Google Play
 */
export function isGooglePlayLocale(locale: string): locale is GooglePlayLocale {
  return GOOGLE_PLAY_SUPPORTED_LOCALES.includes(locale as GooglePlayLocale);
}

// ============================================================================
// ASO Data Type Definitions
// ============================================================================

/**
 * Google Play Android Publisher base types
 */
export type GooglePlayListing = androidpublisher_v3.Schema$Listing;
export type GooglePlayImageType = NonNullable<
  androidpublisher_v3.Params$Resource$Edits$Images$List["imageType"]
>;
export type GooglePlayScreenshotType = Extract<
  GooglePlayImageType,
  | "phoneScreenshots"
  | "sevenInchScreenshots"
  | "tenInchScreenshots"
  | "tvScreenshots"
  | "wearScreenshots"
>;

/**
 * Google Play screenshots keyed by Android Publisher imageType
 * Includes legacy aliases for existing data structures
 */
export interface GooglePlayScreenshots
  extends Partial<Record<GooglePlayScreenshotType, string[]>> {
  phone?: string[];
  tablet?: string[];
  tablet7?: string[];
  tablet10?: string[];
  tv?: string[];
  wear?: string[];
}

/**
 * Google Play Store ASO data
 */
export interface GooglePlayAsoData
  extends Pick<GooglePlayListing, "video" | "language"> {
  // Basic information (aligned with Android Publisher Listing schema)
  title: NonNullable<GooglePlayListing["title"]>; // App title (max 50 characters)
  shortDescription: NonNullable<GooglePlayListing["shortDescription"]>; // Short description (max 80 characters)
  fullDescription: NonNullable<GooglePlayListing["fullDescription"]>; // Full description (max 4000 characters)

  // Screenshots and media
  screenshots: GooglePlayScreenshots;
  featureGraphic?: string; // Feature Graphic URL
  promoGraphic?: string; // Promo Graphic URL

  // Category and classification
  category?: string; // App category
  contentRating?: string; // Content rating

  // Keywords and search optimization
  keywords?: string[]; // Keywords (extracted from title/description in Google Play)

  // Contact information
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;

  // Other
  packageName: string; // App package name (e.g., com.quartz.pixeltimer)
  defaultLanguage: string; // Default language code (e.g., en-US)
}

/**
 * Google Play release notes (per version)
 */
export type GooglePlayReleaseNote = androidpublisher_v3.Schema$TrackRelease;

/**
 * App Store release notes (per version)
 */
export type AppStoreReleaseNote = Pick<
  AppStoreVersionAttributes,
  "versionString" | "platform"
> & {
  releaseNotes: Record<
    string,
    NonNullable<AppStoreVersionLocalizationAttributes["whatsNew"]>
  >; // Release notes per locale (whatsNew)
  releaseDate?: string; // Release date (ISO 8601)
};

/**
 * App Store Connect base types
 */
export type AppStoreInfoLocalization = AppInfoLocalizationAttributes;
export type AppStoreVersionLocalization = AppStoreVersionLocalizationAttributes;
export type AppStoreScreenshotDisplayType = ScreenshotDisplayType;

/**
 * App Store screenshots keyed by official display type
 * Includes legacy aliases used in existing data structures
 */
export interface AppStoreScreenshots
  extends Partial<Record<AppStoreScreenshotDisplayType, string[]>> {
  iphone65?: string[]; // APP_IPHONE_65
  iphone61?: string[]; // APP_IPHONE_61
  iphone58?: string[]; // APP_IPHONE_58
  iphone55?: string[]; // APP_IPHONE_55
  iphone47?: string[]; // APP_IPHONE_47
  iphone40?: string[]; // APP_IPHONE_40
  ipadPro129?: string[]; // APP_IPAD_PRO_129
  ipadPro11?: string[]; // APP_IPAD_PRO_3GEN_11
  ipad105?: string[]; // APP_IPAD_105
  ipad97?: string[]; // APP_IPAD_97
  appleWatch?: string[]; // APP_WATCH_SERIES_7 (alias)
}

/**
 * App Store ASO data
 */
export interface AppStoreAsoData {
  // Basic information (aligned with App Store Connect localization schemas)
  name: NonNullable<AppStoreInfoLocalization["name"]>; // App name (max 30 characters)
  subtitle?: AppStoreInfoLocalization["subtitle"]; // Subtitle (max 30 characters)
  description: NonNullable<AppStoreVersionLocalization["description"]>; // Description (max 4000 characters)
  keywords?: AppStoreVersionLocalization["keywords"]; // Keywords (comma-separated, max 100 characters)
  promotionalText?: AppStoreVersionLocalization["promotionalText"]; // Promotional text (max 170 characters)

  // Screenshots and media
  screenshots: AppStoreScreenshots;
  appPreview?: string[]; // App preview video URLs

  // Category and classification
  primaryCategory?: string; // Primary category
  secondaryCategory?: string; // Secondary category
  contentRightId?: string; // Content rights ID

  // Contact information
  supportUrl?: AppStoreVersionLocalization["supportUrl"];
  marketingUrl?: AppStoreVersionLocalization["marketingUrl"];
  privacyPolicyUrl?: AppStoreInfoLocalization["privacyPolicyUrl"];
  termsUrl?: string; // Terms of Use URL

  // Other
  bundleId: string; // Bundle ID (e.g., com.quartz.pixeltimer)
  locale: NonNullable<AppStoreVersionLocalization["locale"]>; // Locale (e.g., en-US)
  whatsNew?: AppStoreVersionLocalization["whatsNew"]; // Release notes (latest version)
}

/**
 * Multilingual Google Play ASO data
 */
export interface GooglePlayMultilingualAsoData {
  locales: {
    [locale: string]: GooglePlayAsoData;
  };
  defaultLocale?: string;
  // App-level contact information (shared across all locales)
  contactEmail?: string;
  contactWebsite?: string;
  youtubeUrl?: string;
}

/**
 * Multilingual App Store ASO data
 */
export interface AppStoreMultilingualAsoData {
  locales: {
    [locale: string]: AppStoreAsoData;
  };
  defaultLocale?: string;
  // App-level contact information (shared across all locales)
  contactEmail?: string;
  supportUrl?: string;
  marketingUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

/**
 * Unified ASO data (format stored in local config.json)
 * Supports single language (legacy compatible) or multilingual structure
 */
export interface AsoData {
  googlePlay?: GooglePlayAsoData | GooglePlayMultilingualAsoData;
  appStore?: AppStoreAsoData | AppStoreMultilingualAsoData;
  lastSynced?: {
    googlePlay?: string; // ISO 8601 date
    appStore?: string; // ISO 8601 date
  };
}

/**
 * Check if Google Play data is multilingual structure
 */
export function isGooglePlayMultilingual(
  data: GooglePlayAsoData | GooglePlayMultilingualAsoData | undefined
): data is GooglePlayMultilingualAsoData {
  return data !== undefined && "locales" in data;
}

/**
 * Check if App Store data is multilingual structure
 */
export function isAppStoreMultilingual(
  data: AppStoreAsoData | AppStoreMultilingualAsoData | undefined
): data is AppStoreMultilingualAsoData {
  return data !== undefined && "locales" in data;
}
