import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./config.util.js";

/**
 * Create a Gemini API client using configured API key.
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}
