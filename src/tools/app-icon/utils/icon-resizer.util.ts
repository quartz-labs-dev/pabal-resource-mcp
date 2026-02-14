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
 *
 * Alignment determines both SIZE and POSITION:
 * - center: Logo fits within safe zone diameter
 * - left: Logo spans from canvas left (0) to safe zone right edge
 * - right: Logo spans from safe zone left edge to canvas right
 * - top: Logo spans from canvas top (0) to safe zone bottom edge
 * - bottom: Logo spans from safe zone top edge to canvas bottom
 * - corners: Combination of horizontal and vertical rules
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

  // Step 3: Calculate safe zone boundaries (all values must be integers for Sharp)
  const canvasSize = spec.size;
  const safeZoneRadius = spec.safeZoneRadius || (canvasSize * 0.8) / 2;
  const center = canvasSize / 2;
  const safeZoneLeft = Math.floor(center - safeZoneRadius);
  const safeZoneRight = Math.floor(center + safeZoneRadius);
  const safeZoneTop = Math.floor(center - safeZoneRadius);
  const safeZoneBottom = Math.floor(center + safeZoneRadius);

  // Step 4: Calculate available area based on alignment
  const { availableWidth, availableHeight, left, top } = calculateAlignmentArea(
    canvasSize,
    safeZoneLeft,
    safeZoneRight,
    safeZoneTop,
    safeZoneBottom,
    alignment
  );

  // Step 5: Calculate logo size to fit within available area (maintaining aspect ratio)
  const aspectRatio = inputWidth / inputHeight;
  let logoWidth: number;
  let logoHeight: number;

  if (aspectRatio > availableWidth / availableHeight) {
    // Logo is wider than available area ratio - fit by width
    logoWidth = Math.floor(availableWidth);
    logoHeight = Math.floor(availableWidth / aspectRatio);
  } else {
    // Logo is taller than available area ratio - fit by height
    logoHeight = Math.floor(availableHeight);
    logoWidth = Math.floor(availableHeight * aspectRatio);
  }

  // Step 6: Resize the logo
  const resizedLogo = await sharp(trimmedLogo)
    .resize(logoWidth, logoHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Step 7: Create the final canvas
  const canvas = sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background:
        backgroundColor === "transparent"
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : { ...backgroundColor, alpha: 1 },
    },
  });

  // Step 8: Calculate final position (align within available area)
  const finalPosition = calculateFinalPosition(
    left,
    top,
    availableWidth,
    availableHeight,
    logoWidth,
    logoHeight,
    alignment
  );

  // Step 9: Composite the logo onto the canvas
  await canvas
    .composite([
      {
        input: resizedLogo,
        left: finalPosition.left,
        top: finalPosition.top,
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

  // Sample a small region from top-left corner
  const sampleSize = 10;
  const { data, info } = await image
    .extract({ left: 0, top: 0, width: sampleSize, height: sampleSize })
    .ensureAlpha() // Ensure we have consistent 4 channels (RGBA)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate average color
  let r = 0,
    g = 0,
    b = 0;
  const pixelCount = sampleSize * sampleSize;
  const channels = info.channels; // Get actual channel count

  for (let i = 0; i < data.length; i += channels) {
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
 * Convert logo to white on transparent background
 * Uses original alpha channel to preserve exact logo shape
 */
export async function convertToWhiteMask(inputPath: string): Promise<Buffer> {
  // Get raw pixel data from original image
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.length);

  // Convert non-transparent pixels to white
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    if (alpha > 10) {
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

/**
 * Calculate available area based on alignment
 *
 * The available area determines how large the logo can be:
 * - center: Logo fits within safe zone diameter (default behavior)
 * - left: Logo spans from canvas left (0) to safe zone right edge
 * - right: Logo spans from safe zone left edge to canvas right edge
 * - top: Logo spans from canvas top (0) to safe zone bottom edge
 * - bottom: Logo spans from safe zone top edge to canvas bottom edge
 * - corners: Combination of horizontal and vertical rules
 */
function calculateAlignmentArea(
  canvasSize: number,
  safeZoneLeft: number,
  safeZoneRight: number,
  safeZoneTop: number,
  safeZoneBottom: number,
  alignment: LogoAlignment
): { availableWidth: number; availableHeight: number; left: number; top: number } {
  // Safe zone diameter (for center alignment)
  const safeZoneDiameter = safeZoneRight - safeZoneLeft;

  switch (alignment) {
    case "center":
      return {
        availableWidth: safeZoneDiameter,
        availableHeight: safeZoneDiameter,
        left: safeZoneLeft,
        top: safeZoneTop,
      };

    case "left":
      // Logo: left edge at 0, right edge at safeZoneRight
      return {
        availableWidth: safeZoneRight,
        availableHeight: safeZoneDiameter,
        left: 0,
        top: safeZoneTop,
      };

    case "right":
      // Logo: left edge at safeZoneLeft, right edge at canvasSize
      return {
        availableWidth: canvasSize - safeZoneLeft,
        availableHeight: safeZoneDiameter,
        left: safeZoneLeft,
        top: safeZoneTop,
      };

    case "top":
      // Logo: top edge at 0, bottom edge at safeZoneBottom
      return {
        availableWidth: safeZoneDiameter,
        availableHeight: safeZoneBottom,
        left: safeZoneLeft,
        top: 0,
      };

    case "bottom":
      // Logo: top edge at safeZoneTop, bottom edge at canvasSize
      return {
        availableWidth: safeZoneDiameter,
        availableHeight: canvasSize - safeZoneTop,
        left: safeZoneLeft,
        top: safeZoneTop,
      };

    case "top-left":
      return {
        availableWidth: safeZoneRight,
        availableHeight: safeZoneBottom,
        left: 0,
        top: 0,
      };

    case "top-right":
      return {
        availableWidth: canvasSize - safeZoneLeft,
        availableHeight: safeZoneBottom,
        left: safeZoneLeft,
        top: 0,
      };

    case "bottom-left":
      return {
        availableWidth: safeZoneRight,
        availableHeight: canvasSize - safeZoneTop,
        left: 0,
        top: safeZoneTop,
      };

    case "bottom-right":
      return {
        availableWidth: canvasSize - safeZoneLeft,
        availableHeight: canvasSize - safeZoneTop,
        left: safeZoneLeft,
        top: safeZoneTop,
      };

    default:
      // Default to center
      return {
        availableWidth: safeZoneDiameter,
        availableHeight: safeZoneDiameter,
        left: safeZoneLeft,
        top: safeZoneTop,
      };
  }
}

/**
 * Calculate final position within the available area
 *
 * This positions the logo at the correct edge of the available area:
 * - right alignment: logo's right edge touches available area's right edge
 * - left alignment: logo's left edge touches available area's left edge
 * - etc.
 */
function calculateFinalPosition(
  areaLeft: number,
  areaTop: number,
  areaWidth: number,
  areaHeight: number,
  logoWidth: number,
  logoHeight: number,
  alignment: LogoAlignment
): { left: number; top: number } {
  let left: number;
  let top: number;

  // Horizontal positioning (all values must be integers for Sharp)
  switch (alignment) {
    case "left":
    case "top-left":
    case "bottom-left":
      // Align logo to left edge of available area
      left = Math.floor(areaLeft);
      break;
    case "right":
    case "top-right":
    case "bottom-right":
      // Align logo to right edge of available area
      left = Math.floor(areaLeft + areaWidth - logoWidth);
      break;
    default:
      // Center horizontally
      left = Math.floor(areaLeft + (areaWidth - logoWidth) / 2);
  }

  // Vertical positioning (all values must be integers for Sharp)
  switch (alignment) {
    case "top":
    case "top-left":
    case "top-right":
      // Align logo to top edge of available area
      top = Math.floor(areaTop);
      break;
    case "bottom":
    case "bottom-left":
    case "bottom-right":
      // Align logo to bottom edge of available area
      top = Math.floor(areaTop + areaHeight - logoHeight);
      break;
    default:
      // Center vertically
      top = Math.floor(areaTop + (areaHeight - logoHeight) / 2);
  }

  return { left, top };
}
