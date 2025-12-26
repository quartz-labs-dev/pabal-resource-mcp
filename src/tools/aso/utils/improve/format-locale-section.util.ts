import type { ProductLocale, AsoTemplate } from "../../../../types/products/index.js";
import {
  extractKeywordsFromContent,
  analyzeKeywords,
  generateKeywordResearchQueries,
} from "./keyword-analysis.util.js";

const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

interface FormatLocaleSectionArgs {
  slug: string;
  locale: string;
  localeData: ProductLocale;
  fullDescription?: string;
  primaryLocale: string;
  category?: string;
}

/**
 * Generate keyword suggestions section for a locale
 */
function generateKeywordSuggestions(args: {
  currentKeywords: string[];
  category: string | undefined;
  title: string | undefined;
  description: string;
  locale: string;
  features?: Array<{ title?: string; body?: string }>;
  screenshots?: Array<{ title?: string; description?: string }>;
}): string {
  const { currentKeywords, category, title, description, locale, features = [], screenshots = [] } = args;

  const analysis = analyzeKeywords(description);
  const topKeywords = Object.entries(analysis.keywordDensity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  const researchQueries = generateKeywordResearchQueries({
    currentKeywords,
    category,
    title,
    locale,
    features,
    screenshots,
  });

  let suggestions = `## Keyword Analysis & Research (${locale})\n\n`;
  suggestions += `### Current Keywords:\n`;
  suggestions += `- ${currentKeywords.join(", ") || "(none)"}\n\n`;

  suggestions += `### Top Keywords Found in Content (by frequency):\n`;
  topKeywords.slice(0, 10).forEach((keyword, idx) => {
    const density = analysis.keywordDensity[keyword]?.toFixed(2) || "0";
    suggestions += `${idx + 1}. "${keyword}" (density: ${density}%)\n`;
  });
  suggestions += `\n`;

  suggestions += `### Keyword Research Queries (MULTIPLE SEARCH STRATEGIES REQUIRED):\n`;
  suggestions += `**IMPORTANT**: Use ALL 5 search strategies below. Don't rely on just one approach.\n\n`;
  suggestions += `#### Strategy 1: Direct Store Search\n`;
  suggestions += `- Search App Store/Play Store: "${category ? category.toLowerCase().replace(/_/g, " ") : "category"} apps"\n`;
  suggestions += `- Visit top 5-10 apps, extract keywords from their names, descriptions, screenshots\n\n`;
  suggestions += `#### Strategy 2: ASO Guides & Tools\n`;
  researchQueries.slice(0, 4).forEach((query, idx) => {
    suggestions += `${idx + 1}. "${query}"\n`;
  });
  suggestions += `\n`;
  suggestions += `#### Strategy 3: User Intent Searches\n`;
  if (title) {
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    titleWords.slice(0, 3).forEach((word, idx) => {
      suggestions += `${idx + 1}. "${word} app"\n`;
    });
  }
  suggestions += `- Search: "[primary feature] app", "[problem solved] app"\n\n`;
  suggestions += `#### Strategy 4: Competitor Analysis\n`;
  suggestions += `- Search: "top ${category ? category.toLowerCase().replace(/_/g, " ") : "category"} apps"\n`;
  suggestions += `- "best ${category ? category.toLowerCase().replace(/_/g, " ") : "category"} apps 2024"\n\n`;
  suggestions += `#### Strategy 5: Long-tail Keywords\n`;
  currentKeywords.slice(0, 3).forEach((keyword, idx) => {
    if (keyword.length > 3) {
      suggestions += `${idx + 1}. "${keyword} app store keywords"\n`;
    }
  });
  suggestions += `\n`;
  suggestions += `**What to Extract**:\n`;
  suggestions += `- Exact keyword phrases (2-4 words) from top apps\n`;
  suggestions += `- Feature terms, benefit terms, category jargon\n`;
  suggestions += `- Action verbs and technical terms\n`;
  suggestions += `- Minimum 15-20 keywords, prioritize those used by 3+ top apps\n\n`;

  suggestions += `### Keyword Optimization Guidelines:\n`;
  suggestions += `1. **Keywords Array (CRITICAL)**: Update aso.keywords array with researched keywords. This directly impacts App Store search visibility\n`;
  suggestions += `2. **Keyword Density**: Maintain 2.5-3% density for primary keywords, distributed naturally\n`;
  suggestions += `3. **Title/Subtitle**: Include 1-2 core keywords (30 char limit)\n`;
  suggestions += `4. **Short Description**: Include searchable keywords (80 char limit)\n`;
  suggestions += `5. **Full Description**: Place primary keywords in first 2-3 lines, distribute naturally throughout\n`;
  suggestions += `6. **template.intro**: Use up to 300 chars to naturally incorporate more keywords and provide richer context\n`;
  suggestions += `7. **App Store Keywords**: 100 char limit, comma-separated, avoid duplicates from name/subtitle\n\n`;

  if (category) {
    suggestions += `### Category-Based Keyword Strategy:\n`;
    suggestions += `Category: ${category}\n`;
    suggestions += `- Research top-ranking apps in "${category}" category\n`;
    suggestions += `- Identify common keywords used by successful competitors\n`;
    suggestions += `- Focus on user search intent and specific terms users actually search for\n`;
    suggestions += `- Avoid brand names and competitor names\n\n`;
  }

  return suggestions;
}

/**
 * Format a locale section with stats and keyword analysis
 */
export function formatLocaleSection(
  args: FormatLocaleSectionArgs
): string {
  const {
    slug,
    locale,
    localeData,
    fullDescription,
    primaryLocale,
    category,
  } = args;
  const aso = localeData.aso || {};
  const template: AsoTemplate | undefined = aso.template;
  const landing = localeData.landing || {};
  const hero = landing.hero || {};
  const screenshots = landing.screenshots?.images || [];
  const features = landing.features?.items || [];

  const lengthOf = (value?: string) => (value ? value.length : 0);
  const keywordsLength = Array.isArray(aso.keywords)
    ? aso.keywords.join(", ").length
    : lengthOf(typeof aso.keywords === "string" ? aso.keywords : undefined);

  const header = `--- ${locale}${
    locale === primaryLocale ? " (primary)" : ""
  } ---`;
  const stats = [
    `Path: public/products/${slug}/locales/${locale}.json`,
    `- aso.title: ${lengthOf(aso.title)} chars`,
    `- aso.subtitle: ${lengthOf(aso.subtitle)} chars`,
    `- aso.shortDescription: ${lengthOf(aso.shortDescription)} chars`,
    `- aso.keywords: ${keywordsLength} chars total`,
    `- template.intro: ${lengthOf(template?.intro)} chars (limit: 300)`,
    `- template.outro: ${lengthOf(template?.outro)} chars (limit: 200)`,
    `- landing.hero.title: ${lengthOf(hero.title)} chars`,
    `- landing.hero.description: ${lengthOf(hero.description)} chars`,
    `- features: ${features.length} items`,
    `- screenshots: ${screenshots.length} captions`,
    `- fullDescription (derived): ${fullDescription?.length ?? 0} chars`,
  ].join("\n");

  // Keyword analysis
  const currentKeywords = extractKeywordsFromContent(localeData);
  // Include landing area text in keyword analysis
  const landingText = [
    hero.title,
    hero.description,
    ...screenshots.map((img) => `${img.title} ${img.description || ""}`),
    ...features.map((item) => `${item.title} ${item.body || ""}`),
    landing.reviews?.title,
    landing.reviews?.description,
    landing.cta?.headline,
    landing.cta?.description,
  ]
    .filter(Boolean)
    .join(" ");
  const fullText = [
    aso.title,
    aso.subtitle,
    aso.shortDescription,
    template?.intro,
    template?.outro,
    fullDescription,
    landingText,
  ]
    .filter(Boolean)
    .join(" ");

  const keywordAnalysis = generateKeywordSuggestions({
    currentKeywords,
    category,
    title: aso.title,
    description: fullText,
    locale,
    features,
    screenshots,
  });

  const json = JSON.stringify(localeData, null, 2);

  return `${header}\n${stats}\n\n${keywordAnalysis}\n\`\`\`json\n${json}\n\`\`\`\n`;
}

