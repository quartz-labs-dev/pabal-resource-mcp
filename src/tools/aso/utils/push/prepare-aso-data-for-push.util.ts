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
 * - Converts unified locale keys to store-specific locale keys
 * - Preserves all original data including screenshots
 * - Adds video, contactWebsite, App Store URLs to each locale (from config)
 */
export function prepareAsoDataForPush(configData: AsoData): Partial<AsoData> {
  const storeData: Partial<AsoData> = {};

  if (configData.googlePlay) {
    const googlePlayData = configData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };

    // Get app-level youtubeUrl
    const youtubeUrl = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.youtubeUrl
      : (googlePlayData as GooglePlayAsoData).video || undefined;

    // Convert unified locale keys to Google Play locale keys
    const convertedLocales: Record<string, GooglePlayAsoData> = {};
    for (const [unifiedLocale, localeData] of Object.entries(locales)) {
      const googlePlayLocale = unifiedToGooglePlay(
        unifiedLocale as UnifiedLocale
      );
      if (googlePlayLocale !== null) {
        // Preserve all original data + add video from app-level youtubeUrl
        convertedLocales[googlePlayLocale] = {
          ...localeData,
          defaultLanguage: googlePlayLocale,
          video: localeData.video || youtubeUrl,
        };
      }
    }

    const googleDefaultLocale = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.defaultLocale || DEFAULT_LOCALE
      : googlePlayData.defaultLanguage || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToGooglePlay(googleDefaultLocale as UnifiedLocale) ||
      googleDefaultLocale;

    storeData.googlePlay = {
      locales: convertedLocales,
      defaultLocale: convertedDefaultLocale,
      // App-level contact information
      contactEmail: isGooglePlayMultilingual(googlePlayData)
        ? googlePlayData.contactEmail
        : undefined,
      contactWebsite: isGooglePlayMultilingual(googlePlayData)
        ? googlePlayData.contactWebsite
        : undefined,
      youtubeUrl: youtubeUrl,
    };
  }

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    // Get app-level URLs from config. App Store Connect accepts supportUrl and
    // marketingUrl on version localizations, while privacyPolicyUrl is app-info
    // level. We keep the values both at app level and locale level so downstream
    // push tools can choose the correct API boundary without dropping data.
    const appLevelSupportUrl = isAppStoreMultilingual(appStoreData)
      ? appStoreData.supportUrl
      : undefined;
    const appLevelMarketingUrl = isAppStoreMultilingual(appStoreData)
      ? appStoreData.marketingUrl
      : undefined;
    const appLevelPrivacyPolicyUrl = isAppStoreMultilingual(appStoreData)
      ? appStoreData.privacyPolicyUrl
      : undefined;
    const appLevelTermsUrl = isAppStoreMultilingual(appStoreData)
      ? appStoreData.termsUrl
      : undefined;

    // Convert unified locale keys to App Store locale keys
    const convertedLocales: Record<string, AppStoreAsoData> = {};
    for (const [unifiedLocale, localeData] of Object.entries(locales)) {
      const appStoreLocale = unifiedToAppStore(unifiedLocale as UnifiedLocale);
      if (appStoreLocale !== null) {
        // Preserve all original data + add app-level URLs as locale fallbacks.
        convertedLocales[appStoreLocale] = {
          ...localeData,
          locale: appStoreLocale,
          supportUrl: localeData.supportUrl || appLevelSupportUrl,
          marketingUrl: localeData.marketingUrl || appLevelMarketingUrl,
          privacyPolicyUrl:
            localeData.privacyPolicyUrl || appLevelPrivacyPolicyUrl,
          termsUrl: localeData.termsUrl || appLevelTermsUrl,
        };
      }
    }

    const appStoreDefaultLocale = isAppStoreMultilingual(appStoreData)
      ? appStoreData.defaultLocale || DEFAULT_LOCALE
      : appStoreData.locale || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToAppStore(appStoreDefaultLocale as UnifiedLocale) ||
      appStoreDefaultLocale;

    storeData.appStore = {
      locales: convertedLocales,
      defaultLocale: convertedDefaultLocale,
      // App-level contact information
      contactEmail: isAppStoreMultilingual(appStoreData)
        ? appStoreData.contactEmail
        : undefined,
      supportUrl: appLevelSupportUrl,
      marketingUrl: appLevelMarketingUrl,
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
