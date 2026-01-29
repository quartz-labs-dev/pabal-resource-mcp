import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadAsoFromConfig } from "../../utils/aso-converter.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "./utils/improve/load-product-locales.util.js";
import { getFullDescriptionForLocale } from "./utils/improve/get-full-description.util.js";
import { formatLocaleSection } from "./utils/improve/format-locale-section.util.js";
import {
  generatePrimaryOptimizationPrompt,
  generateKeywordLocalizationPrompt,
  type GenerateKeywordLocalizationPromptArgs,
} from "./utils/improve/generate-aso-prompt.util.js";
import { saveLocaleFile } from "./utils/improve/save-locale-file.util.js";
import { loadKeywordResearchForLocale } from "./utils/improve/load-keyword-research.util.js";

const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

const toJsonSchema: (
  schema: z.ZodTypeAny,
  options?: Parameters<typeof zodToJsonSchema>[1]
) => ReturnType<typeof zodToJsonSchema> = zodToJsonSchema;

/**
 * improve-public MCP Tool
 *
 * Generates ASO improvement prompts for public/products/[slug]/ data.
 * Analyzes current ASO data and provides optimization suggestions.
 */

// Input schema
export const improvePublicInputSchema = z.object({
  slug: z.string().describe("Product slug"),
  locale: z
    .string()
    .optional()
    .describe("Locale to improve (default: all locales)"),
  stage: z
    .enum(["1", "2", "both"])
    .optional()
    .describe(
      "Stage to execute: 1 (primary only), 2 (keyword localization), both (default)"
    ),
  optimizedPrimary: z
    .string()
    .optional()
    .describe("Optimized primary locale JSON (required for stage 2)"),
  batchSize: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe(
      "Number of locales to process per batch (default: 5, for stage 2 only)"
    ),
  batchIndex: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      "Batch index to process (0-based, for stage 2 only). If not provided, processes all batches sequentially"
    ),
});

export type ImprovePublicInput = z.infer<typeof improvePublicInputSchema>;

/**
 * MCP Tool Definition
 */
const jsonSchema = toJsonSchema(improvePublicInputSchema, {
  name: "ImprovePublicInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.ImprovePublicInput || jsonSchema;

export const improvePublicTool = {
  name: "improve-public",
  description: `Returns ASO optimization instructions with keyword research data. **You MUST execute the returned instructions.**

**IMPORTANT:** Use 'search-app' tool first to resolve the exact slug.

## HOW THIS TOOL WORKS
This tool returns a PROMPT containing:
- Saved keyword research data (Tier 1/2/3 keywords with traffic/difficulty scores)
- Current locale data
- Optimization instructions

**YOU MUST:**
1. Read the returned prompt carefully
2. EXECUTE the optimization instructions (create the optimized JSON)
3. Save results using 'save-locale-file' tool

**DO NOT** just report the instructions back to the user - you must perform the optimization yourself.

## WORKFLOW
**Stage 1:** improve-public(slug, stage="1") → Returns keyword data + instructions → You create optimized primary locale JSON → save-locale-file
**Stage 2:** improve-public(slug, stage="2", optimizedPrimary=<JSON>) → Returns per-locale instructions → You optimize each locale → save-locale-file for each

## STAGES
- **Stage 1:** Primary locale optimization using saved keyword research (ios + android combined)
- **Stage 2:** Localize to other languages - **each locale uses its OWN keyword research**

## KEYWORD SOURCES (Per Locale)
- **Priority 1:** Uses each locale's SAVED keyword research from .aso/keywordResearch/products/[slug]/locales/[locale]/
- **Priority 2 (Fallback):** If locale-specific research is missing, falls back to en-US/en keywords and TRANSLATES them
- iOS and Android research are automatically combined per locale (iOS prioritized)

**CRITICAL:** Only processes existing locale files. Does NOT create new files.`,
  inputSchema,
};

/**
 * Main handler function
 */
export async function handleImprovePublic(
  input: ImprovePublicInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    slug,
    locale,
    stage = "both",
    optimizedPrimary,
    batchSize = 5,
    batchIndex,
  } = input;

  const { config, locales } = loadProductLocales(slug);
  const primaryLocale = resolvePrimaryLocale(config, locales);

  // Only process existing locales - do not create new ones
  if (locale && !locales[locale]) {
    throw new Error(
      `Locale "${locale}" not found in public/products/${slug}/locales/. Only existing locale files are processed - new files are not created.`
    );
  }

  // Filter to only include locales that actually exist
  const requestedLocales = locale ? [locale] : Object.keys(locales);
  const existingRequestedLocales = requestedLocales.filter(
    (loc) => locales[loc]
  );

  if (existingRequestedLocales.length === 0) {
    throw new Error(
      `No existing locales found to process. Only existing locale files in public/products/${slug}/locales/ are processed.`
    );
  }

  const localeSet = new Set<string>([
    ...existingRequestedLocales,
    primaryLocale,
  ]);
  const targetLocales = [...localeSet].filter((loc) => locales[loc]); // Ensure all target locales exist

  // Load derived ASO data to surface fullDescription length
  const asoData = loadAsoFromConfig(slug);

  // Get category from config
  const category = config?.metadata?.category;

  const localeSections: string[] = [];
  for (const loc of localeSet) {
    const localeData = locales[loc];
    if (!localeData) {
      continue;
    }

    const fullDescription = getFullDescriptionForLocale(asoData, loc);
    localeSections.push(
      formatLocaleSection({
        slug,
        locale: loc,
        localeData,
        fullDescription,
        primaryLocale,
        category,
      })
    );
  }

  // Load keyword research data per locale (from .aso/keywordResearch)
  // If locale-specific research is not found, fallback to en-US/en and translate
  const keywordResearchByLocale: Record<string, string[]> = {};
  const keywordResearchDirByLocale: Record<string, string> = {};
  const keywordResearchFallbackByLocale: Record<
    string,
    { isFallback: boolean; fallbackLocale?: string }
  > = {};
  for (const loc of targetLocales) {
    const research = loadKeywordResearchForLocale(slug, loc);
    keywordResearchByLocale[loc] = research.sections;
    keywordResearchDirByLocale[loc] = research.researchDir;
    keywordResearchFallbackByLocale[loc] = {
      isFallback: research.isFallback,
      fallbackLocale: research.fallbackLocale,
    };
  }

  const baseArgs = {
    slug,
    category,
    primaryLocale,
    targetLocales,
    localeSections,
    keywordResearchByLocale,
    keywordResearchDirByLocale,
    keywordResearchFallbackByLocale,
  };

  // Stage 1: Primary optimization
  if (stage === "1" || stage === "both") {
    const prompt = generatePrimaryOptimizationPrompt(baseArgs);
    return {
      content: [
        {
          type: "text",
          text: prompt,
        },
      ],
    };
  }

  // Stage 2: Keyword localization (with batch processing)
  if (stage === "2") {
    if (!optimizedPrimary) {
      throw new Error(
        "Stage 2 requires optimizedPrimary parameter. Run stage 1 first or use stage='both'."
      );
    }

    // Filter out primary locale for batch processing
    const nonPrimaryLocales = targetLocales.filter((l) => l !== primaryLocale);

    // Calculate batches
    const totalBatches = Math.ceil(nonPrimaryLocales.length / batchSize);

    // Determine which batch(es) to process
    let batchesToProcess: number[];
    if (batchIndex !== undefined) {
      if (batchIndex < 0 || batchIndex >= totalBatches) {
        throw new Error(
          `Batch index ${batchIndex} is out of range. Total batches: ${totalBatches} (0-${
            totalBatches - 1
          })`
        );
      }
      batchesToProcess = [batchIndex];
    } else {
      // Process all batches sequentially
      batchesToProcess = Array.from({ length: totalBatches }, (_, i) => i);
    }

    // Process each batch
    const batchPrompts: string[] = [];
    for (const currentBatchIndex of batchesToProcess) {
      const startIdx = currentBatchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, nonPrimaryLocales.length);
      const batchLocales = nonPrimaryLocales.slice(startIdx, endIdx);

      // Get locale sections for this batch only
      const batchLocaleSections = localeSections.filter((section) => {
        return batchLocales.some((loc) => section.includes(`[${loc}]`));
      });

      const promptArgs: GenerateKeywordLocalizationPromptArgs = {
        slug: baseArgs.slug,
        category: baseArgs.category,
        primaryLocale: baseArgs.primaryLocale,
        targetLocales: baseArgs.targetLocales,
        localeSections: baseArgs.localeSections,
        keywordResearchByLocale: baseArgs.keywordResearchByLocale,
        keywordResearchDirByLocale: baseArgs.keywordResearchDirByLocale,
        keywordResearchFallbackByLocale:
          baseArgs.keywordResearchFallbackByLocale,
        optimizedPrimary,
        batchLocales,
        batchIndex: currentBatchIndex,
        totalBatches,
        batchLocaleSections,
      };
      const prompt = generateKeywordLocalizationPrompt(promptArgs);

      batchPrompts.push(prompt);
    }

    return {
      content: [
        {
          type: "text",
          text: batchPrompts.join("\n\n---\n\n"),
        },
      ],
    };
  }

  throw new Error(`Invalid stage: ${stage}. Must be "1", "2", or "both".`);
}
