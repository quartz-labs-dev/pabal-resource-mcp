/**
 * localize-screenshots: Translate app screenshots to multiple languages
 *
 * This tool:
 * 1. Validates the app using search-app tool
 * 2. Reads supported locales from the product's locales directory
 * 3. Scans screenshots from the primary locale folder
 * 4. Uses Gemini API to translate text in images to all supported languages
 * 5. Validates and resizes output images to match source dimensions
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import { findRegisteredApp } from "../../utils/registered-apps.util.js";
import { getProductsDir } from "../../utils/config.util.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "./utils/improve/load-product-locales.util.js";
import {
  scanLocaleScreenshots,
  getScreenshotsDir,
  type ScreenshotInfo,
} from "./utils/localize-screenshots/scan-screenshots.util.js";
import {
  translateImagesWithProgress,
  type TranslationProgress,
} from "./utils/localize-screenshots/gemini-image-translator.util.js";
import { prepareLocalesForTranslation } from "./utils/localize-screenshots/locale-mapping.constants.js";
import { batchValidateAndResize } from "./utils/localize-screenshots/image-resizer.util.js";

const TOOL_NAME = "localize-screenshots";

// Input schema
export const localizeScreenshotsInputSchema = z.object({
  appName: z
    .string()
    .describe(
      "App name, slug, bundleId, or packageName to search for. Will be validated using search-app."
    ),
  targetLocales: z
    .array(z.string())
    .optional()
    .describe(
      "Specific target locales to translate to. If not provided, all supported locales from the product will be used."
    ),
  deviceTypes: z
    .array(z.enum(["phone", "tablet"]))
    .optional()
    .default(["phone", "tablet"])
    .describe("Device types to process (default: both phone and tablet)"),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Preview mode - shows what would be translated without actually translating"
    ),
  skipExisting: z
    .boolean()
    .optional()
    .default(true)
    .describe("Skip translation if target file already exists (default: true)"),
  screenshotNumbers: z
    .union([
      z.array(z.number().int().positive()),
      z.object({
        phone: z.array(z.number().int().positive()).optional(),
        tablet: z.array(z.number().int().positive()).optional(),
      }),
    ])
    .optional()
    .describe(
      "Specific screenshot numbers to process. Can be:\n" +
        "- Array for all devices: [1, 3, 5]\n" +
        "- Object for per-device: { phone: [1, 2], tablet: [1, 3, 5] }\n" +
        "If not provided, all screenshots will be processed."
    ),
  preserveWords: z
    .array(z.string())
    .optional()
    .describe(
      'Words to keep untranslated (e.g., brand names, product names). Example: ["Pabal", "Pro", "AI"]'
    ),
});

export type LocalizeScreenshotsInput = z.infer<
  typeof localizeScreenshotsInputSchema
>;

const jsonSchema = zodToJsonSchema(localizeScreenshotsInputSchema as any, {
  name: "LocalizeScreenshotsInput",
  $refStrategy: "none",
});

const inputSchema =
  jsonSchema.definitions?.LocalizeScreenshotsInput || jsonSchema;

export const localizeScreenshotsTool = {
  name: TOOL_NAME,
  description: `Translate app screenshots to multiple languages using Gemini API.

**IMPORTANT:** This tool uses the search-app tool internally to validate the app. You can provide an approximate name, bundleId, or packageName.

This tool:
1. Validates the app exists in registered-apps.json
2. Reads supported locales from public/products/{slug}/locales/ directory
3. Scans screenshots from the primary locale's screenshots folder
4. Uses Gemini API (imagen-3.0-generate-002) to translate text in images
5. Validates output image dimensions match source and resizes if needed

**Requirements:**
- GEMINI_API_KEY or GOOGLE_API_KEY environment variable must be set
- Screenshots must be in: public/products/{slug}/screenshots/{locale}/phone/ and /tablet/
- Locale files must exist in: public/products/{slug}/locales/

**Example structure:**
\`\`\`
public/products/my-app/
├── config.json
├── locales/
│   ├── en-US.json (primary)
│   ├── ko-KR.json
│   └── ja-JP.json
└── screenshots/
    └── en-US/
        ├── phone/
        │   ├── 1.png
        │   └── 2.png
        └── tablet/
            └── 1.png
\`\`\``,
  inputSchema,
};

/**
 * Validate app exists and return slug
 */
function validateApp(appName: string): { slug: string; name: string } {
  const { app } = findRegisteredApp(appName);

  if (!app) {
    throw new Error(
      `App not found: "${appName}". Use search-app tool to find the correct app name.`
    );
  }

  return {
    slug: app.slug,
    name: app.name || app.slug,
  };
}

/**
 * Get supported locales from product's locales directory
 */
function getSupportedLocales(slug: string): {
  primaryLocale: string;
  allLocales: string[];
} {
  const { config, locales } = loadProductLocales(slug);
  const allLocales = Object.keys(locales);

  if (allLocales.length === 0) {
    throw new Error(`No locale files found for ${slug}`);
  }

  const primaryLocale = resolvePrimaryLocale(config, locales);

  return {
    primaryLocale,
    allLocales,
  };
}

/**
 * Get target locales (excluding primary) with intelligent filtering:
 * 1. Groups similar locales (e.g., en-US, en-GB -> only translate en-US)
 * 2. Filters by Gemini API support
 * Returns targets to translate and metadata about skipped/grouped locales
 */
function getTargetLocales(
  allLocales: string[],
  primaryLocale: string,
  requestedTargets?: string[]
): {
  targets: string[];
  skippedLocales: string[];
  groupedLocales: string[];
  localeMapping: Map<string, string[]>;
} {
  // If specific targets requested, validate and filter first
  let localesToProcess = allLocales;

  if (requestedTargets && requestedTargets.length > 0) {
    const validTargets = requestedTargets.filter((t) => allLocales.includes(t));
    const invalidTargets = requestedTargets.filter(
      (t) => !allLocales.includes(t)
    );

    if (invalidTargets.length > 0) {
      console.warn(
        `Warning: Some requested locales are not in product: ${invalidTargets.join(", ")}`
      );
    }

    localesToProcess = validTargets;
  }

  // Explicitly remove primary locale from targets to avoid redundancy
  localesToProcess = localesToProcess.filter((l) => l !== primaryLocale);

  // Use the centralized locale preparation function
  // This handles: primary exclusion, similar locale grouping, Gemini support filtering
  const { translatableLocales, localeMapping, skippedLocales, groupedLocales } =
    prepareLocalesForTranslation(localesToProcess, primaryLocale);

  return {
    targets: translatableLocales,
    skippedLocales,
    groupedLocales,
    localeMapping,
  };
}

interface TranslationTask {
  sourcePath: string;
  sourceLocale: string;
  targetLocale: string;
  outputPaths: string[]; // Multiple paths: representative + grouped locales
  deviceType: string;
  filename: string;
}

/**
 * Build translation tasks with grouped locale support
 * Each task includes outputPaths for representative + all grouped locales
 */
function buildTranslationTasks(
  slug: string,
  screenshots: ScreenshotInfo[],
  primaryLocale: string,
  targetLocales: string[],
  localeMapping: Map<string, string[]>,
  skipExisting: boolean
): TranslationTask[] {
  const tasks: TranslationTask[] = [];

  const screenshotsDir = getScreenshotsDir(slug);

  for (const targetLocale of targetLocales) {
    // targetLocale is a GeminiTargetLocale (e.g., "es-MX", "ua-UA")
    // localeMapping contains UnifiedLocales to save to (e.g., ["es-419", "es-ES"])
    const outputLocales = localeMapping.get(targetLocale) || [];

    for (const screenshot of screenshots) {
      // Build output paths for all locales in this group
      const outputPaths: string[] = [];

      for (const locale of outputLocales) {
        const outputPath = path.join(
          screenshotsDir,
          locale,
          screenshot.type,
          screenshot.filename
        );

        // Only add path if file doesn't exist or skipExisting is false
        if (!skipExisting || !fs.existsSync(outputPath)) {
          outputPaths.push(outputPath);
        }
      }

      // Skip this task entirely if all output paths already exist
      if (outputPaths.length === 0) {
        continue;
      }

      tasks.push({
        sourcePath: screenshot.fullPath,
        sourceLocale: primaryLocale,
        targetLocale,
        outputPaths,
        deviceType: screenshot.type,
        filename: screenshot.filename,
      });
    }
  }

  return tasks;
}

/**
 * Main handler function
 */
export async function handleLocalizeScreenshots(
  input: LocalizeScreenshotsInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    appName,
    targetLocales: requestedTargetLocales,
    deviceTypes = ["phone", "tablet"],
    dryRun = false,
    skipExisting = true,
    screenshotNumbers,
    preserveWords,
  } = input;

  const results: string[] = [];

  // Step 1: Validate app
  let appInfo: { slug: string; name: string };
  try {
    appInfo = validateApp(appName);
    results.push(`✅ App found: ${appInfo.name} (${appInfo.slug})`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Step 2: Get supported locales
  let primaryLocale: string;
  let allLocales: string[];
  try {
    const localeInfo = getSupportedLocales(appInfo.slug);
    primaryLocale = localeInfo.primaryLocale;
    allLocales = localeInfo.allLocales;
    results.push(`📍 Primary locale: ${primaryLocale}`);
    results.push(`🌐 Supported locales: ${allLocales.join(", ")}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Step 3: Get target locales with intelligent filtering
  // - Groups similar locales (e.g., en-US, en-GB -> only translate en-US)
  // - Filters by Gemini API support
  const {
    targets: targetLocales,
    skippedLocales,
    groupedLocales,
    localeMapping,
  } = getTargetLocales(allLocales, primaryLocale, requestedTargetLocales);

  if (targetLocales.length === 0) {
    const skippedMsg =
      skippedLocales.length > 0
        ? ` (Skipped due to Gemini limitation: ${skippedLocales.join(", ")})`
        : "";
    return {
      content: [
        {
          type: "text",
          text: `❌ No target locales to translate to. Primary locale: ${primaryLocale}, Available: ${allLocales.join(", ")}${skippedMsg}`,
        },
      ],
    };
  }

  results.push(`🎯 Target locales to translate: ${targetLocales.join(", ")}`);
  if (groupedLocales.length > 0) {
    results.push(
      `📋 Grouped locales (saved together): ${groupedLocales.join(", ")}`
    );
  }
  if (skippedLocales.length > 0) {
    results.push(
      `⚠️ Skipped locales (not supported by Gemini): ${skippedLocales.join(", ")}`
    );
  }

  // Step 4: Scan source screenshots
  const sourceScreenshots = scanLocaleScreenshots(appInfo.slug, primaryLocale);

  // Filter by device types
  let filteredScreenshots = sourceScreenshots.filter((s) =>
    deviceTypes.includes(s.type)
  );

  // Filter by screenshot numbers if specified
  if (screenshotNumbers) {
    // Normalize screenshotNumbers to per-device format
    const isArray = Array.isArray(screenshotNumbers);
    const phoneNumbers = isArray ? screenshotNumbers : screenshotNumbers.phone;
    const tabletNumbers = isArray
      ? screenshotNumbers
      : screenshotNumbers.tablet;

    filteredScreenshots = filteredScreenshots.filter((s) => {
      const match = s.filename.match(/^(\d+)\./);
      if (!match) return false;

      const num = parseInt(match[1], 10);
      const numbersForDevice =
        s.type === "phone" ? phoneNumbers : tabletNumbers;

      // If no filter specified for this device type, include all
      if (!numbersForDevice || numbersForDevice.length === 0) {
        return true;
      }

      return numbersForDevice.includes(num);
    });

    // Build filter description for output
    const filterParts: string[] = [];
    if (isArray) {
      filterParts.push(`all: ${screenshotNumbers.join(", ")}`);
    } else {
      if (phoneNumbers && phoneNumbers.length > 0) {
        filterParts.push(`phone: ${phoneNumbers.join(", ")}`);
      }
      if (tabletNumbers && tabletNumbers.length > 0) {
        filterParts.push(`tablet: ${tabletNumbers.join(", ")}`);
      }
    }
    if (filterParts.length > 0) {
      results.push(`🔢 Filtering screenshots: ${filterParts.join(" | ")}`);
    }
  }

  if (filteredScreenshots.length === 0) {
    const screenshotsDir = getScreenshotsDir(appInfo.slug);
    return {
      content: [
        {
          type: "text",
          text: `❌ No screenshots found in ${screenshotsDir}/${primaryLocale}/

Expected structure:
${screenshotsDir}/${primaryLocale}/phone/1.png, 2.png, ...
${screenshotsDir}/${primaryLocale}/tablet/1.png, 2.png, ...`,
        },
      ],
    };
  }

  const phoneCount = filteredScreenshots.filter(
    (s) => s.type === "phone"
  ).length;
  const tabletCount = filteredScreenshots.filter(
    (s) => s.type === "tablet"
  ).length;
  results.push(
    `📸 Source screenshots: ${phoneCount} phone, ${tabletCount} tablet`
  );

  // Step 5: Build translation tasks (includes grouped locales in outputPaths)
  const tasks = buildTranslationTasks(
    appInfo.slug,
    filteredScreenshots,
    primaryLocale,
    targetLocales,
    localeMapping,
    skipExisting
  );

  if (tasks.length === 0) {
    results.push(`\n✅ All screenshots already translated (skipExisting=true)`);
    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  results.push(`\n📋 Translation tasks: ${tasks.length} images to translate`);

  // Dry run - just show what would be done
  if (dryRun) {
    results.push(`\n🔍 DRY RUN - No actual translations will be performed\n`);

    const tasksByLocale: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      if (!tasksByLocale[task.targetLocale]) {
        tasksByLocale[task.targetLocale] = [];
      }
      tasksByLocale[task.targetLocale].push(task);
    }

    for (const [locale, localeTasks] of Object.entries(tasksByLocale)) {
      // Show grouped locales that will also receive this translation
      const grouped = localeMapping.get(locale) || [];
      const groupedOthers = grouped.filter((l) => l !== locale);
      const groupInfo =
        groupedOthers.length > 0 ? ` → also: ${groupedOthers.join(", ")}` : "";

      results.push(`\n📁 ${locale}${groupInfo}:`);
      for (const task of localeTasks) {
        results.push(`   - ${task.deviceType}/${task.filename}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  // Step 6: Execute translations
  results.push(`\n🚀 Starting translations...`);

  if (preserveWords && preserveWords.length > 0) {
    results.push(`🔒 Preserving words: ${preserveWords.join(", ")}`);
  }

  const translationResult = await translateImagesWithProgress(
    tasks,
    (progress: TranslationProgress) => {
      // Progress callback - real-time updates with current/total
      const progressPrefix = `[${progress.current}/${progress.total}]`;
      if (progress.status === "translating") {
        console.log(
          `🔄 ${progressPrefix} Translating ${progress.targetLocale}/${progress.deviceType}/${progress.filename}...`
        );
      } else if (progress.status === "completed") {
        console.log(
          `✅ ${progressPrefix} ${progress.targetLocale}/${progress.deviceType}/${progress.filename}`
        );
      } else if (progress.status === "failed") {
        console.log(
          `❌ ${progressPrefix} ${progress.targetLocale}/${progress.deviceType}/${progress.filename}: ${progress.error}`
        );
      }
    },
    preserveWords
  );

  results.push(`\n📊 Translation Results:`);
  results.push(`   ✅ Successful: ${translationResult.successful}`);
  results.push(`   ❌ Failed: ${translationResult.failed}`);

  if (translationResult.errors.length > 0) {
    results.push(`\n⚠️ Errors:`);
    for (const err of translationResult.errors.slice(0, 5)) {
      results.push(`   - ${path.basename(err.path)}: ${err.error}`);
    }
    if (translationResult.errors.length > 5) {
      results.push(
        `   ... and ${translationResult.errors.length - 5} more errors`
      );
    }
  }

  // Step 7: Validate and resize images (for all output paths including grouped locales)
  if (translationResult.successful > 0) {
    results.push(`\n🔍 Validating image dimensions...`);

    // Collect all output paths that exist for validation
    const resizePairs: Array<{ sourcePath: string; translatedPath: string }> =
      [];
    for (const task of tasks) {
      for (const outputPath of task.outputPaths) {
        if (fs.existsSync(outputPath)) {
          resizePairs.push({
            sourcePath: task.sourcePath,
            translatedPath: outputPath,
          });
        }
      }
    }

    const resizeResult = await batchValidateAndResize(resizePairs);

    if (resizeResult.resized > 0) {
      results.push(
        `   🔧 Resized ${resizeResult.resized} images to match source dimensions`
      );
    } else {
      results.push(`   ✅ All image dimensions match source`);
    }

    if (resizeResult.errors.length > 0) {
      results.push(`   ⚠️ Resize errors: ${resizeResult.errors.length}`);
    }
  }

  // Summary
  const screenshotsDir = getScreenshotsDir(appInfo.slug);
  results.push(`\n📁 Output location: ${screenshotsDir}/`);
  results.push(`\n✅ Screenshot localization complete!`);

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
