import fs from "node:fs";
import path from "node:path";

export interface Base64ImagePayload {
  data: string;
  mimeType: string;
}

/**
 * Read an image file and return base64 payload with inferred mime type.
 */
export function readImageAsBase64(imagePath: string): Base64ImagePayload {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString("base64");

  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") {
    mimeType = "image/jpeg";
  } else if (ext === ".webp") {
    mimeType = "image/webp";
  }

  return { data: base64, mimeType };
}
