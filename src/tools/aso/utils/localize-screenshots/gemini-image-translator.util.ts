/**
 * Gemini API Image Translator Utility
 *
 * Translates text within images using Google Gemini API
 * Model: imagen-3.0-generate-002 (nano banana pro)
 */

import { GoogleGenAI, Modality } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { getGeminiApiKey } from "../../../../utils/config.util.js";

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
 * Translate text in an image using Gemini API
 */
export async function translateImage(
  sourcePath: string,
  sourceLocale: string,
  targetLocale: string,
  outputPath: string
): Promise<ImageTranslationResult> {
  try {
    const client = getGeminiClient();
    const sourceLanguage = getLanguageName(sourceLocale);
    const targetLanguage = getLanguageName(targetLocale);

    // Read the source image
    const { data: imageData, mimeType } = readImageAsBase64(sourcePath);

    // Create the translation prompt
    const prompt = `This is an app screenshot with text in ${sourceLanguage}.
Please translate ONLY the text/words in this image to ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
- Keep the EXACT same layout, design, colors, and visual elements
- Only translate the visible text content to ${targetLanguage}
- Maintain the same font style and text positioning as much as possible
- Do NOT add any new elements or remove existing design elements
- The output should look identical except the text language is ${targetLanguage}
- Preserve all icons, images, and graphical elements exactly as they are`;

    // Call Gemini API for image generation/editing
    const response = await client.models.generateContent({
      model: "imagen-3.0-generate-002",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageData,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
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

        // Save the translated image
        fs.writeFileSync(outputPath, imageBuffer);

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
  onProgress?: (progress: TranslationProgress) => void
): Promise<{
  successful: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}> {
  let successful = 0;
  let failed = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (const translation of translations) {
    const progress: TranslationProgress = {
      sourceLocale: translation.sourceLocale,
      targetLocale: translation.targetLocale,
      deviceType: translation.deviceType,
      filename: translation.filename,
      status: "translating",
    };

    onProgress?.(progress);

    const result = await translateImage(
      translation.sourcePath,
      translation.sourceLocale,
      translation.targetLocale,
      translation.outputPath
    );

    if (result.success) {
      successful++;
      progress.status = "completed";
    } else {
      failed++;
      progress.status = "failed";
      progress.error = result.error;
      errors.push({ path: translation.sourcePath, error: result.error || "Unknown error" });
    }

    onProgress?.(progress);

    // Add a small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { successful, failed, errors };
}
