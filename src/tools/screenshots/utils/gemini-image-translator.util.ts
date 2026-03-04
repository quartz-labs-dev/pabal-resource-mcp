/**
 * Gemini API Image Translator Utility
 *
 * Translates text within images using Google Gemini API
 * Default model: gemini-3.1-flash-image-preview (fallback: gemini-3-pro-image-preview)
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  GEMINI_IMAGE_MODEL_PRESETS,
  type GeminiImageModelPreference,
} from "../../../utils/gemini-image-model.util.js";
import { createGeminiClient } from "../../../utils/gemini-client.util.js";
import { readImageAsBase64 } from "../../../utils/image-file.util.js";
import { generateImageWithFallback } from "../../../utils/gemini-image-generation.util.js";
import { type GeminiTargetLocale } from "./locale-mapping.constants.js";

// App Store screenshot dimensions by device type
export const SCREENSHOT_DIMENSIONS = {
  phone: { width: 1242, height: 2688 }, // ratio: 0.462
  tablet: { width: 2048, height: 2732 }, // ratio: 0.750
} as const;

// Gemini supported aspect ratios with 2K output dimensions (same token cost as 1K)
// Source: https://ai.google.dev/gemini-api/docs/image-generation
const GEMINI_ASPECT_RATIOS = {
  "1:1": { ratio: 1 / 1, width: 2048, height: 2048 },
  "2:3": { ratio: 2 / 3, width: 1696, height: 2528 },
  "3:2": { ratio: 3 / 2, width: 2528, height: 1696 },
  "3:4": { ratio: 3 / 4, width: 1792, height: 2400 },
  "4:3": { ratio: 4 / 3, width: 2400, height: 1792 },
  "4:5": { ratio: 4 / 5, width: 1856, height: 2304 },
  "5:4": { ratio: 5 / 4, width: 2304, height: 1856 },
  "9:16": { ratio: 9 / 16, width: 1536, height: 2752 },
  "16:9": { ratio: 16 / 9, width: 2752, height: 1536 },
  "21:9": { ratio: 21 / 9, width: 1584, height: 672 },
} as const;

type GeminiAspectRatio = keyof typeof GEMINI_ASPECT_RATIOS;

// Closest Gemini aspect ratios for each device type
// Phone: 1242/2688 = 0.462, closest is 9:16 (0.5625)
// Tablet: 2048/2732 = 0.750, closest is 3:4 (0.75) ✓
const DEVICE_ASPECT_RATIOS: Record<DeviceType, GeminiAspectRatio> = {
  phone: "9:16",
  tablet: "3:4",
};

export type DeviceType = keyof typeof SCREENSHOT_DIMENSIONS;

/**
 * Language display names for Gemini-supported locales
 * Only includes locales that Gemini actually supports for image generation
 * Source: https://ai.google.dev/gemini-api/docs/image-generation
 */
const GEMINI_LANGUAGE_NAMES: Record<GeminiTargetLocale, string> = {
  "en-US": "English",
  "ar-EG": "Arabic",
  "de-DE": "German",
  "es-MX": "Spanish",
  "fr-FR": "French",
  "hi-IN": "Hindi",
  "id-ID": "Indonesian",
  "it-IT": "Italian",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "pt-BR": "Portuguese",
  "ru-RU": "Russian",
  "ua-UA": "Ukrainian",
  "vi-VN": "Vietnamese",
  "zh-CN": "Chinese",
};

/**
 * Get language display name from locale code
 * Works with Gemini-supported locales, falls back to locale code for others
 */
function getLanguageName(locale: string): string {
  if (locale in GEMINI_LANGUAGE_NAMES) {
    return GEMINI_LANGUAGE_NAMES[locale as GeminiTargetLocale];
  }
  return locale;
}

export interface ImageTranslationResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface TranslationProgress {
  sourceLocale: string;
  targetLocale: string;
  deviceType: string;
  filename: string;
  status: "pending" | "translating" | "completed" | "failed";
  error?: string;
  current: number;
  total: number;
}

/**
 * Get Gemini aspect ratio for device type
 */
function getAspectRatioForDevice(deviceType: DeviceType): string {
  return DEVICE_ASPECT_RATIOS[deviceType];
}

/**
 * Translate text in an image using Gemini API
 * Saves the result to multiple output paths (for grouped locales)
 */
export async function translateImage(
  sourcePath: string,
  sourceLocale: string,
  targetLocale: string,
  outputPaths: string[], // Multiple paths for grouped locales
  deviceType: DeviceType,
  preserveWords?: string[],
  imageModel: GeminiImageModelPreference = "flash"
): Promise<ImageTranslationResult> {
  const client = createGeminiClient();
  const sourceLanguage = getLanguageName(sourceLocale);
  const targetLanguage = getLanguageName(targetLocale);

  // Get aspect ratio for device type
  const aspectRatio = getAspectRatioForDevice(deviceType);

  // Read the source image
  const { data: imageData, mimeType } = readImageAsBase64(sourcePath);

  // Build preserve words instruction if provided
  const preserveInstruction =
    preserveWords && preserveWords.length > 0
      ? `\n- Do NOT translate these words, keep them exactly as-is: ${preserveWords.join(", ")}`
      : "";

  // Create the translation prompt
  const prompt = `This is an app screenshot with text in ${sourceLanguage}.
Please translate ONLY the text/words in this image to ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
- Keep the EXACT same layout, design, colors, and visual elements
- Only translate the visible text content to ${targetLanguage}
- Maintain the same font style and text positioning as much as possible
- Do NOT add any new elements or remove existing design elements
- The output should look identical except the text language is ${targetLanguage}
- Preserve all icons, images, and graphical elements exactly as they are${preserveInstruction}`;

  try {
    const generated = await generateImageWithFallback({
      client,
      prompt,
      image: {
        mimeType,
        data: imageData,
      },
      aspectRatio,
      imageModel,
    });

    const imageBuffer = Buffer.from(generated.imageBase64, "base64");

    // Save to all output paths (representative + grouped locales)
    for (const outputPath of outputPaths) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Convert to PNG and save
      await sharp(imageBuffer).png().toFile(outputPath);
    }

    return {
      success: true,
      outputPath: outputPaths[0], // Return primary path
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch translate images with progress tracking
 * Each translation can save to multiple output paths (for grouped locales)
 */
export async function translateImagesWithProgress(
  translations: Array<{
    sourcePath: string;
    sourceLocale: string;
    targetLocale: string;
    outputPaths: string[]; // Multiple paths for representative + grouped locales
    deviceType: string;
    filename: string;
  }>,
  onProgress?: (progress: TranslationProgress) => void,
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
  const total = translations.length;

  for (let i = 0; i < translations.length; i++) {
    const translation = translations[i];
    const current = i + 1;

    const progress: TranslationProgress = {
      sourceLocale: translation.sourceLocale,
      targetLocale: translation.targetLocale,
      deviceType: translation.deviceType,
      filename: translation.filename,
      status: "translating",
      current,
      total,
    };

    onProgress?.(progress);

    const result = await translateImage(
      translation.sourcePath,
      translation.sourceLocale,
      translation.targetLocale,
      translation.outputPaths,
      translation.deviceType as DeviceType,
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
        path: translation.sourcePath,
        error: result.error || "Unknown error",
      });
    }

    onProgress?.(progress);

    // Add a small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { successful, failed, errors };
}

export function getImageModelLabel(
  imageModel: GeminiImageModelPreference
): string {
  return `${imageModel} (${GEMINI_IMAGE_MODEL_PRESETS[imageModel]})`;
}
