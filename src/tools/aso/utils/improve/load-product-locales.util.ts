import fs from "node:fs";
import path from "node:path";
import type { ProductConfig, ProductLocale } from "../../../../types/products/index.js";
import { DEFAULT_LOCALE } from "../../../../constants/unified-locales.js";
import { getProductsDir } from "../../../../utils/config.util.js";

/**
 * Load product config and locales from public/products/[slug]/
 */
export function loadProductLocales(slug: string): {
  config: ProductConfig | null;
  locales: Record<string, ProductLocale>;
} {
  const productsDir = getProductsDir();
  const productDir = path.join(productsDir, slug);
  const configPath = path.join(productDir, "config.json");
  const localesDir = path.join(productDir, "locales");

  let config: ProductConfig | null = null;
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(raw) as ProductConfig;
  }

  if (!fs.existsSync(localesDir)) {
    throw new Error(`No locales directory found for ${slug}`);
  }

  const locales: Record<string, ProductLocale> = {};
  const localeFiles = fs
    .readdirSync(localesDir)
    .filter((file) => file.endsWith(".json"));

  if (localeFiles.length === 0) {
    throw new Error(`No locale files found for ${slug}`);
  }

  for (const file of localeFiles) {
    const localeCode = file.replace(".json", "");
    const localePath = path.join(localesDir, file);
    const content = fs.readFileSync(localePath, "utf-8");
    locales[localeCode] = JSON.parse(content) as ProductLocale;
  }

  return { config, locales };
}

/**
 * Resolve primary locale from config and available locales
 */
export function resolvePrimaryLocale(
  config: ProductConfig | null,
  locales: Record<string, ProductLocale>
): string {
  const localeKeys = Object.keys(locales);
  if (localeKeys.length === 0) {
    return DEFAULT_LOCALE;
  }

  const configuredDefault = config?.content?.defaultLocale;
  if (configuredDefault && locales[configuredDefault]) {
    return configuredDefault;
  }

  if (locales[DEFAULT_LOCALE]) {
    return DEFAULT_LOCALE;
  }

  return localeKeys[0];
}

