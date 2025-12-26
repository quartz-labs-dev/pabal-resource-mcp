import type { AsoData } from "../../../../types/aso/index.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../../../../types/aso/index.js";
import { DEFAULT_LOCALE } from "../../../../constants/unified-locales.js";
import { saveAsoToAsoDir } from "../../../../utils/aso-converter.js";
import { getPushDataDir } from "../../../../utils/config.util.js";

/**
 * Save raw ASO data to ASO directory
 */
export function saveRawAsoData(
  slug: string,
  asoData: Partial<AsoData>
): void {
  const rootDir = getPushDataDir();
  saveAsoToAsoDir(slug, asoData);

  const localeCounts: { googlePlay?: number; appStore?: number } = {};

  if (asoData.googlePlay) {
    const googlePlayData = asoData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : { [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData };
    localeCounts.googlePlay = Object.keys(locales).length;
  }

  if (asoData.appStore) {
    const appStoreData = asoData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };
    localeCounts.appStore = Object.keys(locales).length;
  }

  if (localeCounts.googlePlay) {
    console.log(
      `💾 Google Play raw data saved to ${rootDir} (${
        localeCounts.googlePlay
      } locale${localeCounts.googlePlay > 1 ? "s" : ""})`
    );
  }

  if (localeCounts.appStore) {
    console.log(
      `💾 App Store raw data saved to ${rootDir} (${
        localeCounts.appStore
      } locale${localeCounts.appStore > 1 ? "s" : ""})`
    );
  }
}

