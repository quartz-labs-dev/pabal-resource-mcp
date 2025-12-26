import type { ProductLocale } from "../../../../types/products/index.js";

/**
 * Generate conversion prompt for Claude
 * Converts unstructured ASO data to structured locale JSON format
 * Now supports merged data from both Google Play and App Store
 */
export function generateConversionPrompt(
  title: string,
  shortDescription: string | undefined,
  fullDescription: string,
  locale: string,
  keywords?: string,
  promotionalText?: string,
  googlePlayData?: {
    title: string;
    shortDescription?: string;
    fullDescription: string;
  },
  appStoreData?: {
    name: string;
    subtitle?: string;
    description: string;
    keywords?: string;
    promotionalText?: string;
  },
  screenshotPaths?: {
    googlePlay?: string;
    appStore?: string;
  }
): string {
  // Build input data showing both platforms if available
  const inputData: any = {
    locale,
  };

  if (googlePlayData && appStoreData) {
    // Both platforms available - show merged data
    inputData.mergedFrom = ["Google Play", "App Store"];
    inputData.googlePlay = {
      title: googlePlayData.title,
      shortDescription: googlePlayData.shortDescription || null,
      fullDescription: googlePlayData.fullDescription,
    };
    inputData.appStore = {
      name: appStoreData.name,
      subtitle: appStoreData.subtitle || null,
      description: appStoreData.description,
      keywords: appStoreData.keywords || null,
      promotionalText: appStoreData.promotionalText || null,
    };
  } else if (googlePlayData) {
    // Google Play only
    inputData.source = "Google Play";
    inputData.title = googlePlayData.title;
    inputData.shortDescription = googlePlayData.shortDescription || null;
    inputData.fullDescription = googlePlayData.fullDescription;
  } else if (appStoreData) {
    // App Store only
    inputData.source = "App Store";
    inputData.title = appStoreData.name;
    inputData.subtitle = appStoreData.subtitle || null;
    inputData.fullDescription = appStoreData.description;
    if (appStoreData.keywords) inputData.keywords = appStoreData.keywords;
    if (appStoreData.promotionalText) inputData.promotionalText = appStoreData.promotionalText;
  } else {
    // Fallback - use provided parameters
    inputData.title = title;
    inputData.shortDescription = shortDescription || null;
    inputData.fullDescription = fullDescription;
    if (keywords) inputData.keywords = keywords;
    if (promotionalText) inputData.promotionalText = promotionalText;
  }

  const inputJson = JSON.stringify(inputData, null, 2);

  const outputExample: ProductLocale = {
    aso: {
      title: "App title",
      subtitle: "Subtitle (App Store only, optional)",
      shortDescription: "Short description (Google Play only, optional)",
      keywords: ["keyword1", "keyword2"],
      template: {
        intro: "Brief app introduction paragraph (2-3 sentences)",
        outro: "Closing paragraph and CTA (1-2 sentences)",
      },
    },
    landing: {
      screenshots: {
        images: [
          { title: "Caption title", description: "Caption body" },
        ],
      },
      features: {
        items: [{ title: "Feature title", body: "Feature description" }],
      },
    },
  };

  const outputFormatJson = JSON.stringify(outputExample, null, 2);

  const hasBothPlatforms = googlePlayData && appStoreData;

  return `Please convert the following store ASO data into config.json format.

**Input Data:**
\`\`\`json
${inputJson}
\`\`\`

**Output Format:**
Convert according to the following JSON schema:

\`\`\`json
${outputFormatJson}
\`\`\`

**Conversion Rules:**
${hasBothPlatforms ? `
**IMPORTANT - Data Merge Strategy:**
This locale has data from BOTH Google Play and App Store. Use the following merge strategy:
- **Title/Name**: Prefer App Store name if available, otherwise use Google Play title
- **Subtitle/Short Description**: Use App Store subtitle if available, otherwise use Google Play shortDescription
- **Full Description**: Merge both descriptions intelligently:
  - If descriptions are similar, use the more detailed version
  - If descriptions are different, combine unique information from both
  - Prioritize App Store description for intro/outro (usually more polished)
  - Incorporate unique features from Google Play description
- **Keywords**: Use App Store keywords (Google Play doesn't have explicit keywords field)
- **Promotional Text**: Use App Store promotionalText if available

**Content Extraction:**
` : ""}1. Use the first paragraph(s) of fullDescription as template.intro (2-3 sentences).
2. Use the final paragraph as template.outro (1-2 sentences, keep CTA tone).
3. Extract the strongest bullets/sections from the body into landing.features.items (3-5 items). Each item should have title + 1-2 sentence body.
4. Extract any explicit bullet lists or section highlights into landing.screenshots.images captions (keep order; 3-5 entries). Each needs title + short description.
5. Convert comma-separated keywords string to array.
6. Include Contact & Support info only if present in the original text; otherwise omit.

**Translation Guidelines (if converting to non-English locales):**
- Keep proper nouns and technical terms in English when translating
- Keep terms like "Always-On Display", "E-Ink", "Android", brand names (e.g., "Boox", "Meebook"), and other technical/proper nouns in English
- Only translate descriptive text, not technical terminology or proper nouns
- Example: "Always-On Display" should remain "Always-On Display" in Korean, not translated to "항상 켜진 화면"

${screenshotPaths ? `
**Screenshot Paths:**
Screenshots for this locale can be found at:
${screenshotPaths.googlePlay ? `- Google Play: ${screenshotPaths.googlePlay}` : ""}
${screenshotPaths.appStore ? `- App Store: ${screenshotPaths.appStore}` : ""}

Copy screenshots from these directories to public/products/[slug]/screenshots/ as needed.
` : ""}
**Important:** Return only valid JSON, without any additional explanation.`;
}

