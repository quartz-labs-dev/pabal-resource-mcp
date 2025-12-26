import fs from "node:fs";
import path from "node:path";
import type { ProductLocale } from "../../../../types/products/index.js";
import { getProductsDir } from "../../../../utils/config.util.js";

/**
 * Save locale data to file
 */
export function saveLocaleFile({
  slug,
  locale,
  localeData,
}: {
  slug: string;
  locale: string;
  localeData: ProductLocale;
}): void {
  const productsDir = getProductsDir();
  const localesDir = path.join(
    productsDir,
    slug,
    "locales"
  );
  const localePath = path.join(localesDir, `${locale}.json`);

  if (!fs.existsSync(localesDir)) {
    throw new Error(`Locales directory not found: ${localesDir}`);
  }

  const jsonContent = JSON.stringify(localeData, null, 2) + "\n";
  fs.writeFileSync(localePath, jsonContent, "utf-8");
}
