import type { ProductLocale } from "../../../../types/products/index.js";

export interface KeywordAnalysis {
  keywordFrequency: Record<string, number>;
  keywordDensity: Record<string, number>;
  totalWords: number;
}

/**
 * Analyze keywords in content: frequency and density
 */
export function analyzeKeywords(content: string): KeywordAnalysis {
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  const totalWords = words.length;
  const density: Record<string, number> = {};
  for (const [word, count] of Object.entries(frequency)) {
    density[word] = (count / totalWords) * 100;
  }

  return { keywordFrequency: frequency, keywordDensity: density, totalWords };
}

/**
 * Extract keywords from ProductLocale content
 * Includes ASO fields, landing features, and screenshots for comprehensive keyword extraction
 */
export function extractKeywordsFromContent(
  localeData: ProductLocale
): string[] {
  const keywords = new Set<string>();
  const aso = localeData.aso || {};
  const landing = localeData.landing || {};

  // Extract from existing keywords
  if (Array.isArray(aso.keywords)) {
    aso.keywords.forEach((kw) => keywords.add(kw.toLowerCase()));
  } else if (typeof aso.keywords === "string") {
    aso.keywords
      .split(",")
      .map((kw) => kw.trim().toLowerCase())
      .forEach((kw) => keywords.add(kw));
  }

  // Extract from title, subtitle, shortDescription
  [aso.title, aso.subtitle, aso.shortDescription].forEach((text) => {
    if (text) {
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2)
        .forEach((word) => keywords.add(word));
    }
  });

  // Extract from template
  if (aso.template?.intro) {
    aso.template.intro
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word: string) => word.length > 3)
      .forEach((word: string) => keywords.add(word));
  }
  if (aso.template?.outro) {
    aso.template.outro
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word: string) => word.length > 3)
      .forEach((word: string) => keywords.add(word));
  }

  // Extract from landing.hero
  const hero = landing.hero || {};
  [hero.title, hero.description].forEach((text) => {
    if (text) {
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .forEach((word: string) => keywords.add(word));
    }
  });

  // Extract from landing.features
  const features = landing.features?.items || [];
  features.forEach((feature) => {
    if (feature.title) {
      feature.title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .forEach((word: string) => keywords.add(word));
    }
    if (feature.body) {
      feature.body
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .forEach((word: string) => keywords.add(word));
    }
  });

  // Extract from landing.screenshots
  const screenshots = landing.screenshots?.images || [];
  screenshots.forEach((screenshot) => {
    if (screenshot.title) {
      screenshot.title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .forEach((word: string) => keywords.add(word));
    }
    if (screenshot.description) {
      screenshot.description
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .forEach((word: string) => keywords.add(word));
    }
  });

  return Array.from(keywords);
}

/**
 * Generate keyword research queries for web search
 * Uses app features and screenshots to create more targeted queries
 */
export function generateKeywordResearchQueries(args: {
  currentKeywords: string[];
  category: string | undefined;
  title: string | undefined;
  locale: string;
  features?: Array<{ title?: string; body?: string }>;
  screenshots?: Array<{ title?: string; description?: string }>;
}): string[] {
  const { currentKeywords, category, title, features = [], screenshots = [] } = args;
  const queries: string[] = [];

  // Category-based searches
  if (category) {
    const categoryName = category.toLowerCase().replace(/_/g, " ");
    queries.push(`ASO keywords ${categoryName} app store optimization`);
    queries.push(`best keywords for ${categoryName} apps`);
    queries.push(`top ${categoryName} apps keywords`);
  }

  // Title-based searches
  if (title) {
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    titleWords.forEach((word) => {
      queries.push(`${word} app keywords ASO`);
    });
  }

  // Feature-based searches (extract key terms from features)
  const featureTerms = new Set<string>();
  features.forEach((feature) => {
    if (feature.title) {
      const words = feature.title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4);
      words.forEach((word) => featureTerms.add(word));
    }
  });
  Array.from(featureTerms).slice(0, 3).forEach((term) => {
    queries.push(`${term} app store keywords`);
  });

  // Screenshot-based searches (extract key terms from screenshots)
  const screenshotTerms = new Set<string>();
  screenshots.forEach((screenshot) => {
    if (screenshot.title) {
      const words = screenshot.title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4);
      words.forEach((word) => screenshotTerms.add(word));
    }
  });
  Array.from(screenshotTerms).slice(0, 3).forEach((term) => {
    queries.push(`${term} app keywords`);
  });

  // Current keywords research
  currentKeywords.slice(0, 5).forEach((keyword) => {
    if (keyword.length > 3) {
      queries.push(`${keyword} app store keywords`);
    }
  });

  return queries;
}

