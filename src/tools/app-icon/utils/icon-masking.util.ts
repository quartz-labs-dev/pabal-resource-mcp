/**
 * icon-masking: White logo masking utility using Gemini API
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getGeminiClient, readImageAsBase64 } from "./gemini.util.js";

/**
 * Apply white masking to icon using Gemini API
 * Converts the logo portion to white while making the background transparent
 *
 * @param inputPath - Path to the source image
 * @param outputPath - Path to save the masked image
 * @param targetSize - Target output size (width and height)
 * @param logoPosition - Optional hint for logo positioning
 */
export async function applyWhiteMasking(
  inputPath: string,
  outputPath: string,
  targetSize: number,
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
    const prompt = `Convert this icon into a simple white Android notification icon.

Requirements:
- White logo (#FFFFFF) on transparent background
- Preserve the logo shape exactly
- No gradients, solid white only${positionInstruction}`;

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

        // Post-process with Sharp to ensure transparent background
        const processedBuffer = await ensureTransparentBackground(imageBuffer);

        // Resize to target size with transparent background, centered
        await sharp(processedBuffer)
          .resize(targetSize, targetSize, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(outputPath);

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
 * Post-process AI-generated image to ensure truly transparent background
 * Converts near-black/dark pixels to transparent while keeping white pixels
 */
async function ensureTransparentBackground(imageBuffer: Buffer): Promise<Buffer> {
  // Get raw pixel data
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.length);

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Calculate brightness (0-255)
    const brightness = (r + g + b) / 3;

    // If pixel is bright (white or near-white) and not already transparent
    if (brightness > 200 && a > 10) {
      // Keep as white, fully opaque
      pixels[i] = 255;     // R
      pixels[i + 1] = 255; // G
      pixels[i + 2] = 255; // B
      pixels[i + 3] = 255; // A (opaque)
    } else {
      // Make transparent
      pixels[i] = 0;       // R
      pixels[i + 1] = 0;   // G
      pixels[i + 2] = 0;   // B
      pixels[i + 3] = 0;   // A (transparent)
    }
  }

  // Convert back to image buffer
  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}
