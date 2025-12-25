import fs from "node:fs";
import path from "node:path";
import { getKeywordResearchDir } from "../../../utils/config.util.js";

export interface KeywordResearchEntry {
  filePath: string;
  data: any;
}

interface RecommendedKeyword {
  keyword: string;
  tier: string;
  difficulty: number;
  traffic: number;
  rationale: string;
}

function extractRecommended(data: any): RecommendedKeyword[] {
  const summary = data?.summary || data?.data?.summary;
  const recommended = summary?.recommendedKeywords;
  if (Array.isArray(recommended)) {
    return recommended
      .map((item: any) => {
        if (typeof item === "object" && item?.keyword) {
          return {
            keyword: String(item.keyword),
            tier: String(item.tier || ""),
            difficulty: Number(item.difficulty) || 0,
            traffic: Number(item.traffic) || 0,
            rationale: String(item.rationale || ""),
          };
        }
        if (typeof item === "string") {
          return { keyword: item, tier: "", difficulty: 0, traffic: 0, rationale: "" };
        }
        return null;
      })
      .filter((item): item is RecommendedKeyword => item !== null);
  }
  return [];
}

function extractKeywordsByTier(data: any): {
  tier1_core: string[];
  tier2_feature: string[];
  tier3_longtail: string[];
} {
  const summary = data?.summary || data?.data?.summary;
  const byTier = summary?.keywordsByTier || {};
  const extractKeywords = (tier: any[]): string[] =>
    Array.isArray(tier)
      ? tier.map((k) => (typeof k === "object" ? k.keyword : String(k))).filter(Boolean)
      : [];
  return {
    tier1_core: extractKeywords(byTier.tier1_core),
    tier2_feature: extractKeywords(byTier.tier2_feature),
    tier3_longtail: extractKeywords(byTier.tier3_longtail),
  };
}

function extractRationale(data: any): string {
  const summary = data?.summary || data?.data?.summary;
  return summary?.rationale || "";
}

function extractCompetitorInsights(data: any): {
  keywordGaps: string[];
  userLanguagePatterns: string[];
} {
  const summary = data?.summary || data?.data?.summary;
  const insights = summary?.competitorInsights || {};
  return {
    keywordGaps: Array.isArray(insights.keywordGaps) ? insights.keywordGaps : [],
    userLanguagePatterns: Array.isArray(insights.userLanguagePatterns)
      ? insights.userLanguagePatterns
      : [],
  };
}

function extractMeta(data: any): {
  platform?: string;
  country?: string;
  seedKeywords?: string[];
  competitorApps?: { appId?: string; platform?: string }[];
} {
  const meta = data?.meta || data?.data?.meta || {};
  return {
    platform: meta.platform,
    country: meta.country,
    seedKeywords: Array.isArray(meta.seedKeywords)
      ? meta.seedKeywords.map(String)
      : undefined,
    competitorApps: Array.isArray(meta.competitorApps)
      ? meta.competitorApps
      : undefined,
  };
}

function formatEntry(entry: KeywordResearchEntry): string {
  const { filePath, data } = entry;
  const recommended = extractRecommended(data);
  const meta = extractMeta(data);
  const byTier = extractKeywordsByTier(data);
  const rationale = extractRationale(data);
  const insights = extractCompetitorInsights(data);

  if (data?.parseError) {
    return `File: ${filePath}\nParse error: ${data.parseError}\n----`;
  }

  const lines: string[] = [];
  lines.push(`### File: ${filePath}`);
  if (meta.platform || meta.country) {
    lines.push(
      `Platform: ${meta.platform || "unknown"} | Country: ${
        meta.country || "unknown"
      }`
    );
  }

  // Keywords by tier (priority order for ASO optimization)
  if (byTier.tier1_core.length > 0) {
    lines.push(`\n**Tier 1 (Core - use in title/subtitle):** ${byTier.tier1_core.join(", ")}`);
  }
  if (byTier.tier2_feature.length > 0) {
    lines.push(`**Tier 2 (Feature - use in keywords field/descriptions):** ${byTier.tier2_feature.join(", ")}`);
  }
  if (byTier.tier3_longtail.length > 0) {
    lines.push(`**Tier 3 (Longtail - use in intro/outro/features):** ${byTier.tier3_longtail.join(", ")}`);
  }

  // Detailed keyword data with scores
  if (recommended.length > 0) {
    lines.push(`\n**Keyword Details (${recommended.length} keywords):**`);
    recommended.forEach((kw, idx) => {
      const tierLabel = kw.tier ? ` [${kw.tier}]` : "";
      const scores = kw.traffic > 0 || kw.difficulty > 0
        ? ` (traffic: ${kw.traffic.toFixed(2)}, difficulty: ${kw.difficulty.toFixed(2)})`
        : "";
      lines.push(`${idx + 1}. **${kw.keyword}**${tierLabel}${scores}`);
      if (kw.rationale) {
        lines.push(`   → ${kw.rationale}`);
      }
    });
  }

  // Strategy rationale
  if (rationale) {
    lines.push(`\n**Strategy:** ${rationale}`);
  }

  // Competitor insights
  if (insights.keywordGaps.length > 0) {
    lines.push(`\n**Keyword Gaps (opportunities):**`);
    insights.keywordGaps.forEach((gap) => lines.push(`- ${gap}`));
  }
  if (insights.userLanguagePatterns.length > 0) {
    lines.push(`\n**User Language Patterns (from reviews):**`);
    insights.userLanguagePatterns.forEach((pattern) => lines.push(`- ${pattern}`));
  }

  lines.push("\n----");
  return lines.join("\n");
}

interface MergedKeywordData {
  tier1_core: string[];
  tier2_feature: string[];
  tier3_longtail: string[];
  allKeywords: RecommendedKeyword[];
  rationale: string;
  keywordGaps: string[];
  userLanguagePatterns: string[];
  platforms: string[];
}

function getPlatformPriority(platform?: string): number {
  const normalized = (platform || "").toLowerCase();
  if (normalized === "ios") return 0;
  if (normalized === "android") return 1;
  return 2;
}

function mergeKeywordData(entries: KeywordResearchEntry[]): MergedKeywordData {
  const merged: MergedKeywordData = {
    tier1_core: [],
    tier2_feature: [],
    tier3_longtail: [],
    allKeywords: [],
    rationale: "",
    keywordGaps: [],
    userLanguagePatterns: [],
    platforms: [],
  };

  const seenKeywords = new Set<string>();
  const seenGaps = new Set<string>();
  const seenPatterns = new Set<string>();
  const entriesByPriority = [...entries].sort((a, b) => {
    const aPriority = getPlatformPriority(extractMeta(a.data).platform);
    const bPriority = getPlatformPriority(extractMeta(b.data).platform);
    return aPriority - bPriority;
  });

  for (const entry of entriesByPriority) {
    if (entry.data?.parseError) continue;

    const meta = extractMeta(entry.data);
    if (meta.platform && !merged.platforms.includes(meta.platform)) {
      merged.platforms.push(meta.platform);
    }

    const byTier = extractKeywordsByTier(entry.data);
    byTier.tier1_core.forEach((kw) => {
      if (!seenKeywords.has(kw.toLowerCase())) {
        merged.tier1_core.push(kw);
        seenKeywords.add(kw.toLowerCase());
      }
    });
    byTier.tier2_feature.forEach((kw) => {
      if (!seenKeywords.has(kw.toLowerCase())) {
        merged.tier2_feature.push(kw);
        seenKeywords.add(kw.toLowerCase());
      }
    });
    byTier.tier3_longtail.forEach((kw) => {
      if (!seenKeywords.has(kw.toLowerCase())) {
        merged.tier3_longtail.push(kw);
        seenKeywords.add(kw.toLowerCase());
      }
    });

    const recommended = extractRecommended(entry.data);
    for (const kw of recommended) {
      if (!seenKeywords.has(kw.keyword.toLowerCase())) {
        merged.allKeywords.push(kw);
        seenKeywords.add(kw.keyword.toLowerCase());
      }
    }

    const rationale = extractRationale(entry.data);
    if (rationale && !merged.rationale) {
      merged.rationale = rationale;
    } else if (rationale && merged.rationale) {
      merged.rationale += ` | ${meta.platform}: ${rationale}`;
    }

    const insights = extractCompetitorInsights(entry.data);
    insights.keywordGaps.forEach((gap) => {
      if (!seenGaps.has(gap)) {
        merged.keywordGaps.push(gap);
        seenGaps.add(gap);
      }
    });
    insights.userLanguagePatterns.forEach((pattern) => {
      if (!seenPatterns.has(pattern)) {
        merged.userLanguagePatterns.push(pattern);
        seenPatterns.add(pattern);
      }
    });
  }

  // Sort keywords by traffic (highest first)
  merged.allKeywords.sort((a, b) => b.traffic - a.traffic);

  return merged;
}

function formatMergedData(merged: MergedKeywordData, researchDir: string): string {
  const lines: string[] = [];
  const hasIos = merged.platforms.some(
    (platform) => platform && platform.toLowerCase() === "ios"
  );
  const platformLabel =
    merged.platforms.length > 0 ? merged.platforms.join(" + ") : "Unknown";
  lines.push(
    `### Combined Keyword Research (${platformLabel})${hasIos ? " — iOS prioritized" : ""}`
  );
  lines.push(`Source: ${researchDir}`);
  lines.push(`Priority: iOS > Android > others (use Android only after iOS keywords fit character limits)`);

  if (merged.tier1_core.length > 0) {
    lines.push(`\n**Tier 1 (Core - use in title/subtitle):** ${merged.tier1_core.join(", ")}`);
  }
  if (merged.tier2_feature.length > 0) {
    lines.push(`**Tier 2 (Feature - use in keywords field/descriptions):** ${merged.tier2_feature.join(", ")}`);
  }
  if (merged.tier3_longtail.length > 0) {
    lines.push(`**Tier 3 (Longtail - use in intro/outro/features):** ${merged.tier3_longtail.join(", ")}`);
  }

  if (merged.allKeywords.length > 0) {
    lines.push(`\n**Top Keywords by Traffic (${merged.allKeywords.length} total):**`);
    merged.allKeywords.slice(0, 15).forEach((kw, idx) => {
      const tierLabel = kw.tier ? ` [${kw.tier}]` : "";
      const scores = kw.traffic > 0 || kw.difficulty > 0
        ? ` (traffic: ${kw.traffic.toFixed(2)}, difficulty: ${kw.difficulty.toFixed(2)})`
        : "";
      lines.push(`${idx + 1}. **${kw.keyword}**${tierLabel}${scores}`);
      if (kw.rationale) {
        lines.push(`   → ${kw.rationale}`);
      }
    });
  }

  if (merged.rationale) {
    lines.push(`\n**Strategy:** ${merged.rationale}`);
  }

  if (merged.keywordGaps.length > 0) {
    lines.push(`\n**Keyword Gaps (opportunities):**`);
    merged.keywordGaps.slice(0, 5).forEach((gap) => lines.push(`- ${gap}`));
  }
  if (merged.userLanguagePatterns.length > 0) {
    lines.push(`\n**User Language Patterns (from reviews):**`);
    merged.userLanguagePatterns.slice(0, 5).forEach((pattern) => lines.push(`- ${pattern}`));
  }

  lines.push("\n----");
  return lines.join("\n");
}

interface LoadKeywordResearchResult {
  entries: KeywordResearchEntry[];
  sections: string[];
  researchDir: string;
  isFallback: boolean;
  fallbackLocale?: string;
}

function loadKeywordResearchForLocaleInternal(
  slug: string,
  locale: string
): Omit<LoadKeywordResearchResult, "isFallback" | "fallbackLocale"> | null {
  const researchDir = path.join(
    getKeywordResearchDir(),
    "products",
    slug,
    "locales",
    locale
  );

  if (!fs.existsSync(researchDir)) {
    return null;
  }

  const files = fs
    .readdirSync(researchDir)
    .filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    return null;
  }

  const entries: KeywordResearchEntry[] = [];

  for (const file of files) {
    const filePath = path.join(researchDir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      entries.push({ filePath, data });
    } catch (err) {
      entries.push({
        filePath,
        data: {
          parseError:
            err instanceof Error ? err.message : "Unknown parse error",
        },
      });
    }
  }

  // Check if we have any valid entries
  const validEntries = entries.filter((e) => !e.data?.parseError);
  if (validEntries.length === 0) {
    return null;
  }

  // Merge all platform data into a single combined view
  if (validEntries.length > 1) {
    // Multiple files (e.g., ios + android) - show merged view
    const merged = mergeKeywordData(validEntries);
    const mergedSection = formatMergedData(merged, researchDir);
    return { entries, sections: [mergedSection], researchDir };
  }

  // Single file - show detailed view
  const sections = entries.map(formatEntry);
  return { entries, sections, researchDir };
}

const FALLBACK_LOCALES = ["en-US", "en"];

export function loadKeywordResearchForLocale(
  slug: string,
  locale: string
): LoadKeywordResearchResult {
  const researchDir = path.join(
    getKeywordResearchDir(),
    "products",
    slug,
    "locales",
    locale
  );

  // Try to load the locale's own keyword research
  const result = loadKeywordResearchForLocaleInternal(slug, locale);
  if (result) {
    return { ...result, isFallback: false };
  }

  // If locale-specific research not found, try fallback locales (en-US, en)
  for (const fallbackLocale of FALLBACK_LOCALES) {
    if (fallbackLocale === locale) continue;

    const fallbackResult = loadKeywordResearchForLocaleInternal(
      slug,
      fallbackLocale
    );
    if (fallbackResult) {
      // Add fallback notice to sections
      const fallbackNotice = `⚠️ **FALLBACK: Using ${fallbackLocale} keywords** - No research found for ${locale}. You MUST TRANSLATE these keywords to ${locale}.\n`;
      const sectionsWithNotice = fallbackResult.sections.map(
        (section) => fallbackNotice + section
      );
      return {
        entries: fallbackResult.entries,
        sections: sectionsWithNotice,
        researchDir: fallbackResult.researchDir,
        isFallback: true,
        fallbackLocale,
      };
    }
  }

  // No research found at all
  return { entries: [], sections: [], researchDir, isFallback: false };
}
