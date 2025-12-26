import fs from "node:fs";
import path from "node:path";

/**
 * Download image from URL
 */
export async function downloadImage(
  url: string,
  outputPath: string
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Image download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error(`❌ Image download failed (${url}):`, error);
    throw error;
  }
}

