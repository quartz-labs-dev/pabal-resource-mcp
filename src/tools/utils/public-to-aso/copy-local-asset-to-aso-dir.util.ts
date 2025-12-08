import fs from "node:fs";
import path from "node:path";
import { getPublicDir } from "../../../utils/config.util.js";

/**
 * Copy /products assets from public/ into pushData
 */
export function copyLocalAssetToAsoDir(
  assetPath: string,
  outputPath: string
): boolean {
  const publicDir = getPublicDir();
  const trimmedPath = assetPath
    .replace(/^\.\//, "")
    .replace(/^public\//, "")
    .replace(/^\/+/, "");
  const sourcePath = path.join(publicDir, trimmedPath);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`⚠️  Local image not found: ${sourcePath}`);
    return false;
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.copyFileSync(sourcePath, outputPath);
  return true;
}

