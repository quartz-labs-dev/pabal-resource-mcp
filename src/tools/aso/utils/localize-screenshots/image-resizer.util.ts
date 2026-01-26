/**
 * Image Resizer Utility
 *
 * Uses sharp library to validate and resize images to match source dimensions
 */

import sharp from "sharp";
import fs from "node:fs";

export interface ImageDimensions {
  width: number;
  height: number;
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
 * Resize image to match target dimensions
 */
export async function resizeImage(
  inputPath: string,
  outputPath: string,
  targetDimensions: ImageDimensions
): Promise<void> {
  await sharp(inputPath)
    .resize(targetDimensions.width, targetDimensions.height, {
      fit: "fill", // Exact resize to target dimensions
      withoutEnlargement: false, // Allow enlargement if needed
    })
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
