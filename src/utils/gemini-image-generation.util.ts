import type { GoogleGenAI } from "@google/genai";
import {
  getGeminiErrorMessage,
  getGeminiImageModelCandidates,
  shouldTryNextGeminiImageModel,
  type GeminiImageModelPreference,
} from "./gemini-image-model.util.js";

export interface GeminiImageGenerationInput {
  client: GoogleGenAI;
  prompt: string;
  image: {
    data: string;
    mimeType: string;
  };
  aspectRatio?: string;
  imageModel?: GeminiImageModelPreference;
}

export interface GeminiImageGenerationResult {
  model: string;
  imageBase64: string;
}

/**
 * Execute image generation/editing with ordered model fallback.
 */
export async function generateImageWithFallback(
  input: GeminiImageGenerationInput
): Promise<GeminiImageGenerationResult> {
  const models = getGeminiImageModelCandidates(input.imageModel);
  let lastError: unknown;

  for (const model of models) {
    try {
      const chat = input.client.chats.create({
        model,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const response = await chat.sendMessage({
        message: [
          { text: input.prompt },
          {
            inlineData: {
              mimeType: input.image.mimeType,
              data: input.image.data,
            },
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(input.aspectRatio
            ? {
                imageConfig: {
                  aspectRatio: input.aspectRatio,
                },
              }
            : {}),
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        throw new Error("No content parts in Gemini response");
      }

      for (const part of parts) {
        if (part.inlineData?.data) {
          return {
            model,
            imageBase64: part.inlineData.data,
          };
        }
      }

      throw new Error("No image data in Gemini response");
    } catch (error) {
      lastError = error;
      if (!shouldTryNextGeminiImageModel(error)) {
        break;
      }
    }
  }

  throw new Error(
    `All Gemini image models failed (${models.join(", ")}): ${getGeminiErrorMessage(lastError)}`
  );
}
