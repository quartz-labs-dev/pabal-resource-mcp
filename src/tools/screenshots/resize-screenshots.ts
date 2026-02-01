/**
 * resize-screenshots: Resize translated screenshots to match source dimensions
 *
 * This tool:
 * 1. Reads translated images from raw/ folder
 * 2. Gets target dimensions from source locale screenshots
 * 3. Resizes images using high-quality Lanczos3 algorithm
 * 4. Preserves aspect ratio, fills with detected background color
 * 5. Saves to final location
 *
 * Run translate-screenshots first to generate raw images.
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
import type { ProductConfig } from "../../types/products/product-config.types.js";
import {
  scanLocaleScreenshots,
  scanRawLocales,
  scanRawScreenshots,
  getScreenshotsDir,
  type ScreenshotInfo,
} from "./utils/scan-screenshots.util.js";
import {
  getImageDimensions,
  resizeImage,
  parseHexColor,
  SCREENSHOT_DIMENSIONS,
  type ImageDimensions,
  type RgbColor,
  type DeviceType,
} from "./utils/image-resizer.util.js";

const TOOL_NAME = "resize-screenshots";

export const resizeScreenshotsInputSchema = z.object({
  appName: z
    .string()
    .describe(
      "App name, slug, bundleId, or packageName to search for. Will be validated using search-app."
    ),
  sourceLocale: z
    .string()
    .optional()
    .describe(
      "Locale to use as dimension reference (default: primary locale from config). " +
        "The source locale's screenshot dimensions will be used as the target size."
    ),
  targetLocales: z
    .array(z.string())
    .optional()
    .describe(
      "Specific target locales to resize. If not provided, all locales with raw/ folders will be processed."
    ),
  deviceTypes: z
    .array(z.enum(["phone", "tablet"]))
    .optional()
    .default(["phone", "tablet"])
    .describe("Device types to process (default: both phone and tablet)"),
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
        "If not provided, all screenshots in raw/ will be processed."
    ),
  skipExisting: z
    .boolean()
    .optional()
    .default(false)
    .describe("Skip resizing if final output file already exists (default: false)"),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Preview mode - shows what would be resized without actually resizing"
    ),
});

export type ResizeScreenshotsInput = z.infer<typeof resizeScreenshotsInputSchema>;

const jsonSchema = zodToJsonSchema(resizeScreenshotsInputSchema as any, {
  name: "ResizeScreenshotsInput",
  $refStrategy: "none",
});

const inputSchema =
  jsonSchema.definitions?.ResizeScreenshotsInput || jsonSchema;

export const resizeScreenshotsTool = {
  name: TOOL_NAME,
  description: `Resize translated screenshots to match source dimensions.

**INPUT:** Reads from raw/ folder: \`{locale}/{deviceType}/raw/{filename}\`
**OUTPUT:** Saves to final location: \`{locale}/{deviceType}/{filename}\`

**IMPORTANT:** Run \`translate-screenshots\` first to generate raw images.

**Workflow:**
1. Run \`translate-screenshots\` -> saves to raw/ folder
2. Run \`resize-screenshots\` -> reads from raw/, resizes, saves to final location

This tool:
1. Reads translated images from raw/ folder
2. Gets target dimensions from source locale screenshots
3. Resizes images using high-quality Lanczos3 algorithm
4. Preserves aspect ratio, fills with detected background color
5. Saves to final location

**Example:**
\`\`\`
BEFORE (raw/):                     AFTER (resized):
ko-KR/phone/raw/1.png (1536x2752)  ko-KR/phone/1.png (1242x2688)
ko-KR/phone/raw/2.png (1536x2752)  ko-KR/phone/2.png (1242x2688)
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
  config: ProductConfig | null;
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
    config,
  };
}

interface ResizeTask {
  rawPath: string;
  outputPath: string;
  sourceReferencePath: string;
  locale: string;
  deviceType: "phone" | "tablet";
  filename: string;
}

function buildResizeTasks(
  slug: string,
  sourceScreenshots: ScreenshotInfo[],
  rawLocales: string[],
  deviceTypes: Array<"phone" | "tablet">,
  screenshotNumbers: ResizeScreenshotsInput["screenshotNumbers"],
  skipExisting: boolean
): ResizeTask[] {
  const tasks: ResizeTask[] = [];
  const screenshotsDir = getScreenshotsDir(slug);

  // Build source reference map
  const sourceRefMap = new Map<string, string>();
  for (const screenshot of sourceScreenshots) {
    const key = `${screenshot.type}/${screenshot.filename}`;
    sourceRefMap.set(key, screenshot.fullPath);
  }

  for (const locale of rawLocales) {
    const rawScreenshots = scanRawScreenshots(slug, locale);

    // Filter by device types
    let filteredScreenshots = rawScreenshots.filter((s) =>
      deviceTypes.includes(s.type)
    );

    // Filter by screenshot numbers if specified
    if (screenshotNumbers) {
      const isArray = Array.isArray(screenshotNumbers);
      const phoneNumbers = isArray ? screenshotNumbers : screenshotNumbers.phone;
      const tabletNumbers = isArray ? screenshotNumbers : screenshotNumbers.tablet;

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
    }

    for (const screenshot of filteredScreenshots) {
      const key = `${screenshot.type}/${screenshot.filename}`;
      const sourceReferencePath = sourceRefMap.get(key);

      if (!sourceReferencePath) {
        continue;
      }

      const outputPath = path.join(
        screenshotsDir,
        locale,
        screenshot.type,
        screenshot.filename
      );

      if (skipExisting && fs.existsSync(outputPath)) {
        continue;
      }

      tasks.push({
        rawPath: screenshot.fullPath,
        outputPath,
        sourceReferencePath,
        locale,
        deviceType: screenshot.type,
        filename: screenshot.filename,
      });
    }
  }

  return tasks;
}

interface ResizeProgress {
  current: number;
  total: number;
  locale: string;
  deviceType: string;
  filename: string;
  status: "resizing" | "completed" | "failed" | "skipped";
  error?: string;
  dimensions?: {
    source: ImageDimensions;
    raw: ImageDimensions;
    final: ImageDimensions;
  };
}

async function batchResizeFromRaw(
  tasks: ResizeTask[],
  bgColor?: RgbColor,
  onProgress?: (progress: ResizeProgress) => void
): Promise<{
  total: number;
  resized: number;
  skipped: number;
  errors: Array<{ path: string; error: string }>;
}> {
  let resizedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ path: string; error: string }> = [];
  const total = tasks.length;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    const progress: ResizeProgress = {
      current: i + 1,
      total,
      locale: task.locale,
      deviceType: task.deviceType,
      filename: task.filename,
      status: "resizing",
    };

    onProgress?.(progress);

    try {
      if (!fs.existsSync(task.rawPath)) {
        progress.status = "skipped";
        onProgress?.(progress);
        skippedCount++;
        continue;
      }

      // Use fixed dimensions for device type
      const targetDimensions = SCREENSHOT_DIMENSIONS[task.deviceType];
      const rawDimensions = await getImageDimensions(task.rawPath);

      // Ensure output directory exists
      const outputDir = path.dirname(task.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Resize with config bgColor or auto-detect
      await resizeImage(task.rawPath, task.outputPath, targetDimensions, bgColor);

      progress.status = "completed";
      progress.dimensions = {
        source: targetDimensions,
        raw: rawDimensions,
        final: targetDimensions,
      };
      onProgress?.(progress);
      resizedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.status = "failed";
      progress.error = message;
      onProgress?.(progress);
      errors.push({ path: task.rawPath, error: message });
    }
  }

  return {
    total,
    resized: resizedCount,
    skipped: skippedCount,
    errors,
  };
}

export async function handleResizeScreenshots(
  input: ResizeScreenshotsInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    appName,
    sourceLocale: requestedSourceLocale,
    targetLocales: requestedTargetLocales,
    deviceTypes = ["phone", "tablet"],
    screenshotNumbers,
    skipExisting = false,
    dryRun = false,
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

  // Step 2: Get supported locales and determine source locale
  let sourceLocale: string;
  let bgColor: RgbColor | undefined;
  try {
    const { primaryLocale, config } = getSupportedLocales(appInfo.slug);
    sourceLocale = requestedSourceLocale || primaryLocale;
    results.push(`📍 Source locale: ${sourceLocale}`);

    // Parse background color from config if available
    const bgColorHex = config?.metadata?.screenshotBgColor;
    if (bgColorHex) {
      bgColor = parseHexColor(bgColorHex) ?? undefined;
      if (bgColor) {
        results.push(`🎨 Background color: ${bgColorHex}`);
      } else {
        results.push(`⚠️ Invalid screenshotBgColor: ${bgColorHex} (using auto-detect)`);
      }
    }
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

  // Step 3: Get source screenshots for dimension reference
  const sourceScreenshots = scanLocaleScreenshots(appInfo.slug, sourceLocale);

  if (sourceScreenshots.length === 0) {
    const screenshotsDir = getScreenshotsDir(appInfo.slug);
    return {
      content: [
        {
          type: "text",
          text: `❌ No source screenshots found in ${screenshotsDir}/${sourceLocale}/

Source screenshots are needed to determine target dimensions.`,
        },
      ],
    };
  }

  const sourcePhoneCount = sourceScreenshots.filter(
    (s) => s.type === "phone"
  ).length;
  const sourceTabletCount = sourceScreenshots.filter(
    (s) => s.type === "tablet"
  ).length;
  results.push(
    `📸 Source screenshots: ${sourcePhoneCount} phone, ${sourceTabletCount} tablet`
  );

  // Step 4: Find locales with raw/ folders
  const allRawLocales = scanRawLocales(appInfo.slug);

  if (allRawLocales.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `❌ No locales with raw/ folders found.

Run \`translate-screenshots\` first to generate raw images.`,
        },
      ],
    };
  }

  // Step 5: Filter target locales
  let rawLocales = allRawLocales;
  if (requestedTargetLocales && requestedTargetLocales.length > 0) {
    rawLocales = requestedTargetLocales.filter((l) => allRawLocales.includes(l));
    const invalidTargets = requestedTargetLocales.filter(
      (l) => !allRawLocales.includes(l)
    );

    if (invalidTargets.length > 0) {
      results.push(
        `⚠️ Skipped (no raw/ folder): ${invalidTargets.join(", ")}`
      );
    }
  }

  if (rawLocales.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `❌ No target locales have raw/ folders.

Available locales with raw/: ${allRawLocales.join(", ")}`,
        },
      ],
    };
  }

  results.push(`🎯 Target locales: ${rawLocales.join(", ")}`);

  // Step 6: Build resize tasks
  const tasks = buildResizeTasks(
    appInfo.slug,
    sourceScreenshots,
    rawLocales,
    deviceTypes,
    screenshotNumbers,
    skipExisting
  );

  if (tasks.length === 0) {
    results.push(
      `\n✅ All images already resized or no matching raw images found.`
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

  results.push(`\n📋 Resize tasks: ${tasks.length} images to resize`);

  // Dry run - just show what would be done
  if (dryRun) {
    results.push(`\n🔍 DRY RUN - No actual resizing will be performed\n`);

    const tasksByLocale: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      if (!tasksByLocale[task.locale]) {
        tasksByLocale[task.locale] = [];
      }
      tasksByLocale[task.locale].push(task);
    }

    for (const [locale, localeTasks] of Object.entries(tasksByLocale)) {
      results.push(`\n📁 ${locale}:`);
      for (const task of localeTasks) {
        results.push(
          `   - ${task.deviceType}/raw/${task.filename} -> ${task.deviceType}/${task.filename}`
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

  // Step 7: Execute resizing
  results.push(`\n🚀 Starting resize operations...`);
  results.push(`📐 Target dimensions: phone=${SCREENSHOT_DIMENSIONS.phone.width}x${SCREENSHOT_DIMENSIONS.phone.height}, tablet=${SCREENSHOT_DIMENSIONS.tablet.width}x${SCREENSHOT_DIMENSIONS.tablet.height}`);

  const resizeResult = await batchResizeFromRaw(tasks, bgColor, (progress) => {
    const progressPrefix = `[${progress.current}/${progress.total}]`;
    if (progress.status === "resizing") {
      console.log(
        `🔄 ${progressPrefix} Resizing ${progress.locale}/${progress.deviceType}/${progress.filename}...`
      );
    } else if (progress.status === "completed" && progress.dimensions) {
      const { raw, final } = progress.dimensions;
      console.log(
        `✅ ${progressPrefix} ${progress.locale}/${progress.deviceType}/${progress.filename} (${raw.width}x${raw.height} -> ${final.width}x${final.height})`
      );
    } else if (progress.status === "skipped") {
      console.log(
        `⏭️ ${progressPrefix} ${progress.locale}/${progress.deviceType}/${progress.filename} (raw not found)`
      );
    } else if (progress.status === "failed") {
      console.log(
        `❌ ${progressPrefix} ${progress.locale}/${progress.deviceType}/${progress.filename}: ${progress.error}`
      );
    }
  });

  results.push(`\n📊 Resize Results:`);
  results.push(`   ✅ Resized: ${resizeResult.resized}`);
  if (resizeResult.skipped > 0) {
    results.push(`   ⏭️ Skipped: ${resizeResult.skipped}`);
  }
  if (resizeResult.errors.length > 0) {
    results.push(`   ❌ Failed: ${resizeResult.errors.length}`);
  }

  if (resizeResult.errors.length > 0) {
    results.push(`\n⚠️ Errors:`);
    for (const err of resizeResult.errors.slice(0, 5)) {
      results.push(`   - ${path.basename(err.path)}: ${err.error}`);
    }
    if (resizeResult.errors.length > 5) {
      results.push(`   ... and ${resizeResult.errors.length - 5} more errors`);
    }
  }

  // Summary
  const screenshotsDir = getScreenshotsDir(appInfo.slug);
  results.push(`\n📁 Output location: ${screenshotsDir}/{locale}/{device}/`);
  results.push(`\n✅ Screenshot resizing complete!`);

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
