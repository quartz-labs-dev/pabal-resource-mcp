/**
 * ASO Data Converter
 *
 * config.json (source of truth) ↔ aso-data.json (build artifact) 변환 유틸리티
 */

import fs from "node:fs";
import path from "node:path";
import type {
  AsoData,
  GooglePlayAsoData,
  GooglePlayMultilingualAsoData,
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
} from "../types/aso/index.js";
import {
  isGooglePlayLocale,
  isAppStoreLocale,
  isSupportedLocale,
} from "../types/aso/index.js";
import { DEFAULT_LOCALE } from "../constants/unified-locales.js";
import { getPushDataDir, getProductsDir } from "./config.util.js";
import type {
  AsoLocaleContent,
  ProductConfig,
  ProductLocale,
  ProductMetadata,
  ProductScreenshots,
} from "../types/products/index.js";

/**
 * Generate full description from locale data and metadata
 */
function generateFullDescription(
  localeData: ProductLocale,
  metadata: ProductMetadata = {}
): string {
  const { aso, landing } = localeData;
  const template = aso?.template;

  if (!template) {
    return "";
  }

  const landingFeatures = landing?.features?.items || [];
  const landingScreenshots = landing?.screenshots?.images || [];
  const keyHeading = template.keyFeaturesHeading || "Key Features";
  const featuresHeading = template.featuresHeading || "Additional Features";

  const parts = [template.intro];

  if (landingFeatures.length > 0) {
    parts.push(
      "",
      keyHeading,
      "",
      ...landingFeatures.map((feature) =>
        [feature.title, feature.body || ""].filter(Boolean).join("\n")
      )
    );
  }

  if (landingScreenshots.length > 0) {
    parts.push("", featuresHeading, "");

    parts.push(
      ...landingScreenshots.map((screenshot) =>
        [screenshot.title, screenshot.description || ""]
          .filter(Boolean)
          .join("\n")
      )
    );
  }

  parts.push("", template.outro);

  const includeSupport = template.includeSupportLinks ?? true;
  if (includeSupport) {
    const contactLines: string[] = [
      metadata.instagram ? `Instagram: ${metadata.instagram}` : null,
      metadata.contactEmail ? `Email: ${metadata.contactEmail}` : null,
      metadata.termsUrl ? `- Terms of Use: ${metadata.termsUrl}` : null,
      metadata.privacyUrl ? `- Privacy Policy: ${metadata.privacyUrl}` : null,
    ].filter((line): line is string => line !== null);

    if (contactLines.length > 0) {
      parts.push("", "[Contact & Support]", "", ...contactLines);
    }
  }

  return parts.join("\n");
}

/**
 * config.json에서 ASO 데이터를 읽어옵니다
 * 새 구조: config.json (메타데이터) + locales/{locale}.json (콘텐츠)
 */
export function loadAsoFromConfig(slug: string): AsoData {
  const productsDir = getProductsDir();
  const configPath = path.join(productsDir, slug, "config.json");

  // Debug: Log paths for troubleshooting
  console.debug(`[loadAsoFromConfig] Looking for ${slug}:`);
  console.debug(`  - productsDir: ${productsDir}`);
  console.debug(`  - configPath: ${configPath}`);
  console.debug(`  - configPath exists: ${fs.existsSync(configPath)}`);

  if (!fs.existsSync(configPath)) {
    console.warn(`[loadAsoFromConfig] Config file not found at ${configPath}`);
    return {};
  }

  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent) as ProductConfig;

    // Load locales from separate files
    const localesDir = path.join(productsDir, slug, "locales");

    console.debug(`  - localesDir: ${localesDir}`);
    console.debug(`  - localesDir exists: ${fs.existsSync(localesDir)}`);

    if (!fs.existsSync(localesDir)) {
      console.warn(
        `[loadAsoFromConfig] Locales directory not found at ${localesDir}`
      );
      return {};
    }

    // Load all locale files
    const localeFiles = fs
      .readdirSync(localesDir)
      .filter((f) => f.endsWith(".json"));
    const locales: Record<string, ProductLocale> = {};

    for (const file of localeFiles) {
      const localeCode = file.replace(".json", "");
      const localePath = path.join(localesDir, file);
      const localeContent = fs.readFileSync(localePath, "utf-8");
      locales[localeCode] = JSON.parse(localeContent) as ProductLocale;
    }

    // Debug: Log loaded locales
    console.debug(
      `  - Found ${Object.keys(locales).length} locale file(s): ${Object.keys(
        locales
      ).join(", ")}`
    );
    if (Object.keys(locales).length === 0) {
      console.warn(
        `[loadAsoFromConfig] No locale files found in ${localesDir}`
      );
    }

    const defaultLocale = config.content?.defaultLocale || DEFAULT_LOCALE;
    const asoData: AsoData = {};

    // Google Play 데이터 생성
    if (config.packageName) {
      const googlePlayLocales: Record<string, GooglePlayAsoData> = {};
      const metadata: ProductMetadata = config.metadata || {};
      const screenshots: ProductScreenshots = metadata.screenshots || {};

      for (const [locale, localeData] of Object.entries(locales)) {
        // First check if locale is a valid unified locale
        if (!isSupportedLocale(locale)) {
          console.debug(
            `Skipping locale ${locale} - not a valid unified locale`
          );
          continue;
        }
        // Then check if locale is supported by Google Play
        if (!isGooglePlayLocale(locale)) {
          console.debug(
            `Skipping locale ${locale} - not supported by Google Play`
          );
          continue;
        }
        const aso: AsoLocaleContent = localeData.aso || {};

        // Debug: Check if ASO data exists
        if (!aso || (!aso.title && !aso.shortDescription)) {
          console.warn(
            `Locale ${locale} has no ASO data (title or shortDescription)`
          );
        }

        // Add locale to screenshot paths
        const localeScreenshots: typeof screenshots = {
          phone: screenshots.phone?.map((p) =>
            p.replace("/screenshots/", `/screenshots/${locale}/`)
          ),
          tablet: screenshots.tablet?.map((p) =>
            p.replace("/screenshots/", `/screenshots/${locale}/`)
          ),
        };

        googlePlayLocales[locale] = {
          title: aso.title || "",
          shortDescription: aso.shortDescription || "",
          fullDescription: generateFullDescription(localeData, metadata),
          packageName: config.packageName,
          defaultLanguage: locale,
          screenshots: {
            phone: localeScreenshots.phone || [],
            tablet: localeScreenshots.tablet,
          },
          contactEmail: metadata.contactEmail,
        };
      }

      const googleLocaleKeys = Object.keys(googlePlayLocales);
      if (googleLocaleKeys.length > 0) {
        const hasConfigDefault =
          isGooglePlayLocale(defaultLocale) &&
          Boolean(googlePlayLocales[defaultLocale]);
        const resolvedDefault = hasConfigDefault
          ? defaultLocale
          : googlePlayLocales[DEFAULT_LOCALE]
          ? DEFAULT_LOCALE
          : googleLocaleKeys[0];
        asoData.googlePlay = {
          locales: googlePlayLocales,
          defaultLocale: resolvedDefault,
        };
      }
    }

    // App Store 데이터 생성
    if (config.bundleId) {
      const appStoreLocales: Record<string, AppStoreAsoData> = {};
      const metadata: ProductMetadata = config.metadata || {};
      const screenshots: ProductScreenshots = metadata.screenshots || {};

      for (const [locale, localeData] of Object.entries(locales)) {
        // First check if locale is a valid unified locale
        if (!isSupportedLocale(locale)) {
          console.debug(
            `Skipping locale ${locale} - not a valid unified locale`
          );
          continue;
        }
        // Then check if locale is supported by App Store
        if (!isAppStoreLocale(locale)) {
          console.debug(
            `Skipping locale ${locale} - not supported by App Store`
          );
          continue;
        }
        const aso: AsoLocaleContent = localeData.aso || {};

        // Debug: Check if ASO data exists
        if (!aso || (!aso.title && !aso.shortDescription)) {
          console.warn(
            `Locale ${locale} has no ASO data (title or shortDescription)`
          );
        }

        // Add locale to screenshot paths
        const localeScreenshots: typeof screenshots = {
          phone: screenshots.phone?.map((p) =>
            p.replace("/screenshots/", `/screenshots/${locale}/`)
          ),
          tablet: screenshots.tablet?.map((p) =>
            p.replace("/screenshots/", `/screenshots/${locale}/`)
          ),
        };

        appStoreLocales[locale] = {
          name: aso.title || "",
          subtitle: aso.subtitle,
          description: generateFullDescription(localeData, metadata),
          keywords: Array.isArray(aso.keywords)
            ? aso.keywords.join(", ")
            : aso.keywords,
          promotionalText: undefined,
          bundleId: config.bundleId!,
          locale,
          supportUrl: metadata.supportUrl,
          marketingUrl: metadata.marketingUrl,
          privacyPolicyUrl: metadata.privacyUrl,
          screenshots: {
            // 폰 스크린샷을 iphone65로 매핑
            iphone65: localeScreenshots.phone || [],
            // 태블릿 스크린샷을 ipadPro129로 매핑
            ipadPro129: localeScreenshots.tablet,
          },
        };
      }

      const appStoreLocaleKeys = Object.keys(appStoreLocales);
      if (appStoreLocaleKeys.length > 0) {
        const hasConfigDefault =
          isAppStoreLocale(defaultLocale) &&
          Boolean(appStoreLocales[defaultLocale]);
        const resolvedDefault = hasConfigDefault
          ? defaultLocale
          : appStoreLocales[DEFAULT_LOCALE]
          ? DEFAULT_LOCALE
          : appStoreLocaleKeys[0];

        asoData.appStore = {
          locales: appStoreLocales,
          defaultLocale: resolvedDefault,
        };
      }
    }

    // Debug: Log final result
    const hasGooglePlay = !!asoData.googlePlay;
    const hasAppStore = !!asoData.appStore;
    console.debug(`[loadAsoFromConfig] Result for ${slug}:`);
    console.debug(
      `  - Google Play data: ${hasGooglePlay ? "found" : "not found"}`
    );
    console.debug(`  - App Store data: ${hasAppStore ? "found" : "not found"}`);
    if (!hasGooglePlay && !hasAppStore) {
      console.warn(`[loadAsoFromConfig] No ASO data generated for ${slug}`);
    }

    return asoData;
  } catch (error) {
    console.error(
      `[loadAsoFromConfig] Failed to load ASO data from config for ${slug}:`,
      error
    );
    return {};
  }
}

/**
 * config.json에 ASO 데이터를 저장합니다
 */
export function saveAsoToConfig(slug: string, config: ProductConfig): void {
  const productsDir = getProductsDir();
  const configPath = path.join(productsDir, slug, "config.json");

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * ASO 데이터를 지정한 ASO 디렉토리에 저장합니다
 */
export function saveAsoToAsoDir(
  slug: string,
  asoData: AsoData,
  options?: { rootDir?: string }
): void {
  const rootDir = options?.rootDir ?? getPushDataDir();

  // Google Play 데이터 저장
  if (asoData.googlePlay) {
    const asoPath = path.join(
      rootDir,
      "products",
      slug,
      "store",
      "google-play",
      "aso-data.json"
    );

    const dir = path.dirname(asoPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const googlePlayData = asoData.googlePlay;
    const multilingualData: GooglePlayMultilingualAsoData =
      "locales" in googlePlayData
        ? googlePlayData
        : {
            locales: {
              [googlePlayData.defaultLanguage || DEFAULT_LOCALE]:
                googlePlayData,
            },
            defaultLocale: googlePlayData.defaultLanguage || DEFAULT_LOCALE,
          };

    fs.writeFileSync(
      asoPath,
      JSON.stringify({ googlePlay: multilingualData }, null, 2) + "\n",
      "utf-8"
    );
  }

  // App Store 데이터 저장
  if (asoData.appStore) {
    const asoPath = path.join(
      rootDir,
      "products",
      slug,
      "store",
      "app-store",
      "aso-data.json"
    );

    const dir = path.dirname(asoPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const appStoreData = asoData.appStore;
    const multilingualData: AppStoreMultilingualAsoData =
      "locales" in appStoreData
        ? appStoreData
        : {
            locales: {
              [appStoreData.locale || DEFAULT_LOCALE]: appStoreData,
            },
            defaultLocale: appStoreData.locale || DEFAULT_LOCALE,
          };

    fs.writeFileSync(
      asoPath,
      JSON.stringify({ appStore: multilingualData }, null, 2) + "\n",
      "utf-8"
    );
  }
}
