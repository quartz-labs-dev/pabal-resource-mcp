import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface PabalMcpConfig {
  dataDir?: string;
}

/**
 * Get the data directory from ~/.config/pabal-mcp/config.json
 * Throws an error if config file doesn't exist or dataDir is not set
 */
export function getAsoDataDir(): string {
  const configPath = path.join(
    os.homedir(),
    ".config",
    "pabal-mcp",
    "config.json"
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Please create the config file and set the 'dataDir' property to specify the ASO data directory.`
    );
  }

  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent) as PabalMcpConfig;

    if (!config.dataDir) {
      throw new Error(
        `'dataDir' property is not set in ${configPath}. Please set 'dataDir' to specify the ASO data directory.`
      );
    }

    // If dataDir is absolute, use it as is
    if (path.isAbsolute(config.dataDir)) {
      return config.dataDir;
    }
    // If relative, resolve from home directory
    return path.resolve(os.homedir(), config.dataDir);
  } catch (error) {
    if (error instanceof Error && error.message.includes("dataDir")) {
      throw error;
    }
    throw new Error(
      `Failed to read config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get the pullData directory path
 */
export function getPullDataDir(): string {
  return path.join(getAsoDataDir(), "pullData");
}

/**
 * Get the pushData directory path
 */
export function getPushDataDir(): string {
  return path.join(getAsoDataDir(), "pushData");
}

/**
 * Get the public directory path (always relative to process.cwd())
 */
export function getPublicDir(): string {
  return path.join(process.cwd(), "public");
}

/**
 * Get the products directory path (public/products)
 */
export function getProductsDir(): string {
  return path.join(getPublicDir(), "products");
}
