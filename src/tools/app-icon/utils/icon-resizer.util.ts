/**
 * icon-resizer: Image resizing and background handling utilities
 */

import sharp from "sharp";
import type { IconSpec } from "./icon-specs.util.js";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type LogoAlignment =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ResizeOptions {
  backgroundColor?: RgbColor | "transparent";
  logoPosition?: string; // Additional prompt for logo positioning (for AI)
  alignment?: LogoAlignment; // Logo alignment within canvas
}

/**
 * Parse hex color to RGB
 */
export function parseHexColor(hex: string): RgbColor | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  imagePath: string
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Resize icon to fit within a safe zone circle while maintaining aspect ratio
 * and filling the canvas to target size
 */
export async function resizeIconWithSafeZone(
  inputPath: string,
  outputPath: string,
  spec: IconSpec,
  options: ResizeOptions = {}
): Promise<void> {
  const {
    backgroundColor = "transparent",
    alignment = "center",
  } = options;

  // Step 1: Remove padding from icon to extract actual logo
  const trimmedLogo = await trimIconPadding(inputPath);

  // Step 2: Get trimmed logo dimensions
  const trimmedMetadata = await sharp(trimmedLogo).metadata();
  const inputWidth = trimmedMetadata.width || 0;
  const inputHeight = trimmedMetadata.height || 0;

  if (inputWidth === 0 || inputHeight === 0) {
    throw new Error(`Invalid logo dimensions after trimming: ${inputPath}`);
  }

  // Step 3: Calculate the maximum size the logo can be to fit within the safe zone
  // Safe zone is a circle, so we use diameter = 2 * radius
  const maxLogoSize = spec.safeZoneRadius
    ? spec.safeZoneRadius * 2
    : spec.size * 0.8; // Default to 80% of canvas if no safe zone specified

  // Step 4: Calculate resize dimensions maintaining aspect ratio
  const aspectRatio = inputWidth / inputHeight;
  let logoWidth: number;
  let logoHeight: number;

  if (aspectRatio > 1) {
    // Landscape
    logoWidth = Math.floor(maxLogoSize);
    logoHeight = Math.floor(maxLogoSize / aspectRatio);
  } else {
    // Portrait or square
    logoHeight = Math.floor(maxLogoSize);
    logoWidth = Math.floor(maxLogoSize * aspectRatio);
  }

  // Step 5: Resize the logo
  const resizedLogo = await sharp(trimmedLogo)
    .resize(logoWidth, logoHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Step 6: Create the final canvas
  const canvas = sharp({
    create: {
      width: spec.size,
      height: spec.size,
      channels: 4,
      background:
        backgroundColor === "transparent"
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : { ...backgroundColor, alpha: 1 },
    },
  });

  // Step 7: Calculate position based on alignment
  const safeZoneRadius = spec.safeZoneRadius || (spec.size * 0.8) / 2;
  const position = calculatePosition(
    spec.size,
    { width: logoWidth, height: logoHeight },
    safeZoneRadius,
    alignment
  );

  // Step 8: Composite the logo onto the canvas
  await canvas
    .composite([
      {
        input: resizedLogo,
        left: position.left,
        top: position.top,
      },
    ])
    .png()
    .toFile(outputPath);
}

/**
 * Simple resize to exact dimensions (used for notification icon as base)
 */
export async function resizeToExact(
  inputPath: string,
  outputPath: string,
  size: number,
  backgroundColor: RgbColor | "transparent" = "transparent"
): Promise<void> {
  const bg =
    backgroundColor === "transparent"
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { ...backgroundColor, alpha: 1 };

  await sharp(inputPath)
    .resize(size, size, {
      fit: "contain",
      background: bg,
    })
    .png()
    .toFile(outputPath);
}

/**
 * Detect dominant background color from image corners
 */
export async function detectBackgroundColor(
  imagePath: string
): Promise<RgbColor> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 100;
  const height = metadata.height || 100;

  // Sample a small region from top-left corner
  const sampleSize = 10;
  const { data } = await image
    .extract({ left: 0, top: 0, width: sampleSize, height: sampleSize })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate average color
  let r = 0,
    g = 0,
    b = 0;
  const pixelCount = sampleSize * sampleSize;

  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  return {
    r: Math.round(r / pixelCount),
    g: Math.round(g / pixelCount),
    b: Math.round(b / pixelCount),
  };
}

/**
 * Remove padding from icon image to extract actual logo
 * Returns buffer of trimmed logo
 */
export async function trimIconPadding(
  inputPath: string,
  threshold: number = 10
): Promise<Buffer> {
  const trimmed = await sharp(inputPath)
    .trim({ threshold }) // Remove transparent/uniform background
    .toBuffer();

  return trimmed;
}

/**
 * Convert logo to white on transparent background using Sharp (no AI)
 * Simple threshold-based conversion
 */
export async function convertToWhiteMask(
  inputPath: string,
  threshold: number = 128
): Promise<Buffer> {
  // 1. Convert to grayscale
  const grayscale = await sharp(inputPath)
    .greyscale()
    .toBuffer();

  // 2. Apply threshold to create binary mask
  // Pixels above threshold become white, below become transparent
  const { data, info } = await sharp(grayscale)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 3. Create white logo on transparent background
  const pixels = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]; // R channel (same as G and B in grayscale)
    const alpha = data[i + 3];

    // If pixel is not transparent and above threshold, make it white
    if (alpha > 10 && gray > threshold) {
      pixels[i] = 255;     // R
      pixels[i + 1] = 255; // G
      pixels[i + 2] = 255; // B
      pixels[i + 3] = 255; // A (opaque)
    } else {
      pixels[i] = 0;       // R
      pixels[i + 1] = 0;   // G
      pixels[i + 2] = 0;   // B
      pixels[i + 3] = 0;   // A (transparent)
    }
  }

  // 4. Convert back to image
  const whiteMask = await sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  return whiteMask;
}

/**
 * Calculate position based on alignment and sizes
 */
function calculatePosition(
  canvasSize: number,
  logoSize: { width: number; height: number },
  safeZoneRadius: number,
  alignment: LogoAlignment
): { left: number; top: number } {
  const center = canvasSize / 2;
  const safeZoneLeft = center - safeZoneRadius;
  const safeZoneRight = center + safeZoneRadius;
  const safeZoneTop = center - safeZoneRadius;
  const safeZoneBottom = center + safeZoneRadius;

  let left: number;
  let top: number;

  switch (alignment) {
    case "center":
      left = Math.floor((canvasSize - logoSize.width) / 2);
      top = Math.floor((canvasSize - logoSize.height) / 2);
      break;

    case "left":
      // Left edge of logo aligns with left edge of safe zone
      left = Math.floor(safeZoneLeft);
      top = Math.floor((canvasSize - logoSize.height) / 2);
      break;

    case "right":
      // Right edge of logo aligns with right edge of safe zone
      left = Math.floor(safeZoneRight - logoSize.width);
      top = Math.floor((canvasSize - logoSize.height) / 2);
      break;

    case "top":
      left = Math.floor((canvasSize - logoSize.width) / 2);
      // Bottom edge of logo aligns with bottom edge of safe zone
      top = Math.floor(safeZoneBottom - logoSize.height);
      break;

    case "bottom":
      left = Math.floor((canvasSize - logoSize.width) / 2);
      // Top edge of logo aligns with top edge of safe zone
      top = Math.floor(safeZoneTop);
      break;

    case "top-left":
      left = Math.floor(safeZoneLeft);
      top = Math.floor(safeZoneTop);
      break;

    case "top-right":
      left = Math.floor(safeZoneRight - logoSize.width);
      top = Math.floor(safeZoneTop);
      break;

    case "bottom-left":
      left = Math.floor(safeZoneLeft);
      top = Math.floor(safeZoneBottom - logoSize.height);
      break;

    case "bottom-right":
      left = Math.floor(safeZoneRight - logoSize.width);
      top = Math.floor(safeZoneBottom - logoSize.height);
      break;

    default:
      // Default to center
      left = Math.floor((canvasSize - logoSize.width) / 2);
      top = Math.floor((canvasSize - logoSize.height) / 2);
  }

  // Ensure logo stays within canvas
  left = Math.max(0, Math.min(left, canvasSize - logoSize.width));
  top = Math.max(0, Math.min(top, canvasSize - logoSize.height));

  return { left, top };
}
