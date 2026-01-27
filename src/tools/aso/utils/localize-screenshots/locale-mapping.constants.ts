/**
 * Locale Mapping Constants for Screenshot Localization
 *
 * Defines language groups for Gemini API image translation.
 * Key: Gemini locale code (sent to API)
 * Value: UnifiedLocales to save translated images to (file/folder names)
 *
 * Gemini supported languages (source: https://ai.google.dev/gemini-api/docs/image-generation):
 * EN, ar-EG, de-DE, es-MX, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, ua-UA, vi-VN, zh-CN
 */

import { type UnifiedLocale } from "../../../../constants/unified-locales.js";

/**
 * Gemini API supported locale codes for image generation.
 * These are the EXACT codes Gemini expects.
 */
export const GEMINI_TARGET_LOCALES = [
  "en-US", // EN
  "ar-EG",
  "de-DE",
  "es-MX",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pt-BR",
  "ru-RU",
  "ua-UA", // Ukrainian - Gemini uses ua-UA (NOT uk-UA)
  "vi-VN",
  "zh-CN",
] as const;

export type GeminiTargetLocale = (typeof GEMINI_TARGET_LOCALES)[number];

/**
 * Mapping from Gemini locale to UnifiedLocales for saving translated images.
 *
 * Key: GeminiTargetLocale (sent to Gemini API)
 * Value: Array of UnifiedLocales to save the translated image to
 *
 * The first element is the "primary" unified locale for this Gemini locale.
 * Additional elements are similar languages that can use the same translation.
 *
 * Example: "en-US" translation saves to ["en-US", "en-GB", "en-AU", "en-CA", ...]
 */
export const GEMINI_LOCALE_GROUPS: Record<GeminiTargetLocale, UnifiedLocale[]> =
  {
    // English - covers all English variants
    "en-US": ["en-US", "en-AU", "en-CA", "en-GB", "en-IN", "en-SG", "en-ZA"],
    // Arabic - Gemini ar-EG → Unified ar
    "ar-EG": ["ar"],
    // German
    "de-DE": ["de-DE"],
    // Spanish - covers Latin America, Spain, and US Spanish
    "es-MX": ["es-419", "es-ES", "es-US"],
    // French - covers France and Canada
    "fr-FR": ["fr-FR", "fr-CA"],
    // Hindi
    "hi-IN": ["hi-IN"],
    // Indonesian
    "id-ID": ["id-ID"],
    // Italian
    "it-IT": ["it-IT"],
    // Japanese
    "ja-JP": ["ja-JP"],
    // Korean
    "ko-KR": ["ko-KR"],
    // Portuguese - covers Brazil and Portugal
    "pt-BR": ["pt-BR", "pt-PT"],
    // Russian
    "ru-RU": ["ru-RU"],
    // Ukrainian - Gemini ua-UA → Unified uk-UA
    "ua-UA": ["uk-UA"],
    // Vietnamese
    "vi-VN": ["vi-VN"],
    // Chinese - covers Simplified, Traditional, and Hong Kong
    "zh-CN": ["zh-Hans", "zh-Hant", "zh-HK"],
  };

/**
 * Get the Gemini-supported locale for a given UnifiedLocale.
 * Returns the Gemini locale that can translate this language.
 * Returns null if the locale is not supported by Gemini.
 */
export function getGeminiLocale(
  unifiedLocale: string
): GeminiTargetLocale | null {
  for (const [geminiLocale, unifiedLocales] of Object.entries(
    GEMINI_LOCALE_GROUPS
  )) {
    if (unifiedLocales.includes(unifiedLocale as UnifiedLocale)) {
      return geminiLocale as GeminiTargetLocale;
    }
  }
  return null;
}

/**
 * Get the UnifiedLocales that should receive a translated image for a Gemini locale.
 */
export function getOutputLocales(
  geminiLocale: GeminiTargetLocale
): UnifiedLocale[] {
  return GEMINI_LOCALE_GROUPS[geminiLocale] || [];
}

/**
 * Check if a locale can be translated by Gemini
 */
export function isGeminiTranslatable(locale: string): boolean {
  return getGeminiLocale(locale) !== null;
}

/**
 * Filter and prepare locales for translation.
 *
 * Takes a list of UnifiedLocales and returns:
 * - translatableLocales: GeminiTargetLocales that need actual API calls
 * - localeMapping: Map from GeminiTargetLocale to UnifiedLocales for saving
 * - skippedLocales: UnifiedLocales not supported by Gemini
 * - groupedLocales: UnifiedLocales that share translation with others (saved together)
 */
export function prepareLocalesForTranslation(
  locales: string[],
  primaryLocale: string
): {
  translatableLocales: GeminiTargetLocale[];
  localeMapping: Map<GeminiTargetLocale, string[]>;
  skippedLocales: string[];
  groupedLocales: string[];
} {
  // Remove primary locale from targets
  const targetLocales = locales.filter((l) => l !== primaryLocale);

  const localeMapping = new Map<GeminiTargetLocale, string[]>();
  const geminiLocalesNeeded = new Set<GeminiTargetLocale>();
  const skippedLocales: string[] = [];

  // Group target locales by their Gemini representative
  for (const locale of targetLocales) {
    const geminiLocale = getGeminiLocale(locale);

    if (geminiLocale === null) {
      skippedLocales.push(locale);
      continue;
    }

    geminiLocalesNeeded.add(geminiLocale);

    // Track which UnifiedLocales to save for this Gemini locale
    const existing = localeMapping.get(geminiLocale) || [];
    if (!existing.includes(locale)) {
      existing.push(locale);
    }
    localeMapping.set(geminiLocale, existing);
  }

  // Identify grouped locales (locales that share translation with others)
  const groupedLocales: string[] = [];
  for (const [, unifiedLocales] of localeMapping) {
    if (unifiedLocales.length > 1) {
      // All but the first are "grouped" (sharing translation)
      groupedLocales.push(...unifiedLocales.slice(1));
    }
  }

  return {
    translatableLocales: Array.from(geminiLocalesNeeded),
    localeMapping,
    skippedLocales,
    groupedLocales,
  };
}
