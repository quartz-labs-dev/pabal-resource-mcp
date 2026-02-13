/**
 * stylize-app-icon: Transform app icons with seasonal or themed styles using AI
 *
 * This tool:
 * 1. Takes a base icon (icon.png) from the root icons folder
 * 2. Uses Gemini API to apply seasonal/themed transformations
 * 3. Saves the stylized icon to icons/{styleFolder}/icon.png
 * 4. Can then be used with generate-app-icons to create all platform variants
 *
 * Example workflow:
 * 1. stylize-app-icon: my-app + christmas style → icons/christmas/icon.png
 * 2. generate-app-icons: my-app + styleFolder=christmas → all christmas icon variants
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { findRegisteredApp } from "../../utils/registered-apps.util.js";
import { getIconsDir, getBaseIconPath } from "./utils/icon-specs.util.js";
import { getGeminiApiKey } from "../../utils/config.util.js";

const TOOL_NAME = "stylize-app-icon";

export const stylizeAppIconInputSchema = z.object({
  appName: z
    .string()
    .describe(
      "App name, slug, bundleId, or packageName to search for. Will be validated using search-app."
    ),
  styleFolder: z
    .string()
    .describe(
      "Style folder name for the themed icon (e.g., 'christmas', 'halloween', 'summer'). " +
        "The stylized icon will be saved to icons/{styleFolder}/icon.png"
    ),
  stylePrompt: z
    .string()
    .describe(
      "Detailed prompt describing the style transformation to apply. " +
        "Examples: 'Add Christmas decorations like santa hat and snowflakes', " +
        "'Transform to Halloween theme with pumpkins and bats', " +
        "'Apply summer beach theme with sun and waves'"
    ),
  preserveShape: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Preserve the original icon shape and structure (default: true). " +
        "When true, only applies style elements without changing the core design."
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Preview mode - shows what would be generated without actually calling API or saving files"
    ),
});

export type StylizeAppIconInput = z.infer<typeof stylizeAppIconInputSchema>;

const jsonSchema = zodToJsonSchema(stylizeAppIconInputSchema as any, {
  name: "StylizeAppIconInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.StylizeAppIconInput || jsonSchema;

export const stylizeAppIconTool = {
  name: TOOL_NAME,
  description: `Transform app icons with seasonal or themed styles using Gemini AI.

**Workflow:**
1. Reads base icon from: \`{slug}/icons/icon.png\`
2. Uses Gemini API to apply style transformation
3. Saves stylized icon to: \`{slug}/icons/{styleFolder}/icon.png\`
4. Use generate-app-icons with styleFolder to create all platform variants

**Use Cases:**
- **Seasonal Events**: Christmas, Halloween, Easter, New Year
- **Special Occasions**: Pride Month, Black Friday, Valentine's Day
- **Themed Promotions**: Summer sale, winter collection, sports events

**Requirements:**
- GEMINI_API_KEY or GOOGLE_API_KEY environment variable
- Base icon exists at {slug}/icons/icon.png

**Example Flow:**
\`\`\`
Step 1: Stylize icon
INPUT:  my-app/icons/icon.png
PROMPT: "Add Christmas decorations like santa hat, snowflakes, and red/green colors"
OUTPUT: my-app/icons/christmas/icon.png (AI-generated Christmas version)

Step 2: Generate platform icons (optional)
Use generate-app-icons with styleFolder='christmas' to create:
- my-app/icons/christmas/ios-light.png
- my-app/icons/christmas/adaptive-icon.png
- my-app/icons/christmas/splash-icon-light.png
- my-app/icons/christmas/android-notification-icon.png
\`\`\`

**Tips:**
- Be specific in stylePrompt for better results
- Use preserveShape=true to maintain brand recognition
- Test with dryRun=true before actual generation
- Store multiple styles in different folders (christmas, halloween, etc.)`,
  inputSchema,
};

/**
 * Validate app and return app info
 */
function validateApp(appName: string): { slug: string; name: string } {
  const { app } = findRegisteredApp(appName);

  if (!app) {
    throw new Error(
      `App not found: "${appName}". Use search-app tool to find the correct app name.`
    );
  }

  return {
    slug: app.slug,
    name: app.name || app.slug,
  };
}

/**
 * Get Gemini API client
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

/**
 * Read image file and convert to base64
 */
function readImageAsBase64(imagePath: string): {
  data: string;
  mimeType: string;
} {
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

/**
 * Apply style transformation using Gemini API
 */
async function stylizeIconWithAI(
  inputPath: string,
  outputPath: string,
  stylePrompt: string,
  preserveShape: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getGeminiClient();

    // Read the source image
    const { data: imageData, mimeType } = readImageAsBase64(inputPath);

    // Build the prompt
    const shapeInstruction = preserveShape
      ? "IMPORTANT: Preserve the original icon's shape, structure, and core design elements. Only add style-specific decorations and color adjustments."
      : "You can modify the icon structure as needed to achieve the style.";

    const fullPrompt = `You are an expert app icon designer. Transform this app icon with the following style:

${stylePrompt}

${shapeInstruction}

Requirements:
1. Output must be a high-quality app icon suitable for mobile apps
2. Maintain professional app icon standards (clean, recognizable, works at small sizes)
3. Return ONLY the transformed icon image, no text or explanations
4. Keep transparency if the original has it
5. Ensure the result is visually appealing and brand-appropriate

Generate the stylized icon now.`;

    // Create chat session for image editing
    const chat = client.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Send message with image
    const response = await chat.sendMessage({
      message: [
        { text: fullPrompt },
        {
          inlineData: {
            mimeType,
            data: imageData,
          },
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Extract generated image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: "No response from Gemini API",
      };
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      return {
        success: false,
        error: "No content parts in response",
      };
    }

    // Find image data in response
    for (const part of parts) {
      if (part.inlineData?.data) {
        const imageBuffer = Buffer.from(part.inlineData.data, "base64");

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Convert to PNG and save
        await sharp(imageBuffer).png().toFile(outputPath);

        return { success: true };
      }
    }

    return {
      success: false,
      error: "No image data in Gemini response",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Main handler for stylize-app-icon tool
 */
export async function handleStylizeAppIcon(
  input: StylizeAppIconInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    appName,
    styleFolder,
    stylePrompt,
    preserveShape = true,
    dryRun = false,
  } = input;

  const results: string[] = [];

  // Step 1: Validate app
  let appInfo: { slug: string; name: string };
  try {
    appInfo = validateApp(appName);
    results.push(`✅ App found: ${appInfo.name} (${appInfo.slug})`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Step 2: Verify base icon exists
  const baseIconPath = getBaseIconPath(appInfo.slug);
  if (!fs.existsSync(baseIconPath)) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Base icon not found: ${baseIconPath}\n\nPlease place your base icon at this location first.`,
        },
      ],
    };
  }

  // Step 3: Prepare output path
  const outputPath = getBaseIconPath(appInfo.slug, styleFolder);
  const outputDir = getIconsDir(appInfo.slug, styleFolder);

  results.push(`\n📁 Input: ${baseIconPath}`);
  results.push(`📁 Output: ${outputPath}`);
  results.push(`\n🎨 Style: ${styleFolder}`);
  results.push(`📝 Prompt: "${stylePrompt}"`);
  results.push(
    `🔧 Shape preservation: ${preserveShape ? "enabled" : "disabled"}`
  );

  // Dry run - just show what would be done
  if (dryRun) {
    results.push(`\n🔍 DRY RUN - No actual generation will be performed`);
    results.push(
      `\nWould generate stylized icon using Gemini API and save to:`
    );
    results.push(`${outputPath}`);
    results.push(
      `\nNext step: Run generate-app-icons with styleFolder='${styleFolder}' to create platform variants`
    );

    return {
      content: [
        {
          type: "text",
          text: results.join("\n"),
        },
      ],
    };
  }

  // Step 4: Check API key
  try {
    getGeminiClient();
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Step 5: Generate stylized icon
  results.push(`\n🚀 Generating stylized icon with Gemini API...`);

  const stylizeResult = await stylizeIconWithAI(
    baseIconPath,
    outputPath,
    stylePrompt,
    preserveShape
  );

  if (!stylizeResult.success) {
    return {
      content: [
        {
          type: "text",
          text: results.join("\n") + `\n\n❌ Error: ${stylizeResult.error}`,
        },
      ],
    };
  }

  results.push(`✅ Stylized icon generated successfully!`);
  results.push(`\n📁 Saved to: ${outputPath}`);
  results.push(
    `\n💡 Next step: Run generate-app-icons with styleFolder='${styleFolder}' to create all platform variants`
  );

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}
