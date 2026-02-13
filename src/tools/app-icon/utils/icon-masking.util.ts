/**
 * icon-masking: White logo masking utility using Gemini API
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "../../../utils/config.util.js";

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
 * Apply white masking to icon using Gemini API
 * Converts the logo portion to white while making the background transparent
 */
export async function applyWhiteMasking(
  inputPath: string,
  outputPath: string,
  logoPosition?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getGeminiClient();

    // Read the source image
    const { data: imageData, mimeType } = readImageAsBase64(inputPath);

    // Build logo position instruction if provided
    const positionInstruction = logoPosition
      ? `\n- Logo positioning hint: ${logoPosition}`
      : "";

    // Create the masking prompt
    const prompt = `This is an app icon. Please convert it to a white logo on transparent background for Android notification icon.

IMPORTANT INSTRUCTIONS:
- Convert the logo/icon portion to pure white (#FFFFFF)
- Make the background completely transparent
- Preserve the exact shape and details of the logo
- Keep the same aspect ratio and dimensions
- Do NOT change the logo shape or design, only the colors
- The logo should be solid white, no gradients${positionInstruction}

Generate a new icon with white logo on transparent background.`;

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
