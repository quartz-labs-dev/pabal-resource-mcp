/**
 * Image Resizer Utility
 *
 * Uses sharp library to validate and resize images to match source dimensions
 * Preserves aspect ratio and fills remaining space with detected background color
 */

import sharp from "sharp";
import fs from "node:fs";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Get image dimensions using sharp
 */
export async function getImageDimensions(
  imagePath: string
): Promise<ImageDimensions> {
  const metadata = await sharp(imagePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read dimensions from ${imagePath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * Detect dominant background color from image corners
 * Samples pixels from the 4 corner regions to avoid text/content in the center
 */
async function detectCornerColor(imagePath: string): Promise<RgbColor> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 100;
  const height = metadata.height || 100;

  // Get raw pixel data
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const colorCounts = new Map<string, { count: number; color: RgbColor }>();

  // Corner region size: 5% of image dimensions (min 10px, max 100px)
  const cornerWidth = Math.min(100, Math.max(10, Math.floor(width * 0.05)));
  const cornerHeight = Math.min(100, Math.max(10, Math.floor(height * 0.05)));

  const samplePixel = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Quantize colors to reduce variations (group similar colors)
    const qr = Math.round(r / 8) * 8;
    const qg = Math.round(g / 8) * 8;
    const qb = Math.round(b / 8) * 8;

    const key = `${qr},${qg},${qb}`;
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { count: 1, color: { r: qr, g: qg, b: qb } });
    }
  };

  // Sample 4 corner regions
  const corners = [
    { startX: 0, startY: 0 }, // Top-left
    { startX: width - cornerWidth, startY: 0 }, // Top-right
    { startX: 0, startY: height - cornerHeight }, // Bottom-left
    { startX: width - cornerWidth, startY: height - cornerHeight }, // Bottom-right
  ];

  for (const corner of corners) {
    // Sample every 2 pixels in corner region
    for (let y = corner.startY; y < corner.startY + cornerHeight; y += 2) {
      for (let x = corner.startX; x < corner.startX + cornerWidth; x += 2) {
        samplePixel(x, y);
      }
    }
  }

  // Find most common color
  let maxCount = 0;
  let dominantColor: RgbColor = { r: 255, g: 255, b: 255 }; // Default to white

  for (const { count, color } of colorCounts.values()) {
    if (count > maxCount) {
      maxCount = count;
      dominantColor = color;
    }
  }

  return dominantColor;
}

/**
 * Check if two images have the same dimensions
 */
export async function haveSameDimensions(
  imagePath1: string,
  imagePath2: string
): Promise<boolean> {
  const [dim1, dim2] = await Promise.all([
    getImageDimensions(imagePath1),
    getImageDimensions(imagePath2),
  ]);

  return dim1.width === dim2.width && dim1.height === dim2.height;
}

/**
 * Resize image to match target dimensions while preserving aspect ratio
 * Fills remaining space with the detected edge background color
 */
export async function resizeImage(
  inputPath: string,
  outputPath: string,
  targetDimensions: ImageDimensions
): Promise<void> {
  // Detect background color from the input image corners
  const bgColor = await detectCornerColor(inputPath);

  await sharp(inputPath)
    .resize(targetDimensions.width, targetDimensions.height, {
      fit: "contain", // Preserve aspect ratio
      withoutEnlargement: false, // Allow enlargement if needed
      background: bgColor, // Use detected edge color
    })
    .flatten({ background: bgColor }) // Ensure background is applied
    .png()
    .toFile(outputPath + ".tmp");

  // Replace original with resized
  fs.renameSync(outputPath + ".tmp", outputPath);
}

/**
 * Validate and resize image if dimensions don't match source
 */
export async function validateAndResizeImage(
  sourcePath: string,
  translatedPath: string
): Promise<{
  resized: boolean;
  sourceDimensions: ImageDimensions;
  translatedDimensions: ImageDimensions;
  finalDimensions: ImageDimensions;
}> {
  const sourceDimensions = await getImageDimensions(sourcePath);
  const translatedDimensions = await getImageDimensions(translatedPath);

  const needsResize =
    sourceDimensions.width !== translatedDimensions.width ||
    sourceDimensions.height !== translatedDimensions.height;

  if (needsResize) {
    await resizeImage(translatedPath, translatedPath, sourceDimensions);
  }

  return {
    resized: needsResize,
    sourceDimensions,
    translatedDimensions,
    finalDimensions: sourceDimensions,
  };
}

/**
 * Batch validate and resize images
 */
export async function batchValidateAndResize(
  pairs: Array<{ sourcePath: string; translatedPath: string }>
): Promise<{
  total: number;
  resized: number;
  errors: Array<{ path: string; error: string }>;
}> {
  let resizedCount = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (const { sourcePath, translatedPath } of pairs) {
    try {
      if (!fs.existsSync(translatedPath)) {
        continue;
      }

      const result = await validateAndResizeImage(sourcePath, translatedPath);
      if (result.resized) {
        resizedCount++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ path: translatedPath, error: message });
    }
  }

  return {
    total: pairs.length,
    resized: resizedCount,
    errors,
  };
}
