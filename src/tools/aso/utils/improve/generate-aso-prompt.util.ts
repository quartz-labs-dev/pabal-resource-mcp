const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

interface GenerateAsoPromptArgs {
  slug: string;
  category: string | undefined;
  primaryLocale: string;
  targetLocales: string[];
  localeSections: string[];
  keywordResearchByLocale: Record<string, string[]>;
  keywordResearchDirByLocale: Record<string, string>;
  keywordResearchFallbackByLocale: Record<
    string,
    { isFallback: boolean; fallbackLocale?: string }
  >;
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
  prompt += `**Priority:** When both iOS and Android research exist, keep iOS keywords first and only add Android keywords if there is room after meeting character limits.\n\n`;

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

  prompt += `## Step 3: Validate (after applying all keywords)\n\n`;
  prompt += `Check all limits using ${FIELD_LIMITS_DOC_PATH}: title ≤30, subtitle ≤30, shortDescription ≤80, keywords ≤100, intro ≤300, outro ≤200\n`;
  prompt += `- Remove keyword duplicates (unique list; avoid repeating title/subtitle terms verbatim)\n`;
  prompt += `- Ensure App Store/Play Store rules from ${FIELD_LIMITS_DOC_PATH} are satisfied (no disallowed characters/formatting)\n\n`;

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
  prompt += `   - keywords: X/100 ✓/✗ (deduped ✓/✗)\n`;
  prompt += `   - intro: X/300 ✓/✗\n`;
  prompt += `   - outro: X/200 ✓/✗\n`;
  prompt += `   - Store rules (${FIELD_LIMITS_DOC_PATH}): ✓/✗\n`;
  prompt += `   - Density: X% (2.5-3%) ✓/✗\n\n`;

  prompt += `**Reference**: ${FIELD_LIMITS_DOC_PATH}\n\n`;

  prompt += `---\n\n`;
  prompt += `## Next Step\n\n`;
  prompt += `After saving the optimized JSON, proceed to **Stage 2** to optimize other locales:\n`;
  prompt += `\`\`\`\nimprove-public(slug="${slug}", stage="2", optimizedPrimary=<the JSON you just created>)\n\`\`\`\n`;

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
  prompt += `2. **Replace ONLY keywords with optimized keywords** - keep ALL existing content, structure, tone, and context unchanged. Only swap keywords for better ASO keywords.\n`;
  prompt += `3. After all keywords are applied, validate character limits + store rules (${FIELD_LIMITS_DOC_PATH}) + keyword duplication\n`;
  prompt += `4. **SAVE the updated JSON to file** using the save-locale-file tool (only if file exists)\n\n`;

  prompt += `## Optimized Primary (Reference)\n\n`;
  prompt += `Use this as the base structure/messaging:\n\`\`\`json\n${optimizedPrimary}\n\`\`\`\n\n`;

  const { keywordResearchFallbackByLocale } = args;

  // Check which locales need fallback
  const localesNeedingFallback = nonPrimaryLocales.filter((loc) => {
    const fallbackInfo = keywordResearchFallbackByLocale?.[loc];
    const researchSections = keywordResearchByLocale[loc] || [];
    return researchSections.length === 0 || fallbackInfo?.isFallback;
  });

  // Get primary locale research for fallback (only show if needed)
  const primaryResearchSections = keywordResearchByLocale[primaryLocale] || [];
  const hasPrimaryResearch = primaryResearchSections.length > 0;

  prompt += `## Keyword Research (Per Locale)\n\n`;
  prompt += `**Priority:** Use each locale's own keyword research. English fallback is ONLY used when locale-specific research is missing.\n`;
  prompt += `When both iOS and Android research exist for a locale, treat iOS keywords as primary; use Android keywords only if space remains after fitting iOS keywords within character limits.\n\n`;

  // Only show English fallback section if some locales need it
  if (hasPrimaryResearch && localesNeedingFallback.length > 0) {
    prompt += `---\n`;
    prompt += `**📚 ENGLISH FALLBACK (${primaryLocale})** - Only for locales without their own research: ${localesNeedingFallback.join(
      ", "
    )}\n`;
    prompt += `${primaryResearchSections.join("\n")}\n\n`;
    prompt += `---\n\n`;
  }

  nonPrimaryLocales.forEach((loc) => {
    const researchSections = keywordResearchByLocale[loc] || [];
    const researchDir = keywordResearchDirByLocale[loc];
    const fallbackInfo = keywordResearchFallbackByLocale?.[loc];

    if (researchSections.length > 0 && !fallbackInfo?.isFallback) {
      // ✅ Locale-specific research found - use it directly
      prompt += `### Locale ${loc}: ✅ Using locale-specific keyword research\n`;
      prompt += researchSections.join("\n");
      prompt += `\n**Use these ${loc} keywords directly** - they are already in the target language.\n\n`;
    } else if (researchSections.length > 0 && fallbackInfo?.isFallback) {
      // 🔄 Using fallback (en-US/en) keywords - need translation
      prompt += `### Locale ${loc}: 🔄 No ${loc} research found - Using ${fallbackInfo.fallbackLocale} as fallback\n`;
      prompt += researchSections.join("\n");
      prompt += `\n**MUST TRANSLATE:** The keywords above are in ${fallbackInfo.fallbackLocale}. You MUST:\n`;
      prompt += `1. **TRANSLATE each keyword into ${loc}** - use natural, native expressions\n`;
      prompt += `2. Ensure translated keywords are what ${loc} users would actually search for\n`;
      prompt += `3. **DO NOT use ${fallbackInfo.fallbackLocale} keywords directly** - all keywords must be in ${loc} language\n\n`;
    } else if (hasPrimaryResearch) {
      // ⚠️ No research at all - use English fallback from above
      prompt += `### Locale ${loc}: ⚠️ No research found - TRANSLATE from English fallback above\n`;
      prompt += `No keyword research found at ${researchDir}.\n`;
      prompt += `**Use the ENGLISH FALLBACK section above** and TRANSLATE all keywords to ${loc}.\n\n`;
    } else {
      // ❌ No research anywhere - extract from optimizedPrimary
      prompt += `### Locale ${loc}: ❌ No research available\n`;
      prompt += `No keyword research found. Extract keywords from \`aso.keywords\` in optimizedPrimary and **TRANSLATE them to ${loc}**.\n\n`;
    }
  });

  prompt += `## Keyword Replacement Strategy\n\n`;
  prompt += `**CRITICAL: Keep ALL existing content unchanged. Only replace keywords with optimized keywords.**\n\n`;
  prompt += `For EACH locale:\n`;
  prompt += `- Priority: Keep iOS-sourced keywords first; add Android keywords only if there is remaining space after iOS keywords fit within field limits.\n`;
  prompt += `1. Take the EXISTING translated content (below) - **DO NOT change the content itself**\n`;
  prompt += `2. Replace \`aso.keywords\` array with optimized keywords (keep same count/structure)\n`;
  prompt += `3. **TITLE FORMAT**: \`aso.title\` must follow **"App Name: Primary Keyword"** format:\n`;
  prompt += `   - App name: **ALWAYS in English** (e.g., "Aurora EOS", "Timeline", "Recaply)\n`;
  prompt += `   - Primary keyword: **In target language** (e.g., "오로라 예보" for Korean, "オーロラ予報" for Japanese)\n`;
  prompt += `   - Example: "Aurora EOS: 오로라 예보" (Korean), "Aurora EOS: オーロラ予報" (Japanese)\n`;
  prompt += `   - The keyword after the colon must start with an uppercase letter\n`;
  prompt += `   - **Do NOT translate/rename the app name**; keep the original English app name across all locales.\n`;
  prompt += `   - **Only replace the keyword part** - keep the app name and format structure unchanged\n`;
  prompt += `4. Deduplicate keywords: final \`aso.keywords\` must be unique and should not repeat title/subtitle terms verbatim\n`;
  prompt += `5. **Replace keywords in existing sentences** - swap ONLY the keywords, keep everything else:\n`;
  prompt += `   - **Keep original sentence structure exactly as is**\n`;
  prompt += `   - **Keep original tone and messaging unchanged**\n`;
  prompt += `   - **Keep original context and flow unchanged**\n`;
  prompt += `   - **Only swap individual keywords** for better ASO keywords\n`;
  prompt += `   - Maintain character limits\n\n`;
  prompt += `6. **CRITICAL**: Update keywords in ALL \`landing\` sections (replace keywords only, keep content structure):\n`;
  prompt += `   - \`landing.hero.title\` and \`landing.hero.description\`: Replace keywords only, keep existing text structure\n`;
  prompt += `   - \`landing.screenshots.images[].title\`: Replace keywords in existing titles, keep structure\n`;
  prompt += `   - \`landing.screenshots.images[].description\`: Replace keywords in existing descriptions, keep structure\n`;
  prompt += `   - \`landing.features.items[].title\`: Replace keywords in existing titles, keep structure\n`;
  prompt += `   - \`landing.features.items[].body\`: Replace keywords in existing descriptions, keep structure\n`;
  prompt += `   - \`landing.reviews.title\` and \`landing.reviews.description\`: Replace keywords if applicable, keep structure\n`;
  prompt += `   - \`landing.cta.headline\` and \`landing.cta.description\`: Replace keywords if applicable, keep structure\n`;
  prompt += `   - **Maintain ALL original context, meaning, and structure**\n`;
  prompt += `   - Use optimized keywords that users actually search for\n`;
  prompt += `   - **DO NOT rewrite or restructure content** - only replace keywords\n\n`;
  prompt += `**Example** (keyword replacement only, content unchanged):\n`;
  prompt += `- Original: "Track aurora with real-time forecasts"\n`;
  prompt += `- Optimized keywords: 오로라, 예보, 실시간\n`;
  prompt += `- Result: "Track 오로라 with 실시간 예보" (keywords replaced, structure kept)\n`;
  prompt += `  OR: "실시간 예보로 오로라 추적" (if natural keyword placement requires minor word order, but keep meaning identical)\n\n`;

  prompt += `## Current Translated Locales (This Batch)\n\n`;
  nonPrimaryLocales.forEach((loc) => {
    const section = sectionsToUse.find((s) => s.includes(`[${loc}]`));
    if (section) {
      prompt += `${section}\n\n`;
    }
  });

  prompt += `## Workflow\n\n`;
  prompt += `Process EACH locale in this batch sequentially:\n`;
  prompt += `1. Use saved keyword research (in target language) OR **TRANSLATE English keywords from primary locale** if missing (see fallback strategy above - MUST translate, not use English directly)\n`;
  prompt += `2. **Replace keywords ONLY** in ALL fields (keep existing content structure unchanged):\n`;
  prompt += `   - \`aso.keywords\` array\n`;
  prompt += `   - \`aso.title\`, \`aso.subtitle\`, \`aso.shortDescription\`\n`;
  prompt += `   - \`aso.template.intro\`, \`aso.template.outro\`\n`;
  prompt += `   - \`landing.hero.title\` and \`landing.hero.description\`\n`;
  prompt += `   - \`landing.screenshots.images[].title\` and \`description\` (ALL items)\n`;
  prompt += `   - \`landing.features.items[].title\` and \`body\` (ALL items)\n`;
  prompt += `   - \`landing.reviews.title\` and \`landing.reviews.description\`\n`;
  prompt += `   - **For each field: Replace keywords only, keep existing content structure and meaning unchanged**\n`;
  prompt += `3. **CRITICAL**: Ensure ALL landing fields are translated (not English)\n`;
  prompt += `4. After swapping keywords, validate limits + store rules (${FIELD_LIMITS_DOC_PATH}) + keyword duplication (unique list; avoid repeating title/subtitle terms verbatim)\n`;
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
      prompt += `2. All batches completed! ✅\n`;
      prompt += `3. **Run validate-aso** to verify all locales:\n`;
      prompt += `   \`\`\`\n   validate-aso(slug="${slug}")\n   \`\`\`\n\n`;
    }
  }

  prompt += `## Output Format (Per Locale)\n\n`;
  prompt += `For EACH locale, provide:\n\n`;
  prompt += `### Locale [locale-code]:\n\n`;
  prompt += `**1. Keyword Source**\n`;
  prompt += `   - If saved research exists: Cite file(s) used; list selected top 10 keywords (in target language)\n`;
  prompt += `   - If using fallback: List **TRANSLATED** keywords from primary locale (English → target language) with translation rationale\n`;
  prompt += `   - Show final 10 keywords **IN TARGET LANGUAGE** with tier assignments - DO NOT show English keywords\n\n`;
  prompt += `**2. Updated JSON** (complete locale structure with keyword replacements only)\n`;
  prompt += `   - **CRITICAL**: Keep ALL existing content structure and meaning unchanged - only replace keywords\n`;
  prompt += `   - MUST include complete \`aso\` object (keywords replaced, content structure kept)\n`;
  prompt += `   - MUST include complete \`landing\` object with ALL sections (keywords replaced, content structure kept):\n`;
  prompt += `     * hero (title, description, titleHighlight) - replace keywords only\n`;
  prompt += `     * screenshots.images[] (all items with keywords replaced in existing titles/descriptions)\n`;
  prompt += `     * features.items[] (all items with keywords replaced in existing titles/bodies)\n`;
  prompt += `     * reviews (title, description, icons, rating, testimonials) - replace keywords if applicable\n`;
  prompt += `     * cta (headline, icons, rating, description) - replace keywords if applicable\n`;
  prompt += `   - **NO English text in landing sections** - everything must be translated\n`;
  prompt += `   - **DO NOT rewrite or restructure content** - only swap keywords for optimized keywords\n\n`;
  prompt += `**3. Validation**\n`;
  prompt += `   - title: X/30 ✓/✗\n`;
  prompt += `   - subtitle: X/30 ✓/✗\n`;
  prompt += `   - shortDescription: X/80 ✓/✗\n`;
  prompt += `   - keywords: X/100 ✓/✗ (deduped ✓/✗; not repeating title/subtitle)\n`;
  prompt += `   - intro: X/300 ✓/✗\n`;
  prompt += `   - outro: X/200 ✓/✗\n`;
  prompt += `   - Store rules (${FIELD_LIMITS_DOC_PATH}): ✓/✗\n\n`;
  prompt += `**4. File Save Confirmation**\n`;
  prompt += `   - Confirm file saved: public/products/${slug}/locales/[locale-code].json\n`;
  prompt += `   - **Only save if the file already exists** - do not create new files\n\n`;
  prompt += `---\n\n`;
  prompt += `Repeat for all locales in this batch: ${nonPrimaryLocales.join(
    ", "
  )}\n\n`;

  // Add final validation step for last batch or when processing all at once
  const isLastBatch =
    batchIndex === undefined ||
    (totalBatches && batchIndex + 1 >= totalBatches);
  if (isLastBatch) {
    prompt += `---\n\n`;
    prompt += `## Final Step: Validate All Locales\n\n`;
    prompt += `After completing ALL locale optimizations, run validation:\n`;
    prompt += `\`\`\`\nvalidate-aso(slug="${slug}")\n\`\`\`\n\n`;
    prompt += `This checks:\n`;
    prompt += `- Field length limits (title ≤30, subtitle ≤30, keywords ≤100, etc.)\n`;
    prompt += `- Keyword duplicates\n`;
    prompt += `- Invalid characters\n`;
  }

  return prompt;
}
