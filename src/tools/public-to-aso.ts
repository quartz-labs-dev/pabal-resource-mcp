import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import path from "node:path";
import { loadAsoFromConfig } from "../utils/aso-converter.js";
import { prepareAsoDataForPush } from "./utils/public-to-aso/prepare-aso-data-for-push.util.js";
import { saveRawAsoData } from "./utils/public-to-aso/save-raw-aso-data.util.js";
import { downloadImage } from "./utils/public-to-aso/download-image.util.js";
import { isLocalAssetPath } from "./utils/public-to-aso/is-local-asset-path.util.js";
import { copyLocalAssetToAsoDir } from "./utils/public-to-aso/copy-local-asset-to-aso-dir.util.js";
import { convertToMultilingual } from "./utils/shared/convert-to-multilingual.util.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
  isGooglePlayLocale,
  isAppStoreLocale,
} from "../types/aso/index.js";
import type { AsoData } from "../types/aso/index.js";
import {
  DEFAULT_LOCALE,
  GOOGLE_PLAY_SUPPORTED_LOCALES,
  APP_STORE_SUPPORTED_LOCALES,
  type UnifiedLocale,
} from "../constants/unified-locales.js";
import {
  unifiedToGooglePlay,
  unifiedToAppStore,
} from "../utils/locale-converter.js";
import { getPushDataDir, getProductsDir } from "../utils/config.util.js";
import fs from "node:fs";

const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

const toJsonSchema: (
  schema: z.ZodTypeAny,
  options?: Parameters<typeof zodToJsonSchema>[1]
) => ReturnType<typeof zodToJsonSchema> = zodToJsonSchema;

/**
 * public-to-aso MCP Tool
 *
 * Prepares ASO data from public/products/[slug]/ to .aso/pushData format.
 * This includes converting config.json + locales/ to store-compatible format and copying screenshots.
 */

// Input schema
export const publicToAsoInputSchema = z.object({
  slug: z.string().describe("Product slug"),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe("Preview mode (no changes)"),
});

export type PublicToAsoInput = z.infer<typeof publicToAsoInputSchema>;

/**
 * MCP Tool Definition
 */
const jsonSchema = toJsonSchema(publicToAsoInputSchema, {
  name: "PublicToAsoInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.PublicToAsoInput || jsonSchema;

/**
 * Download/copy screenshots to pushData directory
 */
async function downloadScreenshotsToAsoDir(
  slug: string,
  asoData: AsoData
): Promise<void> {
  const rootDir = getPushDataDir();
  const productStoreRoot = path.join(rootDir, "products", slug, "store");

  // Download Google Play screenshots (all locales)
  if (asoData.googlePlay) {
    let googlePlayData = asoData.googlePlay;

    if (!isGooglePlayMultilingual(googlePlayData)) {
      googlePlayData = convertToMultilingual(
        googlePlayData,
        googlePlayData.defaultLanguage
      );
    }

    // Process all locales
    for (const unifiedLocale of Object.keys(googlePlayData.locales)) {
      // Convert unified locale to Google Play locale
      const googlePlayLocale = unifiedToGooglePlay(
        unifiedLocale as UnifiedLocale
      );
      if (!googlePlayLocale) {
        continue; // Skip unsupported locales
      }
      const localeData = googlePlayData.locales[unifiedLocale];
      const asoDir = path.join(
        productStoreRoot,
        "google-play",
        "screenshots",
        googlePlayLocale
      );

      const phoneScreenshots = localeData.screenshots?.phone;
      if (phoneScreenshots && phoneScreenshots.length > 0) {
        for (let i = 0; i < phoneScreenshots.length; i++) {
          const url = phoneScreenshots[i];
          const filename = `phone-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }

      // Download 7-inch tablet screenshots
      const tablet7Screenshots = localeData.screenshots?.tablet7;
      if (tablet7Screenshots && tablet7Screenshots.length > 0) {
        for (let i = 0; i < tablet7Screenshots.length; i++) {
          const url = tablet7Screenshots[i];
          const filename = `tablet7-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }

      // Download 10-inch tablet screenshots
      const tablet10Screenshots = localeData.screenshots?.tablet10;
      if (tablet10Screenshots && tablet10Screenshots.length > 0) {
        for (let i = 0; i < tablet10Screenshots.length; i++) {
          const url = tablet10Screenshots[i];
          const filename = `tablet10-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }

      // Legacy support: Download old tablet screenshots (if exists)
      const tabletScreenshots = localeData.screenshots?.tablet;
      if (tabletScreenshots && tabletScreenshots.length > 0) {
        for (let i = 0; i < tabletScreenshots.length; i++) {
          const url = tabletScreenshots[i];
          const filename = `tablet-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }

      // Download Feature Graphic
      if (localeData.featureGraphic) {
        const featureGraphicUrl = localeData.featureGraphic;
        const outputPath = path.join(asoDir, "feature-graphic.png");
        if (isLocalAssetPath(featureGraphicUrl)) {
          copyLocalAssetToAsoDir(featureGraphicUrl, outputPath);
        } else {
          await downloadImage(featureGraphicUrl, outputPath);
        }
      }
    }
  }

  // Download App Store screenshots (all locales)
  if (asoData.appStore) {
    let appStoreData = asoData.appStore;

    if (!isAppStoreMultilingual(appStoreData)) {
      appStoreData = convertToMultilingual(appStoreData, appStoreData.locale);
    }

    // Process all locales
    for (const unifiedLocale of Object.keys(appStoreData.locales)) {
      // Convert unified locale to App Store locale
      const appStoreLocale = unifiedToAppStore(unifiedLocale as UnifiedLocale);
      if (!appStoreLocale) {
        continue; // Skip unsupported locales
      }
      const localeData = appStoreData.locales[unifiedLocale];
      const asoDir = path.join(
        productStoreRoot,
        "app-store",
        "screenshots",
        appStoreLocale
      );

      // Download iPhone screenshots
      const iphone65Screenshots = localeData.screenshots?.iphone65;
      if (iphone65Screenshots && iphone65Screenshots.length > 0) {
        for (let i = 0; i < iphone65Screenshots.length; i++) {
          const url = iphone65Screenshots[i];
          const filename = `iphone65-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }

      // Download iPad screenshots
      const ipadPro129Screenshots = localeData.screenshots?.ipadPro129;
      if (ipadPro129Screenshots && ipadPro129Screenshots.length > 0) {
        for (let i = 0; i < ipadPro129Screenshots.length; i++) {
          const url = ipadPro129Screenshots[i];
          const filename = `ipadPro129-${i + 1}.png`;
          const outputPath = path.join(asoDir, filename);
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAsoDir(url, outputPath);
            continue;
          }
          await downloadImage(url, outputPath);
        }
      }
    }
  }
}

export const publicToAsoTool = {
  name: "public-to-aso",
  description: `Prepares ASO data from public/products/[slug]/ to pushData format.

**IMPORTANT:** The 'slug' parameter is REQUIRED. If the user does not provide a slug, you MUST ask them to provide it. This tool processes only ONE product at a time.

This tool:
1. Loads ASO data from public/products/[slug]/config.json + locales/
2. Converts to store-compatible format (removes screenshots from metadata, sets contactWebsite/marketingUrl)
3. Saves metadata to .aso/pushData/products/[slug]/store/ (path from ~/.config/pabal-mcp/config.json dataDir)
4. Copies/downloads screenshots to .aso/pushData/products/[slug]/store/screenshots/

Before running, review ${FIELD_LIMITS_DOC_PATH} for per-store limits. This prepares data for pushing to stores without actually uploading.`,
  inputSchema,
};

/**
 * Main handler function
 */
export async function handlePublicToAso(
  input: PublicToAsoInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { slug, dryRun } = input;

  // Load ASO data from config.json + locales/
  const configData = loadAsoFromConfig(slug);

  if (!configData.googlePlay && !configData.appStore) {
    const productsDir = getProductsDir();
    const configPath = path.join(productsDir, slug, "config.json");
    const localesDir = path.join(productsDir, slug, "locales");

    const errors: string[] = [];

    if (!fs.existsSync(configPath)) {
      errors.push(`- config.json not found at ${configPath}`);
    } else {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (!config.packageName && !config.bundleId) {
          errors.push(
            `- config.json exists but missing both packageName and bundleId`
          );
        } else {
          if (config.packageName) {
            errors.push(`- packageName found: ${config.packageName}`);
          }
          if (config.bundleId) {
            errors.push(`- bundleId found: ${config.bundleId}`);
          }
        }
      } catch (e) {
        errors.push(
          `- Failed to parse config.json: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }

    if (!fs.existsSync(localesDir)) {
      errors.push(`- locales directory not found at ${localesDir}`);
    } else {
      try {
        const localeFiles = fs
          .readdirSync(localesDir)
          .filter((f) => f.endsWith(".json"));
        if (localeFiles.length === 0) {
          errors.push(`- locales directory exists but no .json files found`);
        } else {
          errors.push(
            `- Found ${localeFiles.length} locale file(s): ${localeFiles.join(
              ", "
            )}`
          );
          // Check if any locale is valid
          const validLocales: string[] = [];
          const invalidLocales: string[] = [];
          for (const file of localeFiles) {
            const localeCode = file.replace(".json", "");
            if (
              isGooglePlayLocale(localeCode) ||
              isAppStoreLocale(localeCode)
            ) {
              validLocales.push(localeCode);
            } else {
              invalidLocales.push(localeCode);
            }
          }
          if (validLocales.length > 0) {
            errors.push(`- Valid locales: ${validLocales.join(", ")}`);
          }
          if (invalidLocales.length > 0) {
            errors.push(
              `- Invalid locales (not supported by Google Play or App Store): ${invalidLocales.join(
                ", "
              )}`
            );
          }
        }
      } catch (e) {
        errors.push(
          `- Failed to read locales directory: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }

    throw new Error(
      `No ASO data found in config.json + locales/ for ${slug}\n\n` +
        `Diagnostics:\n${errors.join("\n")}\n\n` +
        `Possible causes:\n` +
        `1. config.json is missing packageName (for Google Play) or bundleId (for App Store)\n` +
        `2. locales/ directory is missing or empty\n` +
        `3. Locale files exist but don't match supported Google Play/App Store locales\n` +
        `4. Locale files don't contain valid ASO data`
    );
  }

  // Prepare data for push (remove screenshots, set contactWebsite, etc.)
  const storeData = prepareAsoDataForPush(slug, configData);

  const pushDataRoot = getPushDataDir();

  if (dryRun) {
    return {
      content: [
        {
          type: "text",
          text: `Preview mode - Data that would be saved to ${pushDataRoot}:\n\n${JSON.stringify(
            storeData,
            null,
            2
          )}`,
        },
      ],
    };
  }

  // Save metadata to pushData
  saveRawAsoData(slug, storeData);

  // Download/copy screenshots
  await downloadScreenshotsToAsoDir(slug, configData);

  const localeCounts: { googlePlay?: number; appStore?: number } = {};

  if (storeData.googlePlay) {
    const googlePlayData = storeData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };
    localeCounts.googlePlay = Object.keys(locales).length;
  }

  if (storeData.appStore) {
    const appStoreData = storeData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };
    localeCounts.appStore = Object.keys(locales).length;
  }

  let responseText = `✅ ${slug} pushData files prepared from config.json + locales/ (images + metadata synced)\n\n`;
  if (localeCounts.googlePlay) {
    responseText += `Google Play: ${localeCounts.googlePlay} locale(s)\n`;
  }
  if (localeCounts.appStore) {
    responseText += `App Store: ${localeCounts.appStore} locale(s)\n`;
  }
  responseText += `\nNext step: Push to stores using pabal-mcp's aso-push tool`;
  responseText += `\nReference: ${FIELD_LIMITS_DOC_PATH}`;

  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
}
