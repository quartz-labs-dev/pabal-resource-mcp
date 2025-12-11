import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AsoData } from "../types/aso/index.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../types/aso/index.js";
import {
  DEFAULT_LOCALE,
  googlePlayToUnified,
  appStoreToUnified,
  type UnifiedLocale,
} from "../constants/unified-locales.js";
import { loadPullData } from "./utils/aso-to-public/load-pull-data.util.js";
import { generateConversionPrompt } from "./utils/aso-to-public/generate-conversion-prompt.util.js";
import { getPullDataDir } from "../utils/config.util.js";

const toJsonSchema: (
  schema: z.ZodTypeAny,
  options?: Parameters<typeof zodToJsonSchema>[1]
) => ReturnType<typeof zodToJsonSchema> = zodToJsonSchema;

/**
 * aso-to-public MCP Tool
 *
 * Builds per-locale conversion prompts from .aso/pullData so you can update public/products/[slug]/locales/.
 * This includes converting unstructured ASO data to structured format. It does not write files or copy screenshots.
 */

// Input schema
export const asoToPublicInputSchema = z.object({
  slug: z.string().describe("Product slug"),
});

export type AsoToPublicInput = z.infer<typeof asoToPublicInputSchema>;

/**
 * MCP Tool Definition
 */
const jsonSchema = toJsonSchema(asoToPublicInputSchema, {
  name: "AsoToPublicInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.AsoToPublicInput || jsonSchema;

export const asoToPublicTool = {
  name: "aso-to-public",
  description: `Converts ASO data from pullData to public/products/[slug]/ structure.

**IMPORTANT:** The 'slug' parameter is REQUIRED. If the user does not provide a slug, you MUST ask them to provide it. This tool processes only ONE product at a time.

This tool:
1. Loads ASO data from .aso/pullData/products/[slug]/store/ (path from ~/.config/pabal-mcp/config.json dataDir)
2. Generates per-locale conversion prompts to map fullDescription into structured locale JSON (template intro/outro + landing features/screenshots captions)
3. Next steps (manual): paste converted JSON into public/products/[slug]/locales/[locale].json and copy screenshots from .aso/pullData if needed

The conversion from unstructured to structured format is performed by Claude based on the conversion prompt.`,
  inputSchema,
};

/**
 * Merged ASO data for a single unified locale
 */
interface MergedLocaleData {
  unifiedLocale: UnifiedLocale;
  googlePlay?: {
    title: string;
    shortDescription?: string;
    fullDescription: string;
  };
  appStore?: {
    name: string;
    subtitle?: string;
    description: string;
    keywords?: string;
    promotionalText?: string;
  };
}

/**
 * Main handler function
 */
export async function handleAsoToPublic(
  input: AsoToPublicInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { slug } = input;

  // Load data from pullData
  const asoData = loadPullData(slug);

  if (!asoData.googlePlay && !asoData.appStore) {
    throw new Error(`No ASO data found in pullData for ${slug}`);
  }

  // Map to store merged data by unified locale
  const mergedDataByLocale = new Map<UnifiedLocale, MergedLocaleData>();

  // Process Google Play data
  if (asoData.googlePlay) {
    const googlePlayData = asoData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };

    for (const [platformLocale, localeData] of Object.entries(locales)) {
      const unifiedLocale = googlePlayToUnified(platformLocale);

      if (!mergedDataByLocale.has(unifiedLocale)) {
        mergedDataByLocale.set(unifiedLocale, { unifiedLocale });
      }

      const merged = mergedDataByLocale.get(unifiedLocale)!;
      merged.googlePlay = {
        title: localeData.title,
        shortDescription: localeData.shortDescription,
        fullDescription: localeData.fullDescription,
      };
    }
  }

  // Process App Store data
  if (asoData.appStore) {
    const appStoreData = asoData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    for (const [platformLocale, localeData] of Object.entries(locales)) {
      const unifiedLocale = appStoreToUnified(platformLocale);

      if (!mergedDataByLocale.has(unifiedLocale)) {
        mergedDataByLocale.set(unifiedLocale, { unifiedLocale });
      }

      const merged = mergedDataByLocale.get(unifiedLocale)!;
      merged.appStore = {
        name: localeData.name,
        subtitle: localeData.subtitle,
        description: localeData.description,
        keywords: localeData.keywords,
        promotionalText: localeData.promotionalText,
      };
    }
  }

  // Generate conversion prompts for each unified locale
  const conversionPrompts: string[] = [];
  const conversionTasks: Array<{
    locale: UnifiedLocale;
    sources: string[];
    prompt: string;
  }> = [];

  for (const [unifiedLocale, mergedData] of mergedDataByLocale.entries()) {
    const sources: string[] = [];
    if (mergedData.googlePlay) sources.push("Google Play");
    if (mergedData.appStore) sources.push("App Store");

    // Build screenshot paths for this locale (only if screenshots exist)
    let screenshotPaths: { googlePlay?: string; appStore?: string } | undefined;

    if (mergedData.googlePlay) {
      const googlePlayLocale = Object.keys(
        isGooglePlayMultilingual(asoData.googlePlay!)
          ? asoData.googlePlay!.locales
          : { [asoData.googlePlay!.defaultLanguage || DEFAULT_LOCALE]: {} }
      ).find((loc) => googlePlayToUnified(loc) === unifiedLocale);

      if (googlePlayLocale) {
        if (!screenshotPaths) screenshotPaths = {};
        const pullDataDir = getPullDataDir();
        screenshotPaths.googlePlay = `${pullDataDir}/products/${slug}/store/google-play/screenshots/${googlePlayLocale}/`;
      }
    }

    if (mergedData.appStore) {
      const appStoreLocale = Object.keys(
        isAppStoreMultilingual(asoData.appStore!)
          ? asoData.appStore!.locales
          : { [asoData.appStore!.locale || DEFAULT_LOCALE]: {} }
      ).find((loc) => appStoreToUnified(loc) === unifiedLocale);

      if (appStoreLocale) {
        if (!screenshotPaths) screenshotPaths = {};
        const pullDataDir = getPullDataDir();
        screenshotPaths.appStore = `${pullDataDir}/products/${slug}/store/app-store/screenshots/${appStoreLocale}/`;
      }
    }

    const prompt = generateConversionPrompt(
      mergedData.googlePlay?.title || mergedData.appStore?.name || "",
      mergedData.googlePlay?.shortDescription || mergedData.appStore?.subtitle,
      mergedData.googlePlay?.fullDescription ||
        mergedData.appStore?.description ||
        "",
      unifiedLocale,
      mergedData.appStore?.keywords,
      mergedData.appStore?.promotionalText,
      mergedData.googlePlay,
      mergedData.appStore,
      screenshotPaths
    );

    conversionTasks.push({
      locale: unifiedLocale,
      sources,
      prompt,
    });

    const sourcesText = sources.join(" + ");
    conversionPrompts.push(
      `\n--- ${unifiedLocale} (${sourcesText}) ---\n${prompt}`
    );
  }

  // Build response message
  const pullDataDir = getPullDataDir();
  let responseText = `Converting ASO data from pullData to public/products/${slug}/ structure.\n\n`;
  responseText += `Found ${conversionTasks.length} unified locale(s) to convert.\n`;
  responseText += `Data sources: Google Play (${
    asoData.googlePlay ? "✓" : "✗"
  }), App Store (${asoData.appStore ? "✓" : "✗"})\n\n`;
  responseText +=
    "Please convert each locale's ASO data using the prompts below.\n";
  responseText +=
    "When both platforms have data for the same locale, they are merged into a single conversion.\n\n";
  responseText += conversionPrompts.join("\n\n");
  responseText += `\n\nNext steps (manual):\n`;
  responseText += `1. Save converted JSON to public/products/${slug}/locales/[locale].json\n`;
  responseText += `   Example: public/products/${slug}/locales/ar.json (not ar-SA.json)\n`;
  responseText += `2. Copy screenshots from ${pullDataDir}/products/${slug}/store/ to public/products/${slug}/screenshots/\n`;

  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
}
