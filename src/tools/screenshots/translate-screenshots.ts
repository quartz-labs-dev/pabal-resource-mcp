/**
 * translate-screenshots: Translate app screenshots to multiple languages
 *
 * This tool:
 * 1. Validates the app using search-app tool
 * 2. Reads supported locales from the product's locales directory
 * 3. Scans screenshots from the primary locale folder
 * 4. Uses Gemini API to translate text in images to all supported languages
 * 5. Saves translated images to raw/ folder (without resizing)
 *
 * Use resize-screenshots after this tool to resize images to final dimensions.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import { findRegisteredApp } from "../../utils/registered-apps.util.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "../aso/utils/improve/load-product-locales.util.js";
import {
  scanLocaleScreenshots,
  getScreenshotsDir,
  ensureRawOutputDir,
  type ScreenshotInfo,
} from "./utils/scan-screenshots.util.js";
import {
  translateImagesWithProgress,
  type TranslationProgress,
} from "./utils/gemini-image-translator.util.js";
import {
  prepareLocalesForTranslation,
  type LocaleMapping,
  type GeminiTargetLocale,
} from "./utils/locale-mapping.constants.js";

const TOOL_NAME = "translate-screenshots";

export const translateScreenshotsInputSchema = z.object({
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
    .describe("Skip translation if target raw file already exists (default: true)"),
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

export type TranslateScreenshotsInput = z.infer<
  typeof translateScreenshotsInputSchema
>;

const jsonSchema = zodToJsonSchema(translateScreenshotsInputSchema as any, {
  name: "TranslateScreenshotsInput",
  $refStrategy: "none",
});

const inputSchema =
  jsonSchema.definitions?.TranslateScreenshotsInput || jsonSchema;

export const translateScreenshotsTool = {
  name: TOOL_NAME,
  description: `Translate app screenshots to multiple languages using Gemini API.

**OUTPUT:** Saves translated images to raw/ folder: \`{locale}/{deviceType}/raw/{filename}\`

**IMPORTANT:** This tool saves RAW translated images without resizing.
Use \`resize-screenshots\` after this tool to resize images to final dimensions.

**Workflow:**
1. Run \`translate-screenshots\` -> saves to raw/ folder
2. Run \`resize-screenshots\` -> reads from raw/, resizes, saves to final location

**Requirements:**
- GEMINI_API_KEY or GOOGLE_API_KEY environment variable must be set
- Screenshots must be in: public/products/{slug}/screenshots/{locale}/phone/ and /tablet/
- Locale files must exist in: public/products/{slug}/locales/

**Example output structure:**
\`\`\`
public/products/my-app/screenshots/
├── en-US/                    # Source (primary locale)
│   └── phone/
│       ├── 1.png
│       └── 2.png
├── ko-KR/
│   └── phone/
│       └── raw/              # Translated (not resized)
│           ├── 1.png
│           └── 2.png
└── ja-JP/
    └── phone/
        └── raw/
            ├── 1.png
            └── 2.png
\`\`\``,
  inputSchema,
};

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

function getTargetLocales(
  allLocales: string[],
  primaryLocale: string,
  requestedTargets?: string[]
): {
  targets: GeminiTargetLocale[];
  skippedLocales: string[];
  groupedLocales: string[];
  localeMapping: LocaleMapping;
} {
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

  localesToProcess = localesToProcess.filter((l) => l !== primaryLocale);

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
  targetLocale: GeminiTargetLocale;
  outputPaths: string[];
  deviceType: string;
  filename: string;
}

function buildTranslationTasks(
  slug: string,
  screenshots: ScreenshotInfo[],
  primaryLocale: string,
  targetLocales: GeminiTargetLocale[],
  localeMapping: LocaleMapping,
  skipExisting: boolean
): TranslationTask[] {
  const tasks: TranslationTask[] = [];
  const screenshotsDir = getScreenshotsDir(slug);

  for (const targetLocale of targetLocales) {
    const outputLocales = localeMapping.get(targetLocale) || [];

    for (const screenshot of screenshots) {
      const outputPaths: string[] = [];

      for (const locale of outputLocales) {
        // Save to raw/ folder
        const outputPath = path.join(
          screenshotsDir,
          locale,
          screenshot.type,
          "raw",
          screenshot.filename
        );

        if (!skipExisting || !fs.existsSync(outputPath)) {
          outputPaths.push(outputPath);
        }
      }

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

export async function handleTranslateScreenshots(
  input: TranslateScreenshotsInput
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

      if (!numbersForDevice || numbersForDevice.length === 0) {
        return true;
      }

      return numbersForDevice.includes(num);
    });

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

  // Step 5: Build translation tasks (output to raw/ folder)
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

    const tasksByLocale: Record<GeminiTargetLocale, typeof tasks> = {} as Record<
      GeminiTargetLocale,
      typeof tasks
    >;
    for (const task of tasks) {
      if (!tasksByLocale[task.targetLocale]) {
        tasksByLocale[task.targetLocale] = [];
      }
      tasksByLocale[task.targetLocale].push(task);
    }

    for (const [locale, localeTasks] of Object.entries(tasksByLocale)) {
      const grouped = localeMapping.get(locale as GeminiTargetLocale) || [];
      const groupedOthers = grouped.filter((l) => l !== locale);
      const groupInfo =
        groupedOthers.length > 0 ? ` -> also: ${groupedOthers.join(", ")}` : "";

      results.push(`\n📁 ${locale}${groupInfo} (raw/):`);
      for (const task of localeTasks) {
        results.push(`   - ${task.deviceType}/raw/${task.filename}`);
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

  // Step 6: Execute translations (save to raw/ folder)
  results.push(`\n🚀 Starting translations...`);
  results.push(`📂 Output: raw/ folder (use resize-screenshots to finalize)`);

  if (preserveWords && preserveWords.length > 0) {
    results.push(`🔒 Preserving words: ${preserveWords.join(", ")}`);
  }

  // Ensure raw output directories exist
  for (const task of tasks) {
    for (const outputPath of task.outputPaths) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }
  }

  const translationResult = await translateImagesWithProgress(
    tasks,
    (progress: TranslationProgress) => {
      const progressPrefix = `[${progress.current}/${progress.total}]`;
      if (progress.status === "translating") {
        console.log(
          `🔄 ${progressPrefix} Translating ${progress.targetLocale}/${progress.deviceType}/${progress.filename}...`
        );
      } else if (progress.status === "completed") {
        console.log(
          `✅ ${progressPrefix} ${progress.targetLocale}/${progress.deviceType}/raw/${progress.filename}`
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

  // Summary
  const screenshotsDir = getScreenshotsDir(appInfo.slug);
  results.push(`\n📁 Output location: ${screenshotsDir}/{locale}/{device}/raw/`);
  results.push(`\n✅ Screenshot translation complete!`);
  results.push(`\n💡 Next step: Run \`resize-screenshots\` to resize images to final dimensions.`);

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
