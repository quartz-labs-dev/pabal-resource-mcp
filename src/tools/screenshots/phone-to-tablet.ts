/**
 * phone-to-tablet: Convert phone screenshots to tablet screenshots
 *
 * This tool:
 * 1. Reads phone screenshot images from the primary locale
 * 2. Uses Gemini API to regenerate the UI as tablet-sized screenshots
 *    - Adjusts the internal device frame and UI layout for wider screens
 * 3. Saves generated tablet images to raw/ folder
 *
 * Use resize-screenshots --deviceTypes tablet after this tool to resize images to final dimensions.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
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
import { getGeminiApiKey } from "../../utils/config.util.js";

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
2. Using Gemini to regenerate the UI with a tablet-friendly wider layout
3. Adjusting internal device frame and UI components for larger screen

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

/**
 * Initialize Gemini client
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

/**
 * Read image file and convert to base64
 */
function readImageAsBase64(imagePath: string): {
  data: string;
  mimeType: string;
} {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString("base64");

  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") {
    mimeType = "image/jpeg";
  } else if (ext === ".webp") {
    mimeType = "image/webp";
  }

  return { data: base64, mimeType };
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
  preserveWords?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getGeminiClient();

    // Read the source image
    const { data: imageData, mimeType } = readImageAsBase64(phonePath);

    // Build preserve words instruction if provided
    const preserveInstruction =
      preserveWords && preserveWords.length > 0
        ? `\n- Do NOT change these words, keep them exactly as-is: ${preserveWords.join(", ")}`
        : "";

    // Create the conversion prompt
    const prompt = `This is a phone app screenshot. Please recreate this screenshot as a TABLET version.

IMPORTANT INSTRUCTIONS:
- Convert this phone UI layout to a tablet-friendly WIDER layout
- The tablet screen has a 3:4 aspect ratio (wider than phone's 9:16)
- Expand the UI horizontally to take advantage of the wider screen
- If there's a device frame mockup, change it to a tablet device frame
- Maintain the same visual style, colors, and design language
- Keep all the same content and text, just adjust the layout
- Use tablet-appropriate spacing and element sizes
- If the phone shows a single column, consider using wider cards or side-by-side layouts
- Keep the same app functionality visible, just optimized for tablet${preserveInstruction}

Generate a new tablet screenshot that represents the same app screen but optimized for tablet display.`;

    // Create chat session for image editing
    const chat = client.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Send message with image
    const response = await chat.sendMessage({
      message: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: imageData,
          },
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: TABLET_ASPECT_RATIO,
        },
      },
    });

    // Extract generated image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: "No response from Gemini API",
      };
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      return {
        success: false,
        error: "No content parts in response",
      };
    }

    // Find image data in response
    for (const part of parts) {
      if (part.inlineData?.data) {
        const imageBuffer = Buffer.from(part.inlineData.data, "base64");

        // Ensure output directory exists
        const outputDir = path.dirname(tabletRawPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Convert to PNG and save
        await sharp(imageBuffer).png().toFile(tabletRawPath);

        return { success: true };
      }
    }

    return {
      success: false,
      error: "No image data in Gemini response",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Batch convert phone screenshots to tablet with progress tracking
 */
async function convertWithProgress(
  tasks: ConversionTask[],
  onProgress?: (progress: ConversionProgress) => void,
  preserveWords?: string[]
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
      preserveWords
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
        console.log(
          `🔄 ${progressPrefix} Converting ${progress.locale}/phone/${progress.filename} to tablet...`
        );
      } else if (progress.status === "completed") {
        console.log(
          `✅ ${progressPrefix} ${progress.locale}/tablet/raw/${progress.filename}`
        );
      } else if (progress.status === "failed") {
        console.log(
          `❌ ${progressPrefix} ${progress.locale}/${progress.filename}: ${progress.error}`
        );
      }
    },
    preserveWords
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
