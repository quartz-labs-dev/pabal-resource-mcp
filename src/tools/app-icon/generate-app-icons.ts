/**
 * generate-app-icons: Generate app icons in various formats from base icon
 *
 * This tool:
 * 1. Reads base icon (icon.png) from icons folder
 * 2. Generates platform-specific icon variations:
 *    - iOS app icon (1024x1024, fits within 890px circle)
 *    - Android adaptive icon (1024x1024, fits within 475px circle)
 *    - Splash screen icon (1024x1024, fits within 614px circle)
 *    - Android notification icon (500x500, white logo on transparent)
 * 3. Handles background colors (transparent or custom hex color)
 * 4. Uses Gemini API for white masking on notification icon
 *
 * Run this tool to generate all required app icon variations.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { findRegisteredApp } from "../../utils/registered-apps.util.js";
import { getProductsDir } from "../../utils/config.util.js";
import {
  ICON_SPECS,
  ALL_ICON_TYPES,
  getIconsDir,
  getBaseIconPath,
  getIconOutputPath,
  type IconType,
} from "./utils/icon-specs.util.js";
import {
  resizeIconWithSafeZone,
  resizeToExact,
  parseHexColor,
  convertToWhiteMask,
  type RgbColor,
  type ResizeOptions,
  type LogoAlignment,
} from "./utils/icon-resizer.util.js";
import { applyWhiteMasking } from "./utils/icon-masking.util.js";
import type { ProductConfig } from "../../types/products/product-config.types.js";

const TOOL_NAME = "generate-app-icons";

export const generateAppIconsInputSchema = z.object({
  appName: z
    .string()
    .describe(
      "App name, slug, bundleId, or packageName to search for. Will be validated using search-app."
    ),
  iconTypes: z
    .array(
      z.enum([
        "ios-light",
        "adaptive-icon",
        "splash-icon-light",
        "android-notification-icon",
      ])
    )
    .optional()
    .describe(
      "Specific icon types to generate. If not provided, all icon types will be generated."
    ),
  styleFolder: z
    .string()
    .optional()
    .describe(
      "Style folder name for themed icons (e.g., 'christmas', 'halloween'). " +
        "Icons will be generated in icons/{styleFolder}/ directory. " +
        "If specified and style exists in config, uses style-specific defaults for backgroundColor and alignment."
    ),
  backgroundColor: z
    .string()
    .optional()
    .describe(
      'Background color as hex (e.g., "#FFFFFF") or "transparent" (default: transparent or config default). ' +
        "Only applies to icons with backgrounds (iOS, adaptive, splash). Notification icon is always transparent."
    ),
  logoAlignment: z
    .enum([
      "center",
      "left",
      "right",
      "top",
      "bottom",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ])
    .optional()
    .describe(
      "Logo alignment within the canvas (default: center or config default). " +
        "Affects how the logo is positioned relative to the safe zone."
    ),
  useAiMasking: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Use Gemini API for intelligent white masking on notification icon (default: false). " +
        "When false, uses Sharp-based threshold conversion (faster, free, no API key needed). " +
        "When true, uses Gemini AI for more sophisticated logo extraction (requires GEMINI_API_KEY)."
    ),
  logoPosition: z
    .string()
    .optional()
    .describe(
      "Additional prompt for logo positioning when using AI masking (e.g., 'centered', 'slightly above center'). " +
        "Only used when useAiMasking is true."
    ),
  skipExisting: z
    .boolean()
    .optional()
    .default(false)
    .describe("Skip generation if output file already exists (default: false)"),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Preview mode - shows what would be generated without actually generating"
    ),
});

export type GenerateAppIconsInput = z.infer<
  typeof generateAppIconsInputSchema
>;

const jsonSchema = zodToJsonSchema(generateAppIconsInputSchema as any, {
  name: "GenerateAppIconsInput",
  $refStrategy: "none",
});

const inputSchema =
  jsonSchema.definitions?.GenerateAppIconsInput || jsonSchema;

export const generateAppIconsTool = {
  name: TOOL_NAME,
  description: `Generate app icons in various platform-specific formats from a base icon.

**INPUT:** Reads base icon from: \`{slug}/icons/icon.png\` or \`{slug}/icons/{styleFolder}/icon.png\`
**OUTPUT:** Generates platform-specific icons in: \`{slug}/icons/\` or \`{slug}/icons/{styleFolder}/\`

**Generated Icons:**
1. **ios-light.png** (1024x1024): iOS app icon, logo fits within 890px circle
2. **adaptive-icon.png** (1024x1024): Android adaptive icon, logo fits within 475px circle
3. **splash-icon-light.png** (1024x1024): Splash screen icon, logo fits within 614px circle
4. **android-notification-icon.png** (500x500): White logo on transparent background

**Key Features:**
- **Automatic Padding Removal**: Extracts actual logo from icon.png (removes surrounding padding)
- **Smart Safe Zone Positioning**: Logo automatically fits within platform-specific circles
- **Flexible Alignment**: Position logo center/left/right/top/bottom relative to safe zone
- **White Masking**: Sharp-based (default, fast, free) or AI-powered (Gemini, more sophisticated)
- **Custom Background**: Hex colors or transparent backgrounds
- **Style Variants**: Generate themed icons (christmas, halloween, etc.) with style-specific defaults
- **Config Integration**: Uses config.json appIcon settings for default colors and alignment

**White Masking Options:**
- **Default (useAiMasking=false)**: Sharp threshold conversion - fast, free, no API key needed
- **AI-Powered (useAiMasking=true)**: Gemini API - more sophisticated, requires GEMINI_API_KEY

**Example:**
\`\`\`
INPUT:  my-app/icons/icon.png (source logo with padding)
        ↓ (padding removed automatically)
OUTPUT: my-app/icons/ios-light.png (logo centered in safe zone)
        my-app/icons/adaptive-icon.png (logo aligned as specified)
        my-app/icons/splash-icon-light.png
        my-app/icons/android-notification-icon.png (white mask, Sharp or AI)

With styleFolder='christmas':
INPUT:  my-app/icons/christmas/icon.png
OUTPUT: my-app/icons/christmas/ios-light.png (uses christmas style defaults)
        my-app/icons/christmas/adaptive-icon.png
        ...
\`\`\``,
  inputSchema,
};

function validateApp(
  appName: string
): { slug: string; name: string; config?: ProductConfig } {
  const { app } = findRegisteredApp(appName);

  if (!app) {
    throw new Error(
      `App not found: "${appName}". Use search-app tool to find the correct app name.`
    );
  }

  // Load config.json if exists
  const productsDir = getProductsDir();
  const configPath = path.join(productsDir, app.slug, "config.json");
  let config: ProductConfig | undefined;

  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(configData) as ProductConfig;
    } catch (error) {
      // Config exists but couldn't be parsed - continue without it
      console.warn(
        `⚠️ Could not parse config.json for ${app.slug}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return {
    slug: app.slug,
    name: app.name || app.slug,
    config,
  };
}

interface GenerationTask {
  iconType: IconType;
  inputPath: string;
  outputPath: string;
  spec: (typeof ICON_SPECS)[IconType];
}

function buildGenerationTasks(
  slug: string,
  iconTypes: IconType[],
  skipExisting: boolean,
  styleFolder?: string
): { tasks: GenerationTask[]; baseIconPath: string } {
  const tasks: GenerationTask[] = [];
  const baseIconPath = getBaseIconPath(slug, styleFolder);
  const iconsDir = getIconsDir(slug, styleFolder);

  // Verify base icon exists
  if (!fs.existsSync(baseIconPath)) {
    throw new Error(
      `Base icon not found: ${baseIconPath}\n\nPlease place your base icon at this location first.`
    );
  }

  // Build tasks for each icon type
  for (const iconType of iconTypes) {
    const outputPath = getIconOutputPath(slug, iconType, styleFolder);

    if (skipExisting && fs.existsSync(outputPath)) {
      continue;
    }

    tasks.push({
      iconType,
      inputPath: baseIconPath,
      outputPath,
      spec: ICON_SPECS[iconType],
    });
  }

  return { tasks, baseIconPath };
}

interface GenerationProgress {
  current: number;
  total: number;
  iconType: IconType;
  status: "generating" | "completed" | "failed";
  error?: string;
}

async function generateIcons(
  tasks: GenerationTask[],
  backgroundColor: RgbColor | "transparent",
  logoAlignment: LogoAlignment,
  useAiMasking: boolean,
  logoPosition?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<{
  total: number;
  generated: number;
  errors: Array<{ iconType: IconType; error: string }>;
}> {
  let generatedCount = 0;
  const errors: Array<{ iconType: IconType; error: string }> = [];
  const total = tasks.length;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    const progress: GenerationProgress = {
      current: i + 1,
      total,
      iconType: task.iconType,
      status: "generating",
    };

    onProgress?.(progress);

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(task.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Special handling for notification icon (needs white masking)
      if (task.iconType === "android-notification-icon") {
        if (useAiMasking) {
          // AI-powered masking using Gemini API
          const tempPath = task.outputPath.replace(".png", ".temp.png");
          await resizeToExact(task.inputPath, tempPath, task.spec.size);

          const result = await applyWhiteMasking(
            tempPath,
            task.outputPath,
            logoPosition
          );

          // Clean up temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }

          if (!result.success) {
            throw new Error(result.error || "AI white masking failed");
          }
        } else {
          // Sharp-based threshold conversion (default, faster, free)
          const whiteMask = await convertToWhiteMask(task.inputPath);

          // Resize to target size
          await sharp(whiteMask)
            .resize(task.spec.size, task.spec.size, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toFile(task.outputPath);
        }
      } else {
        // Regular icons with safe zone positioning and alignment
        await resizeIconWithSafeZone(
          task.inputPath,
          task.outputPath,
          task.spec,
          { backgroundColor, alignment: logoAlignment }
        );
      }

      progress.status = "completed";
      onProgress?.(progress);
      generatedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.status = "failed";
      progress.error = message;
      onProgress?.(progress);
      errors.push({ iconType: task.iconType, error: message });
    }
  }

  return {
    total,
    generated: generatedCount,
    errors,
  };
}

export async function handleGenerateAppIcons(
  input: GenerateAppIconsInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    appName,
    iconTypes: requestedIconTypes,
    styleFolder,
    backgroundColor: bgColorInput,
    logoAlignment: logoAlignmentInput,
    useAiMasking = false,
    logoPosition,
    skipExisting = false,
    dryRun = false,
  } = input;

  const results: string[] = [];

  // Step 1: Validate app and load config
  let appInfo: { slug: string; name: string; config?: ProductConfig };
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

  // Get style-specific config defaults if available
  const styleConfig =
    styleFolder && appInfo.config?.appIcon?.styles?.[styleFolder];
  const defaultBgColor =
    styleConfig?.backgroundColor ||
    appInfo.config?.appIcon?.defaultBackgroundColor ||
    "transparent";
  const defaultAlignment =
    styleConfig?.alignment ||
    appInfo.config?.appIcon?.defaultAlignment ||
    "center";

  // Use input values or fall back to config defaults
  const backgroundColor = bgColorInput ?? defaultBgColor;
  const logoAlignment = logoAlignmentInput ?? defaultAlignment;

  if (styleFolder) {
    results.push(`🎨 Style: ${styleFolder}`);
    if (styleConfig) {
      results.push(`   Using style-specific defaults from config`);
    }
  }

  // Step 2: Parse background color
  let bgColor: RgbColor | "transparent" = "transparent";
  if (backgroundColor && backgroundColor !== "transparent") {
    const parsed = parseHexColor(backgroundColor);
    if (parsed) {
      bgColor = parsed;
      results.push(`🎨 Background color: ${backgroundColor}`);
    } else {
      results.push(
        `⚠️ Invalid background color: ${backgroundColor} (using transparent)`
      );
    }
  } else {
    results.push(`🎨 Background: transparent`);
  }

  // Step 3: Determine icon types to generate
  const iconTypes = requestedIconTypes || ALL_ICON_TYPES;
  results.push(`🎯 Icon types: ${iconTypes.join(", ")}`);
  results.push(`📐 Logo alignment: ${logoAlignment}`);

  if (useAiMasking) {
    results.push(`🤖 AI masking: enabled (uses Gemini API)`);
    if (logoPosition) {
      results.push(`📍 Logo positioning: ${logoPosition}`);
    }
  } else {
    results.push(`⚡ AI masking: disabled (uses Sharp threshold)`);
  }

  // Step 4: Build generation tasks
  let tasks: GenerationTask[];
  let baseIconPath: string;

  try {
    const taskInfo = buildGenerationTasks(
      appInfo.slug,
      iconTypes,
      skipExisting,
      styleFolder
    );
    tasks = taskInfo.tasks;
    baseIconPath = taskInfo.baseIconPath;

    results.push(`\n📁 Base icon: ${baseIconPath}`);
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

  if (tasks.length === 0) {
    results.push(`\n✅ All icons already exist or no icons to generate.`);
    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  results.push(`\n📋 Generation tasks: ${tasks.length} icons to generate`);

  // Dry run - just show what would be done
  if (dryRun) {
    results.push(`\n🔍 DRY RUN - No actual generation will be performed\n`);

    for (const task of tasks) {
      results.push(`📱 ${task.iconType}:`);
      results.push(`   Size: ${task.spec.size}x${task.spec.size}`);
      if (task.spec.safeZoneRadius) {
        results.push(
          `   Safe zone: ${task.spec.safeZoneRadius * 2}px diameter circle`
        );
      }
      results.push(`   Output: ${task.outputPath}`);
      results.push(``);
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

  // Step 5: Generate icons
  results.push(`\n🚀 Starting icon generation...`);

  const generationResult = await generateIcons(
    tasks,
    bgColor,
    logoAlignment,
    useAiMasking,
    logoPosition,
    (progress) => {
      const progressPrefix = `[${progress.current}/${progress.total}]`;
      if (progress.status === "generating") {
        console.log(`🔄 ${progressPrefix} Generating ${progress.iconType}...`);
      } else if (progress.status === "completed") {
        console.log(`✅ ${progressPrefix} ${progress.iconType}`);
      } else if (progress.status === "failed") {
        console.log(
          `❌ ${progressPrefix} ${progress.iconType}: ${progress.error}`
        );
      }
    }
  );

  results.push(`\n📊 Generation Results:`);
  results.push(`   ✅ Generated: ${generationResult.generated}`);

  if (generationResult.errors.length > 0) {
    results.push(`   ❌ Failed: ${generationResult.errors.length}`);
  }

  if (generationResult.errors.length > 0) {
    results.push(`\n⚠️ Errors:`);
    for (const err of generationResult.errors) {
      results.push(`   - ${err.iconType}: ${err.error}`);
    }
  }

  // Summary
  const iconsDir = getIconsDir(appInfo.slug, styleFolder);
  results.push(`\n📁 Output location: ${iconsDir}/`);
  results.push(`\n✅ Icon generation complete!`);

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
