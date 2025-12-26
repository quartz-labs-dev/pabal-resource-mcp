/**
 * Site data type definitions
 * Structure for public/site/ directory
 * - config.json: Site configuration (supported locales, default locale)
 * - contacts.json: Contact information
 * - locales/en-US.json: Localized content (meta, hero, developer)
 */

import type { UnifiedLocale } from "../constants/unified-locales.js";

/**
 * Site configuration for locale support
 * Stored in public/site/config.json
 */
export interface SiteConfig {
  /** List of locales supported by this site */
  supportedLocales: UnifiedLocale[];
  /** Default locale for fallback */
  defaultLocale: UnifiedLocale;
}

/**
 * Locale display information for UI components
 */
export interface LocaleDisplayInfo {
  /** Locale code (e.g., "en-US", "ko-KR") */
  code: UnifiedLocale;
  /** English name of the language */
  name: string;
  /** Native name of the language */
  nativeName: string;
  /** Flag emoji */
  flag: string;
}

export interface SiteData {
  meta: {
    title: string;
    description: string;
  };
  hero: {
    brand: string;
    tagline: string;
    subtitle: string;
  };
  contacts: { id: string; label: string; icon: string; value: string }[];
  developer: {
    name: string;
    heading: string;
    role: string;
    bio: string;
    principles: string[];
    stack: string[];
    now: string;
    availability: string;
    likes: string[];
    location?: string;
    timezone?: string;
    visited: {
      countries: {
        code: string;
        name: string;
        flagEmoji: string;
        cities: string[];
      }[];
    };
  };
}


