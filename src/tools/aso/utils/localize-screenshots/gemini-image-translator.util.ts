/**
 * Gemini API Image Translator Utility
 *
 * Translates text within images using Google Gemini API
 * Model: gemini-3-pro-image-preview
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getGeminiApiKey } from "../../../../utils/config.util.js";

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

// Gemini recommended languages for best performance
// Source: https://ai.google.dev/gemini-api/docs/image-generation
const GEMINI_SUPPORTED_LOCALES: Record<string, string> = {
  // English variants
  "en": "EN",
  "en-US": "EN",
  "en-GB": "EN",
  "en-AU": "EN",
  "en-CA": "EN",
  // Arabic
  "ar": "ar-EG",
  "ar-EG": "ar-EG",
  "ar-SA": "ar-EG",
  // German
  "de": "de-DE",
  "de-DE": "de-DE",
  // Spanish
  "es": "es-MX",
  "es-MX": "es-MX",
  "es-ES": "es-MX",
  "es-419": "es-MX",
  // French
  "fr": "fr-FR",
  "fr-FR": "fr-FR",
  "fr-CA": "fr-FR",
  // Hindi
  "hi": "hi-IN",
  "hi-IN": "hi-IN",
  // Indonesian
  "id": "id-ID",
  "id-ID": "id-ID",
  // Italian
  "it": "it-IT",
  "it-IT": "it-IT",
  // Japanese
  "ja": "ja-JP",
  "ja-JP": "ja-JP",
  // Korean
  "ko": "ko-KR",
  "ko-KR": "ko-KR",
  // Portuguese
  "pt": "pt-BR",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-BR",
  // Russian
  "ru": "ru-RU",
  "ru-RU": "ru-RU",
  // Ukrainian
  "uk": "ua-UA",
  "uk-UA": "ua-UA",
  "ua-UA": "ua-UA",
  // Vietnamese
  "vi": "vi-VN",
  "vi-VN": "vi-VN",
  // Chinese
  "zh": "zh-CN",
  "zh-CN": "zh-CN",
  "zh-Hans": "zh-CN",
  "zh-TW": "zh-CN",
  "zh-Hant": "zh-CN",
};

/**
 * Check if a locale is supported by Gemini for image translation
 */
export function isGeminiSupportedLocale(locale: string): boolean {
  return locale in GEMINI_SUPPORTED_LOCALES;
}

/**
 * Get list of unsupported locales from a list
 */
export function getUnsupportedLocales(locales: string[]): string[] {
  return locales.filter((locale) => !isGeminiSupportedLocale(locale));
}

// Language display names for better prompts
const LANGUAGE_NAMES: Record<string, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "ko-KR": "Korean",
  "ja-JP": "Japanese",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  "fr-FR": "French",
  "fr-CA": "French (Canada)",
  "de-DE": "German",
  "es-ES": "Spanish (Spain)",
  "es-419": "Spanish (Latin America)",
  "es-MX": "Spanish (Mexico)",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  "it-IT": "Italian",
  "nl-NL": "Dutch",
  "ru-RU": "Russian",
  "ar": "Arabic",
  "ar-SA": "Arabic",
  "hi-IN": "Hindi",
  "th-TH": "Thai",
  "vi-VN": "Vietnamese",
  "id-ID": "Indonesian",
  "ms-MY": "Malay",
  "tr-TR": "Turkish",
  "pl-PL": "Polish",
  "uk-UA": "Ukrainian",
  "cs-CZ": "Czech",
  "el-GR": "Greek",
  "ro-RO": "Romanian",
  "hu-HU": "Hungarian",
  "sv-SE": "Swedish",
  "da-DK": "Danish",
  "fi-FI": "Finnish",
  "no-NO": "Norwegian",
  "he-IL": "Hebrew",
  "sk-SK": "Slovak",
  "bg-BG": "Bulgarian",
  "hr-HR": "Croatian",
  "ca-ES": "Catalan",
};

/**
 * Get language display name from locale code
 */
function getLanguageName(locale: string): string {
  // Try exact match first
  if (LANGUAGE_NAMES[locale]) {
    return LANGUAGE_NAMES[locale];
  }

  // Try base language code
  const baseCode = locale.split("-")[0];
  const matchingKey = Object.keys(LANGUAGE_NAMES).find(
    (key) => key.startsWith(baseCode + "-") || key === baseCode
  );

  if (matchingKey) {
    return LANGUAGE_NAMES[matchingKey];
  }

  // Return the locale code itself as fallback
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

/**
 * Get Gemini aspect ratio for device type
 */
function getAspectRatioForDevice(deviceType: DeviceType): string {
  return DEVICE_ASPECT_RATIOS[deviceType];
}

/**
 * Translate text in an image using Gemini API
 */
export async function translateImage(
  sourcePath: string,
  sourceLocale: string,
  targetLocale: string,
  outputPath: string,
  deviceType: DeviceType,
  preserveWords?: string[]
): Promise<ImageTranslationResult> {
  try {
    const client = getGeminiClient();
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
          aspectRatio,
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
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Convert to PNG and save
        await sharp(imageBuffer).png().toFile(outputPath);

        return {
          success: true,
          outputPath,
        };
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
 * Batch translate images with progress tracking
 */
export async function translateImagesWithProgress(
  translations: Array<{
    sourcePath: string;
    sourceLocale: string;
    targetLocale: string;
    outputPath: string;
    deviceType: string;
    filename: string;
  }>,
  onProgress?: (progress: TranslationProgress) => void,
  preserveWords?: string[]
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
      translation.outputPath,
      translation.deviceType as DeviceType,
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
