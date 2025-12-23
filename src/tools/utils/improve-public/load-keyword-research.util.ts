import fs from "node:fs";
import path from "node:path";
import { getKeywordResearchDir } from "../../../utils/config.util.js";

export interface KeywordResearchEntry {
  filePath: string;
  data: any;
}

function extractRecommended(data: any): string[] {
  const summary = data?.summary || data?.data?.summary;
  const recommended = summary?.recommendedKeywords;
  if (Array.isArray(recommended)) {
    return recommended.map(String);
  }
  if (typeof recommended === "string") {
    return [recommended];
  }
  return [];
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

  if (data?.parseError) {
    return `File: ${filePath}\nParse error: ${data.parseError}\n----`;
  }

  const lines: string[] = [];
  lines.push(`File: ${filePath}`);
  if (meta.platform || meta.country) {
    lines.push(
      `Platform: ${meta.platform || "unknown"} | Country: ${
        meta.country || "unknown"
      }`
    );
  }
  if (meta.seedKeywords?.length) {
    lines.push(`Seeds: ${meta.seedKeywords.join(", ")}`);
  }
  if (meta.competitorApps?.length) {
    const competitors = meta.competitorApps
      .map((c) => `${c.platform || "?"}:${c.appId || "?"}`)
      .join(", ");
    lines.push(`Competitors: ${competitors}`);
  }
  if (recommended.length) {
    lines.push(`Recommended keywords (${recommended.length}): ${recommended.join(", ")}`);
  } else {
    lines.push("Recommended keywords: (not provided)");
  }
  lines.push("----");
  return lines.join("\n");
}

export function loadKeywordResearchForLocale(slug: string, locale: string): {
  entries: KeywordResearchEntry[];
  sections: string[];
  researchDir: string;
} {
  const researchDir = path.join(
    getKeywordResearchDir(),
    "products",
    slug,
    "locales",
    locale
  );

  if (!fs.existsSync(researchDir)) {
    return { entries: [], sections: [], researchDir };
  }

  const files = fs
    .readdirSync(researchDir)
    .filter((file) => file.endsWith(".json"));

  const entries: KeywordResearchEntry[] = [];

  for (const file of files) {
    const filePath = path.join(researchDir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      entries.push({ filePath, data });
    } catch (err) {
      // Skip malformed files but still surface path
      entries.push({
        filePath,
        data: {
          parseError:
            err instanceof Error ? err.message : "Unknown parse error",
        },
      });
    }
  }

  const sections = entries.map(formatEntry);
  return { entries, sections, researchDir };
}
