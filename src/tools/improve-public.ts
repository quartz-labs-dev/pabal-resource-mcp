import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadAsoFromConfig } from "../utils/aso-converter.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "./utils/improve-public/load-product-locales.util.js";
import { getFullDescriptionForLocale } from "./utils/improve-public/get-full-description.util.js";
import { formatLocaleSection } from "./utils/improve-public/format-locale-section.util.js";
import {
  generatePrimaryOptimizationPrompt,
  generateKeywordLocalizationPrompt,
  type GenerateKeywordLocalizationPromptArgs,
} from "./utils/improve-public/generate-aso-prompt.util.js";
import { saveLocaleFile } from "./utils/improve-public/save-locale-file.util.js";
import { loadKeywordResearchForLocale } from "./utils/improve-public/load-keyword-research.util.js";

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
  description: `Optimizes locale JSON in public/products/[slug]/locales for ASO.

**IMPORTANT:** The 'slug' parameter is REQUIRED. If the user does not provide a slug, you MUST ask them to provide it. This tool processes only ONE product at a time.

**CRITICAL: Only processes existing locale files. Does NOT create new locale files.**
- Only improves locales that already exist in public/products/[slug]/locales/
- If a locale file doesn't exist, it will be skipped (not created)
- Always work with existing files only

This tool follows a 2-stage workflow:

**Stage 1: Primary Locale Optimization** (${FIELD_LIMITS_DOC_PATH})
1. Load product config + locales (primary: en-US default)
2. Keyword research for PRIMARY locale only (web search for 10 keywords)
3. Optimize ALL ASO fields in primary locale with keywords
4. Validate character limits (title ≤30, subtitle ≤30, shortDescription ≤80, keywords ≤100, intro ≤300, outro ≤200)

**Stage 2: Keyword Localization** (Batch Processing)
1. Translate optimized primary → target locales in batches (preserve structure/tone/context)
2. For EACH locale in batch: lightweight keyword research (10 language-specific keywords)
3. Replace keywords in translated content (swap keywords only, keep context)
4. Validate character limits per locale
5. Save each batch to files before proceeding to next batch
6. **Only processes locales that already exist - does NOT create new files**

**Batch Processing:**
- Languages are processed in batches (default: 5 locales per batch)
- Each batch is translated, optimized, and saved before moving to the next
- Use \`batchIndex\` to process a specific batch (0-based)
- If \`batchIndex\` is not provided, process all batches sequentially
- **Only existing locale files are processed - missing locales are skipped**

This approach ensures:
- Efficient token usage (full optimization only once)
- Consistent messaging across all languages
- Language-specific keyword optimization for each market
- Prevents content truncation by processing in manageable batches
- **No new files are created - only existing locales are improved**

Optionally target a single locale; the primary locale is always included for reference.`,
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
  const keywordResearchByLocale: Record<string, string[]> = {};
  const keywordResearchDirByLocale: Record<string, string> = {};
  for (const loc of targetLocales) {
    const research = loadKeywordResearchForLocale(slug, loc);
    keywordResearchByLocale[loc] = research.sections;
    keywordResearchDirByLocale[loc] = research.researchDir;
  }

  const baseArgs = {
    slug,
    category,
    primaryLocale,
    targetLocales,
    localeSections,
    keywordResearchByLocale,
    keywordResearchDirByLocale,
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
