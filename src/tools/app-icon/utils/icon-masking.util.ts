/**
 * icon-masking: White logo masking utility
 * Creates white logo on transparent background using original image's alpha channel
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Apply white masking to icon
 * Converts the logo portion to white while preserving the original shape
 *
 * @param inputPath - Path to the source image
 * @param outputPath - Path to save the masked image
 * @param targetSize - Target output size (width and height)
 */
export async function applyWhiteMasking(
  inputPath: string,
  outputPath: string,
  targetSize: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create white mask from original image's alpha channel
    const processedBuffer = await createWhiteMaskFromOriginal(inputPath);

    // Resize to target size with transparent background, centered
    await sharp(processedBuffer)
      .resize(targetSize, targetSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Create white mask using original image's alpha channel
 * Makes all non-transparent pixels white, preserving the original shape
 */
async function createWhiteMaskFromOriginal(inputPath: string): Promise<Buffer> {
  // Get raw pixel data from original image
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.length);

  // Process each pixel - use original's alpha to determine shape
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]; // Original alpha

    if (a > 10) {
      // Has content - make white
      pixels[i] = 255;     // R
      pixels[i + 1] = 255; // G
      pixels[i + 2] = 255; // B
      pixels[i + 3] = 255; // A (opaque)
    } else {
      // Transparent - keep transparent
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    }
  }

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
