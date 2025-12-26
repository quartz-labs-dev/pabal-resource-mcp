import type { AsoData } from "../../../../types/aso/index.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../../../../types/aso/index.js";

/**
 * Get full description for a specific locale from ASO data
 */
export function getFullDescriptionForLocale(
  asoData: AsoData,
  locale: string
): string | undefined {
  if (asoData.googlePlay) {
    const googlePlayData = asoData.googlePlay;
    if (isGooglePlayMultilingual(googlePlayData)) {
      const localeData = googlePlayData.locales[locale];
      if (localeData?.fullDescription) {
        return localeData.fullDescription;
      }
    } else if (googlePlayData.defaultLanguage === locale) {
      return googlePlayData.fullDescription;
    }
  }

  if (asoData.appStore) {
    const appStoreData = asoData.appStore;
    if (isAppStoreMultilingual(appStoreData)) {
      const localeData = appStoreData.locales[locale];
      if (localeData?.description) {
        return localeData.description;
      }
    } else if (appStoreData.locale === locale) {
      return appStoreData.description;
    }
  }

  return undefined;
}

