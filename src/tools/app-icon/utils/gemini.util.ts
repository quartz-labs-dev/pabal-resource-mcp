/**
 * gemini: Shared Gemini API utilities for app-icon tools
 */

import type { GoogleGenAI } from "@google/genai";
import { createGeminiClient } from "../../../utils/gemini-client.util.js";
import { readImageAsBase64 } from "../../../utils/image-file.util.js";

/**
 * Get Gemini API client
 */
export function getGeminiClient(): GoogleGenAI {
  return createGeminiClient();
}

/**
 * Read image file and convert to base64
 */
export { readImageAsBase64 };
