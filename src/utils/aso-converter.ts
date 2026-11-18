/**
 * ASO Data Converter
 *
 * Converts between config.json (source of truth) and aso-data.json (build artifact).
 */

// Import Node.js modules - these will be replaced with empty modules in browser builds
// via package.json "browser" field configuration
import fs from "node:fs";
import path from "node:path";
import type {
  AsoData,
  GooglePlayAsoData,
  GooglePlayMultilingualAsoData,
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
  AppStoreMacAsoData,
} from "../types/aso/index.js";
import {
  isGooglePlayLocale,
  isAppStoreLocale,
  isSupportedLocale,
} from "../types/aso/index.js";
import { DEFAULT_LOCALE } from "../constants/unified-locales.js";
import { getPushDataDir, getProductsDir } from "./config.util.js";
import { resolveProductLocaleForPlatform } from "./product-locale-platform.util.js";
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
        [`▶︎ ${feature.title}`, feature.body || ""].filter(Boolean).join("\n")
      )
    );
  }

  if (landingScreenshots.length > 0) {
    parts.push("", featuresHeading, "");

    parts.push(
      ...landingScreenshots.map((screenshot) =>
        [`▶︎ ${screenshot.title}`, screenshot.description || ""]
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

const SCREENSHOT_FILE_PATTERN = /\.(png|jpe?g|webp)$/i;

const compareScreenshotFileNames = (a: string, b: string): number => {
  const numberA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
  const numberB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);

  return numberA === numberB ? a.localeCompare(b) : numberA - numberB;
};

/**
 * Lists a screenshot directory instead of remapping the hand-maintained config
 * paths, because such a set can hold a different number of images than the
 * shared one. `segments` is the path under `screenshots/{locale}/`: a
 * per-store render is `{platform}/{device}`, a device of its own is `{device}`.
 */
function listScreenshotDirPaths(
  productsDir: string,
  slug: string,
  locale: string,
  segments: string[]
): string[] | undefined {
  const deviceDir = path.join(
    productsDir,
    slug,
    "screenshots",
    locale,
    ...segments
  );

  if (!fs.existsSync(deviceDir)) return undefined;

  const fileNames = fs
    .readdirSync(deviceDir)
    .filter((fileName) => SCREENSHOT_FILE_PATTERN.test(fileName))
    .sort(compareScreenshotFileNames);

  if (fileNames.length === 0) return undefined;

  const dirPath = segments.join("/");

  return fileNames.map(
    (fileName) =>
      `/products/${slug}/screenshots/${locale}/${dirPath}/${fileName}`
  );
}

/**
 * The Mac App Store block for one locale, or undefined when the locale has
 * neither Mac copy nor rendered Mac screenshots. Only what was written for the
 * Mac is carried: the iPhone copy is never copied into it, and a locale whose
 * `mac/` folder is missing gets no screenshot key rather than another
 * locale's set.
 */
function buildMacAsoData(
  localeData: ProductLocale | undefined,
  macScreenshots: string[] | undefined
): AppStoreMacAsoData | undefined {
  const listing = localeData?.platforms?.macos;
  const keywords = Array.isArray(listing?.keywords)
    ? listing.keywords.join(",")
    : listing?.keywords;

  const macData: AppStoreMacAsoData = {
    ...(listing?.description ? { description: listing.description } : {}),
    ...(keywords ? { keywords } : {}),
    ...(listing?.promotionalText
      ? { promotionalText: listing.promotionalText }
      : {}),
    ...(macScreenshots ? { screenshots: { mac: macScreenshots } } : {}),
  };

  return Object.keys(macData).length > 0 ? macData : undefined;
}

/**
 * Read ASO data from config.json.
 * New structure: config.json (metadata) + locales/{locale}.json (content)
 */
export function loadAsoFromConfig(
  slug: string,
  productsDir: string = getProductsDir()
): AsoData {
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
      .filter((f: string) => f.endsWith(".json"));
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

    // Build Google Play data
    if (config.packageName) {
      const googlePlayLocales: Record<string, GooglePlayAsoData> = {};
      const metadata: ProductMetadata = config.metadata || {};
      const screenshots: ProductScreenshots = metadata.screenshots || {};

      for (const [locale, rawLocaleData] of Object.entries(locales)) {
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
        const localeData = resolveProductLocaleForPlatform(
          rawLocaleData,
          "android"
        );
        const aso: AsoLocaleContent = localeData.aso || {};

        // Debug: Check if ASO data exists
        if (!aso || (!aso.title && !aso.shortDescription)) {
          console.warn(
            `Locale ${locale} has no ASO data (title or shortDescription)`
          );
        }

        // Check if screenshots exist for this locale - verify each type separately
        const screenshotsDir = path.join(
          productsDir,
          slug,
          "screenshots",
          locale
        );
        const phoneDir = path.join(screenshotsDir, "phone");
        const tabletDir = path.join(screenshotsDir, "tablet");
        const featureGraphicPath = path.join(
          screenshotsDir,
          "feature-graphic.png"
        );
        const hasPhoneScreenshots = fs.existsSync(phoneDir);
        const hasTabletScreenshots = fs.existsSync(tabletDir);
        const hasFeatureGraphic = fs.existsSync(featureGraphicPath);

        // An Android-only screenshot set wins over the shared one.
        const androidPhonePaths = listScreenshotDirPaths(
          productsDir,
          slug,
          locale,
          ["android", "phone"]
        );
        const androidTabletPaths = listScreenshotDirPaths(
          productsDir,
          slug,
          locale,
          ["android", "tablet"]
        );
        // Wear OS is its own device, Google Play-only, and never shares the
        // Apple Watch set in `watch`.
        const wearOsPaths = listScreenshotDirPaths(productsDir, slug, locale, [
          "wear-os",
        ]);

        // Add locale to screenshot paths only if the specific type directory exists
        const localeScreenshots: typeof screenshots = {
          phone:
            androidPhonePaths ??
            (hasPhoneScreenshots
              ? screenshots.phone?.map((p) =>
                  p.replace(/\/screenshots\/[^/]+\//, `/screenshots/${locale}/`)
                )
              : undefined),
          tablet:
            androidTabletPaths ??
            (hasTabletScreenshots
              ? screenshots.tablet?.map((p) =>
                  p.replace(/\/screenshots\/[^/]+\//, `/screenshots/${locale}/`)
                )
              : undefined),
          // Listed from disk only: the Apple Watch set must never stand in for
          // a missing Wear OS set, so there is no shared-set fallback here.
          wearOs: wearOsPaths,
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
            // Wear OS screenshots are Google Play-only, and stay absent rather
            // than empty for products without a watch app.
            ...(localeScreenshots.wearOs?.length
              ? { wear: localeScreenshots.wearOs }
              : {}),
          },
          featureGraphic: hasFeatureGraphic
            ? `/products/${slug}/screenshots/${locale}/feature-graphic.png`
            : metadata.featureGraphic,
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
          // App-level contact information
          contactEmail: metadata.contactEmail,
          contactWebsite: metadata.supportUrl,
          youtubeUrl: metadata.youtubeUrl,
        };
      }
    }

    // Build App Store data
    if (config.bundleId) {
      const appStoreLocales: Record<string, AppStoreAsoData> = {};
      const metadata: ProductMetadata = config.metadata || {};
      const screenshots: ProductScreenshots = metadata.screenshots || {};

      for (const [locale, rawLocaleData] of Object.entries(locales)) {
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
        const localeData = resolveProductLocaleForPlatform(
          rawLocaleData,
          "ios"
        );
        const aso: AsoLocaleContent = localeData.aso || {};

        // Debug: Check if ASO data exists
        if (!aso || (!aso.title && !aso.shortDescription)) {
          console.warn(
            `Locale ${locale} has no ASO data (title or shortDescription)`
          );
        }

        // Check if screenshots exist for this locale - verify each type separately
        const screenshotsDir = path.join(
          productsDir,
          slug,
          "screenshots",
          locale
        );
        const phoneDir = path.join(screenshotsDir, "phone");
        const tabletDir = path.join(screenshotsDir, "tablet");
        const watchDir = path.join(screenshotsDir, "watch");
        const hasPhoneScreenshots = fs.existsSync(phoneDir);
        const hasTabletScreenshots = fs.existsSync(tabletDir);
        const hasWatchScreenshots = fs.existsSync(watchDir);

        // Add locale to screenshot paths only if the specific type directory exists
        const localeScreenshots: typeof screenshots = {
          phone: hasPhoneScreenshots
            ? screenshots.phone?.map((p) =>
                p.replace(/\/screenshots\/[^/]+\//, `/screenshots/${locale}/`)
              )
            : undefined,
          tablet: hasTabletScreenshots
            ? screenshots.tablet?.map((p) =>
                p.replace(/\/screenshots\/[^/]+\//, `/screenshots/${locale}/`)
              )
            : undefined,
          watch: hasWatchScreenshots
            ? screenshots.watch?.map((p) =>
                p.replace(/\/screenshots\/[^/]+\//, `/screenshots/${locale}/`)
              )
            : undefined,
        };

        const macOS = buildMacAsoData(
          rawLocaleData,
          listScreenshotDirPaths(productsDir, slug, locale, ["mac"])
        );

        appStoreLocales[locale] = {
          name: aso.title || "",
          subtitle: aso.subtitle,
          description: generateFullDescription(localeData, metadata),
          keywords: Array.isArray(aso.keywords)
            ? aso.keywords.join(",")
            : aso.keywords,
          promotionalText: undefined,
          bundleId: config.bundleId!,
          locale,
          screenshots: {
            // Map phone screenshots to iphone65
            iphone65: localeScreenshots.phone || [],
            // Map tablet screenshots to iPad 13"
            ipad13: localeScreenshots.tablet,
            // Apple Watch screenshots are App Store-only.
            appleWatch: localeScreenshots.watch,
          },
          ...(macOS ? { macOS } : {}),
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
          // App-level contact information
          contactEmail: metadata.contactEmail,
          supportUrl: metadata.supportUrl,
          marketingUrl: metadata.marketingUrl,
          privacyPolicyUrl: metadata.privacyUrl,
          termsUrl: metadata.termsUrl,
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
 * Save ASO data to config.json.
 */
export function saveAsoToConfig(slug: string, config: ProductConfig): void {
  const productsDir = getProductsDir();
  const configPath = path.join(productsDir, slug, "config.json");

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Save ASO data to the configured ASO directory.
 */
export function saveAsoToAsoDir(slug: string, asoData: AsoData): void {
  const rootDir = getPushDataDir();

  // Save Google Play data
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

  // Save App Store data
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
