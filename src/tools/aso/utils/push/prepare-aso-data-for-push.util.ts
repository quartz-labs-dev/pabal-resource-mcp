import type { AsoData, GooglePlayAsoData, AppStoreAsoData } from "../../../../types/aso/index.js";
import { isGooglePlayMultilingual, isAppStoreMultilingual } from "../../../../types/aso/index.js";
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
 * - Removes screenshots (images are handled separately)
 * - Sets contactWebsite (Google Play) and marketingUrl (App Store) to detail page URL
 * - Removes featureGraphic
 */
export function prepareAsoDataForPush(
  slug: string,
  configData: AsoData
): Partial<AsoData> {
  // Remove screenshot URLs/images from data (keep only structure)
  // Note: screenshots are excluded from metadata, only images are saved separately
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

    type GooglePlayAsoDataWithoutScreenshots = Omit<
      GooglePlayAsoData,
      "screenshots"
    >;
    const cleanedLocales: Record<
      UnifiedLocale,
      GooglePlayAsoDataWithoutScreenshots
    > = {} as Record<UnifiedLocale, GooglePlayAsoDataWithoutScreenshots>;
    for (const [locale, localeData] of Object.entries(locales)) {
      const { screenshots, ...rest } = localeData;
      cleanedLocales[locale as UnifiedLocale] = {
        ...rest,
        featureGraphic: undefined, // Images excluded
      };
    }

    // Convert unified locale keys to Google Play locale keys
    const convertedLocales: Record<
      string,
      GooglePlayAsoDataWithoutScreenshots
    > = {};
    for (const [unifiedLocale, localeData] of Object.entries(cleanedLocales)) {
      const googlePlayLocale = unifiedToGooglePlay(
        unifiedLocale as UnifiedLocale
      );
      if (googlePlayLocale !== null) {
        // Update defaultLanguage field to use Google Play locale code
        convertedLocales[googlePlayLocale] = {
          ...localeData,
          defaultLanguage: googlePlayLocale,
        };
      }
    }

    // screenshots is excluded from metadata (images saved separately)
    // saveAsoToAsoDir accepts Partial<AsoData> so this is safe
    const googleDefaultLocale = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.defaultLocale || DEFAULT_LOCALE
      : googlePlayData.defaultLanguage || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToGooglePlay(googleDefaultLocale as UnifiedLocale) ||
      googleDefaultLocale;
    storeData.googlePlay = {
      locales: convertedLocales as unknown as Record<string, GooglePlayAsoData>,
      defaultLocale: convertedDefaultLocale,
      // App-level contact information (from multilingual data)
      contactEmail: isGooglePlayMultilingual(googlePlayData)
        ? googlePlayData.contactEmail
        : undefined,
      contactWebsite: detailPageUrl, // Set to detail page URL
    };
  }

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    type AppStoreAsoDataWithoutScreenshots = Omit<
      AppStoreAsoData,
      "screenshots"
    >;
    const cleanedLocales: Record<
      UnifiedLocale,
      AppStoreAsoDataWithoutScreenshots
    > = {} as Record<UnifiedLocale, AppStoreAsoDataWithoutScreenshots>;
    for (const [locale, localeData] of Object.entries(locales)) {
      const { screenshots, ...rest } = localeData;
      cleanedLocales[locale as UnifiedLocale] = {
        ...rest,
      };
    }

    // Convert unified locale keys to App Store locale keys
    const convertedLocales: Record<string, AppStoreAsoDataWithoutScreenshots> =
      {};
    for (const [unifiedLocale, localeData] of Object.entries(cleanedLocales)) {
      const appStoreLocale = unifiedToAppStore(unifiedLocale as UnifiedLocale);
      if (appStoreLocale !== null) {
        // Update locale field to use App Store locale code
        convertedLocales[appStoreLocale] = {
          ...localeData,
          locale: appStoreLocale,
        };
      }
    }

    // screenshots is excluded from metadata (images saved separately)
    // saveAsoToAsoDir accepts Partial<AsoData> so this is safe
    const appStoreDefaultLocale = isAppStoreMultilingual(appStoreData)
      ? appStoreData.defaultLocale || DEFAULT_LOCALE
      : appStoreData.locale || DEFAULT_LOCALE;
    const convertedDefaultLocale =
      unifiedToAppStore(appStoreDefaultLocale as UnifiedLocale) ||
      appStoreDefaultLocale;
    storeData.appStore = {
      locales: convertedLocales as unknown as Record<string, AppStoreAsoData>,
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
