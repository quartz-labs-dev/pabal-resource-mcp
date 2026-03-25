/**
 * phone-to-tablet: Convert phone screenshots to tablet screenshots
 *
 * This tool:
 * 1. Reads phone screenshot images from the primary locale
 * 2. Uses Gemini API to adapt screenshots to tablet canvas size
 *    - Preserves original UI/content and avoids redesigning layout
 * 3. Saves generated tablet images to raw/ folder
 *
 * Use resize-screenshots --deviceTypes tablet after this tool to resize images to final dimensions.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { findRegisteredApp } from "../../utils/registered-apps.util.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "../aso/utils/improve/load-product-locales.util.js";
import {
  scanLocaleScreenshots,
  getScreenshotsDir,
  type ScreenshotInfo,
} from "./utils/scan-screenshots.util.js";
import {
  GEMINI_IMAGE_MODEL_PRESETS,
  GEMINI_IMAGE_MODEL_VALUES,
  type GeminiImageModelPreference,
} from "../../utils/gemini-image-model.util.js";
import { createGeminiClient } from "../../utils/gemini-client.util.js";
import { readImageAsBase64 } from "../../utils/image-file.util.js";
import { generateImageWithFallback } from "../../utils/gemini-image-generation.util.js";

const TOOL_NAME = "phone-to-tablet";

// Gemini aspect ratio for tablet (3:4 = 0.75)
const TABLET_ASPECT_RATIO = "3:4";

export const phoneToTabletInputSchema = z.object({
  appName: z
    .string()
    .describe(
      "App name, slug, bundleId, or packageName to search for. Will be validated using search-app."
    ),
  targetLocales: z
    .array(z.string())
    .optional()
    .describe(
      "Specific target locales to process. If not provided, only the primary locale will be processed."
    ),
  screenshotNumbers: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      "Specific screenshot numbers to process. Example: [1, 3, 5]. If not provided, all phone screenshots will be processed."
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Preview mode - shows what would be converted without actually converting"
    ),
  skipExisting: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Skip conversion if target tablet raw file already exists (default: true)"
    ),
  preserveWords: z
    .array(z.string())
    .optional()
    .describe(
      'Words to keep exactly as-is in the generated image (e.g., brand names). Example: ["Pabal", "Pro", "AI"]'
    ),
  imageModel: z
    .enum(GEMINI_IMAGE_MODEL_VALUES)
    .optional()
    .default("flash")
    .describe(
      "Gemini image model preference. 'flash' (default) is faster/cheaper, 'pro' prioritizes quality."
    ),
});

export type PhoneToTabletInput = z.infer<typeof phoneToTabletInputSchema>;

const jsonSchema = zodToJsonSchema(phoneToTabletInputSchema as any, {
  name: "PhoneToTabletInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.PhoneToTabletInput || jsonSchema;

export const phoneToTabletTool = {
  name: TOOL_NAME,
  description: `Convert phone screenshots to tablet screenshots using Gemini API.

**PURPOSE:** Generate tablet-sized screenshots from existing phone screenshots by:
1. Reading phone screenshots from the source locale
2. Using Gemini to keep the same UI while adapting to a tablet canvas
3. Preserving original content/layout without creating new UI

**OUTPUT:** Saves generated tablet images to raw/ folder: \`{locale}/tablet/raw/{filename}\`

**IMPORTANT:** This tool saves RAW generated images without resizing.
Run \`resize-screenshots --deviceTypes tablet\` after this tool to resize images to final dimensions.

**Workflow:**
1. Run \`phone-to-tablet\` -> saves to tablet/raw/ folder
2. Run \`resize-screenshots --deviceTypes tablet\` -> reads from raw/, resizes, saves to final location

**Requirements:**
- GEMINI_API_KEY or GOOGLE_API_KEY environment variable must be set
- Phone screenshots must exist in: public/products/{slug}/screenshots/{locale}/phone/
- Locale files must exist in: public/products/{slug}/locales/

**Model Selection:**
- \`imageModel: "flash"\` (default) for speed/cost
- \`imageModel: "pro"\` for higher instruction fidelity

**Example output structure:**
\`\`\`
public/products/my-app/screenshots/
├── en-US/
│   ├── phone/
│   │   ├── 1.png
│   │   └── 2.png
│   └── tablet/
│       └── raw/              # Generated from phone
│           ├── 1.png
│           └── 2.png
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

interface ConversionTask {
  phonePath: string;
  tabletRawPath: string;
  locale: string;
  filename: string;
}

function buildConversionTasks(
  slug: string,
  phoneScreenshots: ScreenshotInfo[],
  locale: string,
  screenshotNumbers: number[] | undefined,
  skipExisting: boolean
): ConversionTask[] {
  const tasks: ConversionTask[] = [];
  const screenshotsDir = getScreenshotsDir(slug);

  // Filter by screenshot numbers if specified
  let filteredScreenshots = phoneScreenshots;
  if (screenshotNumbers && screenshotNumbers.length > 0) {
    filteredScreenshots = phoneScreenshots.filter((s) => {
      const match = s.filename.match(/^(\d+)\./);
      if (!match) return false;
      const num = parseInt(match[1], 10);
      return screenshotNumbers.includes(num);
    });
  }

  for (const screenshot of filteredScreenshots) {
    const tabletRawPath = path.join(
      screenshotsDir,
      locale,
      "tablet",
      "raw",
      screenshot.filename
    );

    if (skipExisting && fs.existsSync(tabletRawPath)) {
      continue;
    }

    tasks.push({
      phonePath: screenshot.fullPath,
      tabletRawPath,
      locale,
      filename: screenshot.filename,
    });
  }

  return tasks;
}

interface ConversionProgress {
  current: number;
  total: number;
  locale: string;
  filename: string;
  status: "converting" | "completed" | "failed";
  error?: string;
}

/**
 * Convert a single phone screenshot to tablet using Gemini API
 */
async function convertPhoneToTablet(
  phonePath: string,
  tabletRawPath: string,
  preserveWords?: string[],
  imageModel: GeminiImageModelPreference = "flash"
): Promise<{ success: boolean; error?: string }> {
  const client = createGeminiClient();

  // Read the source image
  const { data: imageData, mimeType } = readImageAsBase64(phonePath);

  // Build preserve words instruction if provided
  const preserveInstruction =
    preserveWords && preserveWords.length > 0
      ? `\n- Do NOT change these words, keep them exactly as-is: ${preserveWords.join(", ")}`
      : "";

  // Create the conversion prompt
  const prompt = `Convert this PHONE app screenshot into a TABLET screenshot.

IMPORTANT INSTRUCTIONS:
- Preserve the original UI exactly: same components, text, icons, colors, and visual hierarchy
- Do NOT redesign, recompose, or invent any new UI
- Do NOT add/remove/reorder elements
- Do NOT create side-by-side layouts, new panels, or alternative arrangements
- Keep the same screen content and structure from the phone screenshot
- Only adapt to tablet aspect ratio (3:4) by extending canvas width as needed
- Keep the original content centered and unchanged as much as possible
- Use matching background fill/empty space for extra horizontal area
- If a device frame exists, keep the same frame style and avoid changing its design${preserveInstruction}

Output one tablet screenshot that looks like the original phone screenshot placed on a wider tablet canvas.`;

  try {
    const generated = await generateImageWithFallback({
      client,
      prompt,
      image: {
        mimeType,
        data: imageData,
      },
      aspectRatio: TABLET_ASPECT_RATIO,
      imageModel,
    });

    const imageBuffer = Buffer.from(generated.imageBase64, "base64");

    // Ensure output directory exists
    const outputDir = path.dirname(tabletRawPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Convert to PNG and save
    await sharp(imageBuffer).png().toFile(tabletRawPath);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch convert phone screenshots to tablet with progress tracking
 */
async function convertWithProgress(
  tasks: ConversionTask[],
  onProgress?: (progress: ConversionProgress) => void,
  preserveWords?: string[],
  imageModel: GeminiImageModelPreference = "flash"
): Promise<{
  successful: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}> {
  let successful = 0;
  let failed = 0;
  const errors: Array<{ path: string; error: string }> = [];
  const total = tasks.length;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const current = i + 1;

    const progress: ConversionProgress = {
      current,
      total,
      locale: task.locale,
      filename: task.filename,
      status: "converting",
    };

    onProgress?.(progress);

    const result = await convertPhoneToTablet(
      task.phonePath,
      task.tabletRawPath,
      preserveWords,
      imageModel
    );

    if (result.success) {
      successful++;
      progress.status = "completed";
    } else {
      failed++;
      progress.status = "failed";
      progress.error = result.error;
      errors.push({
        path: task.phonePath,
        error: result.error || "Unknown error",
      });
    }

    onProgress?.(progress);

    // Add a small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { successful, failed, errors };
}

export async function handlePhoneToTablet(
  input: PhoneToTabletInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    appName,
    targetLocales: requestedTargetLocales,
    screenshotNumbers,
    dryRun = false,
    skipExisting = true,
    preserveWords,
    imageModel = "flash",
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

  // Step 3: Determine which locales to process
  let localesToProcess = [primaryLocale];
  if (requestedTargetLocales && requestedTargetLocales.length > 0) {
    const validTargets = requestedTargetLocales.filter((t) =>
      allLocales.includes(t)
    );
    const invalidTargets = requestedTargetLocales.filter(
      (t) => !allLocales.includes(t)
    );

    if (invalidTargets.length > 0) {
      results.push(`⚠️ Skipped invalid locales: ${invalidTargets.join(", ")}`);
    }

    if (validTargets.length > 0) {
      localesToProcess = validTargets;
    }
  }

  results.push(`🎯 Locales to process: ${localesToProcess.join(", ")}`);
  results.push(
    `🧠 Image model: ${imageModel} (${GEMINI_IMAGE_MODEL_PRESETS[imageModel]})`
  );

  // Step 4: Build conversion tasks for all locales
  const allTasks: ConversionTask[] = [];

  for (const locale of localesToProcess) {
    // Scan phone screenshots for this locale
    const phoneScreenshots = scanLocaleScreenshots(appInfo.slug, locale).filter(
      (s) => s.type === "phone"
    );

    if (phoneScreenshots.length === 0) {
      results.push(`⚠️ No phone screenshots found for locale: ${locale}`);
      continue;
    }

    const tasks = buildConversionTasks(
      appInfo.slug,
      phoneScreenshots,
      locale,
      screenshotNumbers,
      skipExisting
    );

    allTasks.push(...tasks);
  }

  if (allTasks.length === 0) {
    const screenshotsDir = getScreenshotsDir(appInfo.slug);
    results.push(
      `\n✅ All tablet screenshots already exist or no phone screenshots found.`
    );
    results.push(
      `\nExpected phone screenshots in: ${screenshotsDir}/{locale}/phone/`
    );
    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  results.push(`\n📋 Conversion tasks: ${allTasks.length} images to convert`);

  if (screenshotNumbers && screenshotNumbers.length > 0) {
    results.push(`🔢 Filtering screenshots: ${screenshotNumbers.join(", ")}`);
  }

  // Dry run - just show what would be done
  if (dryRun) {
    results.push(`\n🔍 DRY RUN - No actual conversions will be performed\n`);

    const tasksByLocale: Record<string, ConversionTask[]> = {};
    for (const task of allTasks) {
      if (!tasksByLocale[task.locale]) {
        tasksByLocale[task.locale] = [];
      }
      tasksByLocale[task.locale].push(task);
    }

    for (const [locale, localeTasks] of Object.entries(tasksByLocale)) {
      results.push(`\n📁 ${locale}:`);
      for (const task of localeTasks) {
        results.push(
          `   - phone/${task.filename} -> tablet/raw/${task.filename}`
        );
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

  // Step 5: Execute conversions
  results.push(`\n🚀 Starting phone-to-tablet conversions...`);
  results.push(
    `📂 Output: tablet/raw/ folder (use resize-screenshots to finalize)`
  );

  if (preserveWords && preserveWords.length > 0) {
    results.push(`🔒 Preserving words: ${preserveWords.join(", ")}`);
  }

  const conversionResult = await convertWithProgress(
    allTasks,
    (progress: ConversionProgress) => {
      const progressPrefix = `[${progress.current}/${progress.total}]`;
      if (progress.status === "converting") {
        console.warn(
          `🔄 ${progressPrefix} Converting ${progress.locale}/phone/${progress.filename} to tablet...`
        );
      } else if (progress.status === "completed") {
        console.warn(
          `✅ ${progressPrefix} ${progress.locale}/tablet/raw/${progress.filename}`
        );
      } else if (progress.status === "failed") {
        console.error(
          `❌ ${progressPrefix} ${progress.locale}/${progress.filename}: ${progress.error}`
        );
      }
    },
    preserveWords,
    imageModel
  );

  results.push(`\n📊 Conversion Results:`);
  results.push(`   ✅ Successful: ${conversionResult.successful}`);
  results.push(`   ❌ Failed: ${conversionResult.failed}`);

  if (conversionResult.errors.length > 0) {
    results.push(`\n⚠️ Errors:`);
    for (const err of conversionResult.errors.slice(0, 5)) {
      results.push(`   - ${path.basename(err.path)}: ${err.error}`);
    }
    if (conversionResult.errors.length > 5) {
      results.push(
        `   ... and ${conversionResult.errors.length - 5} more errors`
      );
    }
  }

  // Summary
  const screenshotsDir = getScreenshotsDir(appInfo.slug);
  results.push(`\n📁 Output location: ${screenshotsDir}/{locale}/tablet/raw/`);
  results.push(`\n✅ Phone-to-tablet conversion complete!`);
  results.push(
    `\n💡 Next step: Run \`resize-screenshots\` to resize images to final dimensions.`
  );

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
