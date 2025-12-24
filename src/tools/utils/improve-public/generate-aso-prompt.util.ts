const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

interface GenerateAsoPromptArgs {
  slug: string;
  category: string | undefined;
  primaryLocale: string;
  targetLocales: string[];
  localeSections: string[];
  keywordResearchByLocale: Record<string, string[]>;
  keywordResearchDirByLocale: Record<string, string>;
}

export interface GenerateKeywordLocalizationPromptArgs
  extends GenerateAsoPromptArgs {
  optimizedPrimary: string;
  batchLocales?: string[];
  batchIndex?: number;
  totalBatches?: number;
  batchLocaleSections?: string[];
}

/**
 * Stage 1: Primary Locale Optimization
 * - Keyword research for primary locale only
 * - Full ASO optimization with all fields
 */
export function generatePrimaryOptimizationPrompt(
  args: GenerateAsoPromptArgs
): string {
  const {
    slug,
    category,
    primaryLocale,
    localeSections,
    keywordResearchByLocale,
    keywordResearchDirByLocale,
  } = args;

  let prompt = `# ASO Optimization - Stage 1: Primary Locale\n\n`;
  prompt += `Product: ${slug} | Category: ${
    category || "N/A"
  } | Primary: ${primaryLocale}\n\n`;

  prompt += `## Task\n\n`;
  prompt += `Optimize the PRIMARY locale (${primaryLocale}) using **saved keyword research** + full ASO field optimization.\n\n`;

  prompt += `## Step 1: Use Saved Keyword Research (${primaryLocale})\n\n`;
  const researchSections = keywordResearchByLocale[primaryLocale] || [];
  const researchDir = keywordResearchDirByLocale[primaryLocale];
  if (researchSections.length > 0) {
    prompt += `**CRITICAL: Use ONLY the saved keyword research below. Do NOT invent or research new keywords.**\n\n`;
    prompt += `The research data includes:\n`;
    prompt += `- **Tier 1 (Core):** Use these in title and subtitle - highest traffic, best opportunity\n`;
    prompt += `- **Tier 2 (Feature):** Use these in keywords field and descriptions\n`;
    prompt += `- **Tier 3 (Longtail):** Use these in intro, outro, and feature descriptions\n`;
    prompt += `- **Keyword Details:** Each keyword has traffic/difficulty scores and rationale - use this to prioritize\n`;
    prompt += `- **Strategy:** Overall optimization strategy based on competitor analysis\n`;
    prompt += `- **Keyword Gaps:** Opportunities where competitors are weak\n`;
    prompt += `- **User Language Patterns:** Phrases real users use in reviews - incorporate naturally\n\n`;
    prompt += `Saved research:\n${researchSections.join("\n")}\n\n`;
  } else {
    prompt += `No saved keyword research found at ${researchDir}.\n`;
    prompt += `**Stop and request action**: Run the 'keyword-research' tool with slug='${slug}', locale='${primaryLocale}', and the appropriate platform/country, then rerun improve-public stage 1.\n\n`;
  }

  prompt += `## Step 2: Optimize All Fields (${primaryLocale})\n\n`;
  prompt += `**Apply keywords strategically based on tier priority:**\n\n`;
  prompt += `### Tier 1 Keywords (Core) → Title & Subtitle\n`;
  prompt += `- \`aso.title\` (≤30): **"App Name: [Tier1 Keyword]"** format\n`;
  prompt += `  - App name in English, keyword in target language, uppercase after colon\n`;
  prompt += `  - **Do NOT translate/rename the app name**\n`;
  prompt += `- \`aso.subtitle\` (≤30): Use remaining Tier 1 keywords\n`;
  prompt += `- \`aso.shortDescription\` (≤80): Tier 1 + Tier 2 keywords (no emojis/CAPS)\n\n`;
  prompt += `### Tier 2 Keywords (Feature) → Keywords Field & Descriptions\n`;
  prompt += `- \`aso.keywords\` (≤100): ALL tiers, comma-separated (Tier 1 first, then Tier 2, then Tier 3)\n`;
  prompt += `- \`landing.hero.title\`: Tier 1 + Tier 2 keywords\n`;
  prompt += `- \`landing.hero.description\`: Tier 2 keywords naturally integrated\n`;
  prompt += `- \`landing.screenshots.images[].title\`: Tier 2 keywords\n`;
  prompt += `- \`landing.screenshots.images[].description\`: Tier 2 + Tier 3 keywords\n\n`;
  prompt += `### Tier 3 Keywords (Longtail) → Content Sections\n`;
  prompt += `- \`aso.template.intro\` (≤300): Tier 2 + Tier 3 keywords, keyword-rich, use full length\n`;
  prompt += `- \`aso.template.outro\` (≤200): Tier 3 keywords, natural integration\n`;
  prompt += `- \`landing.features.items[].title\`: Tier 2 keywords\n`;
  prompt += `- \`landing.features.items[].body\`: Tier 3 keywords with user language patterns\n`;
  prompt += `- \`landing.reviews.title/description\`: Keywords if applicable\n`;
  prompt += `- \`landing.cta.headline/description\`: Keywords if applicable\n\n`;
  prompt += `### User Language Integration\n`;
  prompt += `- Use **User Language Patterns** from research in intro/outro/features\n`;
  prompt += `- These are actual phrases users search for - incorporate naturally\n\n`;
  prompt += `**Guidelines**: 2.5-3% keyword density, natural flow, cultural appropriateness\n`;
  prompt += `**CRITICAL**: You MUST include the complete \`landing\` object in your optimized JSON output.\n\n`;

  prompt += `## Step 3: Validate\n\n`;
  prompt += `Check all limits: title ≤30, subtitle ≤30, shortDescription ≤80, keywords ≤100, intro ≤300, outro ≤200\n\n`;

  prompt += `## Current Data\n\n`;
  prompt += `${
    localeSections.find((s) => s.includes(`[${primaryLocale}]`)) ||
    localeSections[0]
  }\n\n`;

  prompt += `## Output Format\n\n`;
  prompt += `**1. Keyword Research (from saved data)**\n`;
  prompt += `   - Cite file(s) used and list the selected top 10 keywords (no new research)\n`;
  prompt += `   - Rationale: why these 10 were chosen from saved research\n\n`;
  prompt += `**2. Optimized JSON** (complete ${primaryLocale} locale structure)\n`;
  prompt += `   - MUST include complete \`aso\` object with all fields\n`;
  prompt += `   - MUST include complete \`landing\` object with:\n`;
  prompt += `     * \`landing.hero\` (title, description, titleHighlight)\n`;
  prompt += `     * \`landing.screenshots.images[]\` (all items with title and description)\n`;
  prompt += `     * \`landing.features.items[]\` (all items with title and body)\n`;
  prompt += `     * \`landing.reviews\` (title, description, icons, rating, testimonials)\n`;
  prompt += `     * \`landing.cta\` (headline, icons, rating, description)\n\n`;
  prompt += `**3. Validation**\n`;
  prompt += `   - title: X/30 ✓/✗\n`;
  prompt += `   - subtitle: X/30 ✓/✗\n`;
  prompt += `   - shortDescription: X/80 ✓/✗\n`;
  prompt += `   - keywords: X/100 ✓/✗\n`;
  prompt += `   - intro: X/300 ✓/✗\n`;
  prompt += `   - outro: X/200 ✓/✗\n`;
  prompt += `   - Density: X% (2.5-3%) ✓/✗\n\n`;

  prompt += `**Reference**: ${FIELD_LIMITS_DOC_PATH}\n`;

  return prompt;
}

/**
 * Stage 2: Keyword Localization
 * - Research keywords for each target locale
 * - Replace keywords while preserving context/structure
 * - Supports batch processing to prevent content truncation
 */
export function generateKeywordLocalizationPrompt(
  args: GenerateKeywordLocalizationPromptArgs
): string {
  const {
    slug,
    primaryLocale,
    targetLocales,
    localeSections,
    optimizedPrimary,
    keywordResearchByLocale,
    keywordResearchDirByLocale,
    batchLocales,
    batchIndex,
    totalBatches,
    batchLocaleSections,
  } = args;

  // Use batch locales if provided, otherwise use all non-primary locales
  const nonPrimaryLocales =
    batchLocales || targetLocales.filter((l) => l !== primaryLocale);
  const sectionsToUse = batchLocaleSections || localeSections;

  let prompt = `# ASO Optimization - Stage 2: Keyword Localization`;

  if (batchIndex !== undefined && totalBatches !== undefined) {
    prompt += ` (Batch ${batchIndex + 1}/${totalBatches})`;
  }

  prompt += `\n\n`;
  prompt += `Product: ${slug} | Primary: ${primaryLocale} | Batch Locales: ${nonPrimaryLocales.join(
    ", "
  )}\n\n`;

  if (batchIndex !== undefined && totalBatches !== undefined) {
    prompt += `**⚠️ BATCH PROCESSING MODE**\n\n`;
    prompt += `This is batch ${batchIndex + 1} of ${totalBatches}.\n`;
    prompt += `Process ONLY the locales in this batch: ${nonPrimaryLocales.join(
      ", "
    )}\n`;
    prompt += `After completing this batch, save the files and proceed to the next batch.\n\n`;
  }

  prompt += `## Task\n\n`;
  prompt += `**CRITICAL: Only process locales that already exist in public/products/${slug}/locales/.**\n`;
  prompt += `**Do NOT create new locale files - only improve existing ones.**\n\n`;
  prompt += `For EACH target locale in this batch:\n`;
  prompt += `1. Use SAVED keyword research (see per-locale data below). Do NOT invent keywords.\n`;
  prompt += `2. Replace keywords in translated content (preserve structure/tone/context)\n`;
  prompt += `3. Validate character limits\n`;
  prompt += `4. **SAVE the updated JSON to file** using the save-locale-file tool (only if file exists)\n\n`;

  prompt += `## Optimized Primary (Reference)\n\n`;
  prompt += `Use this as the base structure/messaging:\n\`\`\`json\n${optimizedPrimary}\n\`\`\`\n\n`;

  prompt += `## Keyword Research (Per Locale)\n\n`;
  nonPrimaryLocales.forEach((loc) => {
    const researchSections = keywordResearchByLocale[loc] || [];
    const researchDir = keywordResearchDirByLocale[loc];
    if (researchSections.length > 0) {
      prompt += `Locale ${loc}: use saved research below. Do NOT invent keywords.\n${researchSections.join(
        "\n"
      )}\n\n`;
    } else {
      prompt += `Locale ${loc}: no saved keyword research found at ${researchDir}. Stop and request running 'keyword-research' tool (slug='${slug}', locale='${loc}', platform/country as appropriate—match the store locale), then rerun stage 2.\n\n`;
    }
  });

  prompt += `## Keyword Replacement Strategy\n\n`;
  prompt += `For EACH locale:\n`;
  prompt += `1. Take the TRANSLATED content (below)\n`;
  prompt += `2. Replace \`aso.keywords\` array with new 10 keywords\n`;
  prompt += `3. **TITLE FORMAT**: \`aso.title\` must follow **"App Name: Primary Keyword"** format:\n`;
  prompt += `   - App name: **ALWAYS in English** (e.g., "Aurora EOS", "Timeline", "Recaply")\n`;
  prompt += `   - Primary keyword: **In target language** (e.g., "오로라 예보" for Korean, "オーロラ予報" for Japanese)\n`;
  prompt += `   - Example: "Aurora EOS: 오로라 예보" (Korean), "Aurora EOS: オーロラ予報" (Japanese)\n`;
  prompt += `   - The keyword after the colon must start with an uppercase letter\n`;
  prompt += `   - **Do NOT translate/rename the app name**; keep the original English app name across all locales.\n`;
  prompt += `4. Swap keywords in sentences while keeping:\n`;
  prompt += `   - Original sentence structure\n`;
  prompt += `   - Tone and messaging\n`;
  prompt += `   - Context and flow\n`;
  prompt += `   - Character limits\n\n`;
  prompt += `4. **CRITICAL**: Update ALL \`landing\` sections:\n`;
  prompt += `   - \`landing.hero.title\` and \`landing.hero.description\`: Include keywords naturally\n`;
  prompt += `   - \`landing.screenshots.images[].title\`: Incorporate keywords in all screenshot titles\n`;
  prompt += `   - \`landing.screenshots.images[].description\`: Include keywords in all screenshot descriptions\n`;
  prompt += `   - \`landing.features.items[].title\`: Add keywords to feature titles where natural\n`;
  prompt += `   - \`landing.features.items[].body\`: Weave keywords into feature descriptions\n`;
  prompt += `   - \`landing.reviews.title\` and \`landing.reviews.description\`: Include keywords if applicable\n`;
  prompt += `   - \`landing.cta.headline\` and \`landing.cta.description\`: Include keywords if applicable\n`;
  prompt += `   - Maintain original context and meaning\n`;
  prompt += `   - Use language-specific terms that users actually search for\n`;
  prompt += `   - **DO NOT leave any landing fields in English** - all must be translated\n\n`;
  prompt += `**Example**:\n`;
  prompt += `- Original: "Track aurora with real-time forecasts"\n`;
  prompt += `- Korean keywords: 오로라, 예보, 실시간\n`;
  prompt += `- Result: "실시간 예보로 오로라 추적"\n`;
  prompt += `  (structure changed for Korean, but context preserved)\n\n`;

  prompt += `## Current Translated Locales (This Batch)\n\n`;
  nonPrimaryLocales.forEach((loc) => {
    const section = sectionsToUse.find((s) => s.includes(`[${loc}]`));
    if (section) {
      prompt += `${section}\n\n`;
    }
  });

  prompt += `## Workflow\n\n`;
  prompt += `Process EACH locale in this batch sequentially:\n`;
  prompt += `1. Use saved keyword research (or pause if missing and request keyword-research run)\n`;
  prompt += `2. Replace keywords in ALL fields:\n`;
  prompt += `   - \`aso.keywords\` array\n`;
  prompt += `   - \`aso.title\`, \`aso.subtitle\`, \`aso.shortDescription\`\n`;
  prompt += `   - \`aso.template.intro\`, \`aso.template.outro\`\n`;
  prompt += `   - \`landing.hero.title\` and \`landing.hero.description\`\n`;
  prompt += `   - \`landing.screenshots.images[].title\` and \`description\` (ALL items)\n`;
  prompt += `   - \`landing.features.items[].title\` and \`body\` (ALL items)\n`;
  prompt += `   - \`landing.reviews.title\` and \`landing.reviews.description\`\n`;
  prompt += `   - \`landing.cta.headline\` and \`landing.cta.description\`\n`;
  prompt += `3. **CRITICAL**: Ensure ALL landing fields are translated (not English)\n`;
  prompt += `4. Validate limits\n`;
  prompt += `5. **SAVE the updated JSON to file** using save-locale-file tool\n`;
  prompt += `6. Move to next locale in batch\n\n`;

  if (batchIndex !== undefined && totalBatches !== undefined) {
    prompt += `## After Completing This Batch\n\n`;
    prompt += `1. Verify all locales in this batch have been saved to files\n`;
    if (batchIndex + 1 < totalBatches) {
      prompt += `2. Proceed to next batch (batch ${
        batchIndex + 2
      }/${totalBatches})\n`;
      prompt += `3. Use the same optimizedPrimary JSON as reference\n\n`;
    } else {
      prompt += `2. All batches completed! ✅\n\n`;
    }
  }

  prompt += `## Output Format (Per Locale)\n\n`;
  prompt += `For EACH locale, provide:\n\n`;
  prompt += `### Locale [locale-code]:\n\n`;
  prompt += `**1. Keyword Research (saved)**\n`;
  prompt += `   - Cite file(s) used; list selected top 10 keywords (no new research)\n`;
  prompt += `   - Rationale: why these were chosen from saved research\n\n`;
  prompt += `**2. Updated JSON** (complete locale structure with keyword replacements)\n`;
  prompt += `   - MUST include complete \`aso\` object\n`;
  prompt += `   - MUST include complete \`landing\` object with ALL sections:\n`;
  prompt += `     * hero (title, description, titleHighlight)\n`;
  prompt += `     * screenshots.images[] (all items with translated title and description)\n`;
  prompt += `     * features.items[] (all items with translated title and body)\n`;
  prompt += `     * reviews (title, description, icons, rating, testimonials)\n`;
  prompt += `     * cta (headline, icons, rating, description)\n`;
  prompt += `   - **NO English text in landing sections** - everything must be translated\n\n`;
  prompt += `**3. Validation**\n`;
  prompt += `   - All fields within limits ✓/✗\n\n`;
  prompt += `**4. File Save Confirmation**\n`;
  prompt += `   - Confirm file saved: public/products/${slug}/locales/[locale-code].json\n`;
  prompt += `   - **Only save if the file already exists** - do not create new files\n\n`;
  prompt += `---\n\n`;
  prompt += `Repeat for all locales in this batch: ${nonPrimaryLocales.join(
    ", "
  )}\n`;

  return prompt;
}
