import type {
  AsoData,
  GooglePlayAsoData,
  AppStoreAsoData,
} from "../../../../types/aso/index.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../../../../types/aso/index.js";
import {
  DEFAULT_LOCALE,
  type UnifiedLocale,
} from "../../../../constants/unified-locales.js";
import {
  unifiedToGooglePlay,
  unifiedToAppStore,
} from "../../../../utils/locale-converter.js";

/**
 * Prepare ASO data for pushing to stores
 * - Keeps screenshot paths (relative paths stored in aso-data.json)
 * - Sets contactWebsite (Google Play) and marketingUrl (App Store) to detail page URL
 */
export function prepareAsoDataForPush(
  slug: string,
  configData: AsoData
): Partial<AsoData> {
  const storeData: Partial<AsoData> = {};

  // Generate detail page URL
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://labs.quartz.best";
  const detailPageUrl = `${baseUrl}/${slug}`;

  if (configData.googlePlay) {
    const googlePlayData = configData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };

    const cleanedLocales: Record<UnifiedLocale, GooglePlayAsoData> = {} as Record<
      UnifiedLocale,
      GooglePlayAsoData
    >;
    for (const [locale, localeData] of Object.entries(locales)) {
      // Keep screenshots with relative paths
      cleanedLocales[locale as UnifiedLocale] = {
        ...localeData,
      };
    }

    // Convert unified locale keys to Google Play locale keys
    const convertedLocales: Record<string, GooglePlayAsoData> = {};
    // Get youtubeUrl from multilingual data (app-level)
    const youtubeUrl = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.youtubeUrl
      : (googlePlayData as GooglePlayAsoData).video || undefined;

    for (const [unifiedLocale, localeData] of Object.entries(cleanedLocales)) {
      const googlePlayLocale = unifiedToGooglePlay(
        unifiedLocale as UnifiedLocale
      );
      if (googlePlayLocale !== null) {
        // Update defaultLanguage field to use Google Play locale code
        // Add video field from app-level youtubeUrl for each locale
        convertedLocales[googlePlayLocale] = {
          ...localeData,
          defaultLanguage: googlePlayLocale,
          video: youtubeUrl,
        };
      }
    }

    // screenshots are now stored with relative paths in aso-data.json
    const googleDefaultLocale = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.defaultLocale || DEFAULT_LOCALE
      : googlePlayData.defaultLanguage || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToGooglePlay(googleDefaultLocale as UnifiedLocale) ||
      googleDefaultLocale;
    storeData.googlePlay = {
      locales: convertedLocales,
      defaultLocale: convertedDefaultLocale,
      // App-level contact information (from multilingual data)
      contactEmail: isGooglePlayMultilingual(googlePlayData)
        ? googlePlayData.contactEmail
        : undefined,
      contactWebsite: detailPageUrl, // Set to detail page URL
      youtubeUrl: isGooglePlayMultilingual(googlePlayData)
        ? googlePlayData.youtubeUrl
        : (googlePlayData as GooglePlayAsoData).video || undefined,
    };
  }

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    const cleanedLocales: Record<UnifiedLocale, AppStoreAsoData> = {} as Record<
      UnifiedLocale,
      AppStoreAsoData
    >;
    for (const [locale, localeData] of Object.entries(locales)) {
      // Keep screenshots with relative paths
      cleanedLocales[locale as UnifiedLocale] = {
        ...localeData,
      };
    }

    // Convert unified locale keys to App Store locale keys
    const convertedLocales: Record<string, AppStoreAsoData> = {};
    // Get app-level URLs from multilingual data
    const appLevelSupportUrl = isAppStoreMultilingual(appStoreData)
      ? appStoreData.supportUrl
      : undefined;
    const appLevelMarketingUrl = detailPageUrl; // Always use detail page URL for marketingUrl

    for (const [unifiedLocale, localeData] of Object.entries(cleanedLocales)) {
      const appStoreLocale = unifiedToAppStore(unifiedLocale as UnifiedLocale);
      if (appStoreLocale !== null) {
        // Update locale field to use App Store locale code
        // Add supportUrl and marketingUrl from app-level for each locale
        convertedLocales[appStoreLocale] = {
          ...localeData,
          locale: appStoreLocale,
          supportUrl: appLevelSupportUrl,
          marketingUrl: appLevelMarketingUrl,
        };
      }
    }

    // screenshots are now stored with relative paths in aso-data.json
    const appStoreDefaultLocale = isAppStoreMultilingual(appStoreData)
      ? appStoreData.defaultLocale || DEFAULT_LOCALE
      : appStoreData.locale || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToAppStore(appStoreDefaultLocale as UnifiedLocale) ||
      appStoreDefaultLocale;
    storeData.appStore = {
      locales: convertedLocales,
      defaultLocale: convertedDefaultLocale,
      // App-level contact information (from multilingual data)
      contactEmail: isAppStoreMultilingual(appStoreData)
        ? appStoreData.contactEmail
        : undefined,
      supportUrl: isAppStoreMultilingual(appStoreData)
        ? appStoreData.supportUrl
        : undefined,
      marketingUrl: detailPageUrl, // Set to detail page URL
      privacyPolicyUrl: isAppStoreMultilingual(appStoreData)
        ? appStoreData.privacyPolicyUrl
        : undefined,
      termsUrl: isAppStoreMultilingual(appStoreData)
        ? appStoreData.termsUrl
        : undefined,
    };
  }

  return storeData;
}
