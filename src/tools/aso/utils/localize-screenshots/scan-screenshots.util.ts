/**
 * Scan screenshots from product's screenshots directory
 *
 * Expected structure:
 * public/products/{slug}/screenshots/{locale}/phone/1.png, 2.png, ...
 * public/products/{slug}/screenshots/{locale}/tablet/1.png, 2.png, ...
 */

import fs from "node:fs";
import path from "node:path";
import { getProductsDir } from "../../../../utils/config.util.js";

export interface ScreenshotInfo {
  type: "phone" | "tablet";
  filename: string;
  fullPath: string;
}

export interface LocaleScreenshots {
  locale: string;
  screenshots: ScreenshotInfo[];
}

/**
 * Get screenshots directory path for a product
 */
export function getScreenshotsDir(slug: string): string {
  const productsDir = getProductsDir();
  return path.join(productsDir, slug, "screenshots");
}

/**
 * Scan screenshots for a specific locale
 */
export function scanLocaleScreenshots(
  slug: string,
  locale: string
): ScreenshotInfo[] {
  const screenshotsDir = getScreenshotsDir(slug);
  const localeDir = path.join(screenshotsDir, locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const screenshots: ScreenshotInfo[] = [];
  const deviceTypes = ["phone", "tablet"] as const;

  for (const deviceType of deviceTypes) {
    const deviceDir = path.join(localeDir, deviceType);

    if (!fs.existsSync(deviceDir)) {
      continue;
    }

    const files = fs
      .readdirSync(deviceDir)
      .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

    for (const filename of files) {
      screenshots.push({
        type: deviceType,
        filename,
        fullPath: path.join(deviceDir, filename),
      });
    }
  }

  return screenshots;
}

/**
 * Get all available locales in screenshots directory
 */
export function getAvailableScreenshotLocales(slug: string): string[] {
  const screenshotsDir = getScreenshotsDir(slug);

  if (!fs.existsSync(screenshotsDir)) {
    return [];
  }

  return fs
    .readdirSync(screenshotsDir)
    .filter((item) => {
      const itemPath = path.join(screenshotsDir, item);
      return fs.statSync(itemPath).isDirectory();
    })
    .filter((dir) => !dir.startsWith("."));
}

/**
 * Ensure output directory exists for translated screenshots
 */
export function ensureOutputDir(slug: string, locale: string, deviceType: "phone" | "tablet"): string {
  const screenshotsDir = getScreenshotsDir(slug);
  const outputDir = path.join(screenshotsDir, locale, deviceType);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}
