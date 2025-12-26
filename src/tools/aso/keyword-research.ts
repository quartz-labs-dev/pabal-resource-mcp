import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getKeywordResearchDir } from "../../utils/config.util.js";
import {
  loadProductLocales,
  resolvePrimaryLocale,
} from "./utils/improve/load-product-locales.util.js";
import { getSupportedLocalesForSlug } from "../../utils/registered-apps.util.js";
import { handleSearchApp } from "../apps/search.js";
import type { RegisteredApp } from "../../utils/registered-apps.util.js";

const TOOL_NAME = "keyword-research";

export const keywordResearchInputSchema = z.object({
  slug: z.string().trim().describe("Product slug"),
  locale: z
    .string()
    .trim()
    .describe("Locale code (e.g., en-US, ko-KR). Used for storage under .aso/keywordResearch/products/[slug]/locales/."),
  platform: z
    .enum(["ios", "android"])
    .default("ios")
    .describe("Store to target ('ios' or 'android'). Run separately per platform."),
  country: z
    .string()
    .length(2)
    .optional()
    .describe(
      "Two-letter store country code. If omitted, derived from locale region (e.g., ko-KR -> kr), else 'us'."
    ),
  seedKeywords: z
    .array(z.string().trim())
    .default([])
    .describe("Seed keywords to start from."),
  competitorApps: z
    .array(
      z.object({
        appId: z.string().trim().describe("App ID (package name or iOS ID/bundle)"),
        platform: z.enum(["ios", "android"]),
      })
    )
    .default([])
    .describe("Known competitor apps to probe."),
  filename: z
    .string()
    .trim()
    .optional()
    .describe("Override output filename. Defaults to keyword-research-[platform]-[country].json"),
  writeTemplate: z
    .boolean()
    .default(false)
    .describe("If true, write a JSON template at the output path."),
  researchData: z
    .string()
    .trim()
    .optional()
    .describe(
      "Optional JSON string with research results (e.g., from mcp-appstore tools). If provided, saves it to the output path."
    ),
  researchDataPath: z
    .string()
    .trim()
    .optional()
    .describe(
      "Optional path to a JSON file containing research results. If set, file content is saved to the output path (preferred to avoid escape errors)."
    ),
});

export type KeywordResearchInput = z.infer<typeof keywordResearchInputSchema>;

const jsonSchema = zodToJsonSchema(keywordResearchInputSchema as any, {
  name: "KeywordResearchInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.KeywordResearchInput || jsonSchema;

export const keywordResearchTool = {
  name: TOOL_NAME,
  description: `Prep + persist keyword research ahead of improve-public using mcp-appstore outputs.

**IMPORTANT:** Always use 'search-app' tool first to resolve the exact slug before calling this tool. The user may provide an approximate name, bundleId, or packageName - search-app will find and return the correct slug. Never pass user input directly as slug.

## CRITICAL: Multi-Locale Execution Plan

**MANDATORY WORKFLOW - Complete each locale fully before moving to next:**

For EACH locale+platform combination, execute this cycle:
1. **Plan:** Call keyword-research(slug, locale, platform) with writeTemplate=false → get research plan
2. **Research:** Execute COMPLETE mcp-appstore workflow (all 16 steps) for that locale
3. **Save:** Call keyword-research again with researchData or researchDataPath → persist actual data
4. **Next:** Move to next locale+platform and repeat steps 1-3

**IMPORTANT: Research → Save → Next pattern**
- Complete ONE locale fully (research + save) before starting the next
- This prevents data loss if the session is interrupted
- Each locale's data is persisted immediately after research

**FORBIDDEN:**
- ❌ Using writeTemplate=true as final output
- ❌ Skipping secondary locales
- ❌ Researching multiple locales then saving all at once at the end
- ❌ Stopping before all locale+platform combinations are done

**REQUIRED:**
- ✅ Research locale → Save locale → Move to next (one at a time)
- ✅ Run for EVERY platform (ios AND android separately)
- ✅ Use researchData or researchDataPath to save (NOT writeTemplate)`,
  inputSchema,
};

function buildTemplate({
  slug,
  locale,
  platform,
  country,
  seedKeywords,
  competitorApps,
}: {
  slug: string;
  locale: string;
  platform: string;
  country: string;
  seedKeywords: string[];
  competitorApps: KeywordResearchInput["competitorApps"];
}) {
  const timestamp = new Date().toISOString();

  return {
    meta: {
      slug,
      locale,
      platform,
      country,
      seedKeywords,
      competitorApps,
      source: "mcp-appstore",
      updatedAt: timestamp,
    },
    plan: {
      steps: [
        "1. SETUP: Start mcp-appstore server (node server.js in external-tools/mcp-appstore).",
        "2. APP IDENTITY: get_app_details(appId) → confirm exact app name, category, current keywords, and store listing quality.",
        "3. COMPETITOR DISCOVERY: search_app(term=seed, num=15) + get_similar_apps(appId=your app, num=20) → identify 5-10 direct competitors (same category, similar size) + 3-5 aspirational competitors (top performers).",
        "4. COMPETITOR KEYWORD MINING: For top 5 competitors, run suggest_keywords_by_apps → extract keywords they rank for but you don't.",
        "5. KEYWORD EXPANSION (run ALL, num=30 each): suggest_keywords_by_seeds (your app name + core features), by_category (your primary category), by_similarity (semantic variations), by_competition (gap analysis), by_search (autocomplete/trending).",
        "6. KEYWORD SCORING: get_keyword_scores for ALL candidates (50-100 keywords) → filter by: traffic ≥10, difficulty ≤70, relevance to your app.",
        "7. REVIEW INTELLIGENCE: analyze_reviews(num=200) + fetch_reviews(num=100) on top 3 competitors → extract: user pain points, feature requests, emotional language, native phrases users actually use.",
        "8. KEYWORD CATEGORIZATION: Group into tiers - Tier1 (3-5): high traffic (≥1000), high relevance, moderate difficulty (≤50); Tier2 (5-7): medium traffic (100-1000), exact feature match; Tier3 (5-8): longtail (<100 traffic), very low difficulty (≤30), high conversion intent.",
        "9. LOCALIZATION CHECK: Verify keywords are natural in target locale - avoid direct translations, prefer native expressions found in reviews.",
        "10. GAP ANALYSIS: Compare your current keywords vs competitor keywords → identify missed opportunities and over-saturated terms to avoid.",
        "11. VALIDATION: For final 15-20 keywords, ensure each has: score data, clear user intent, natural locale fit, and specific rationale for inclusion.",
        "Keep rationale/nextActions in English by default unless you intentionally localize them."
      ],
      selectionCriteria: {
        tier1_core: "High traffic (≥1000), relevance score ≥0.8, difficulty ≤50, brand-safe",
        tier2_feature: "Medium traffic (100-1000), exact feature/benefit match, difficulty ≤60",
        tier3_longtail: "Low traffic (<100), very low difficulty (≤30), high purchase/download intent phrases",
        avoid: "Generic terms (difficulty ≥80), irrelevant categories, competitor brand names, terms with no search volume"
      },
      qualityChecks: [
        "Each keyword has traffic + difficulty scores (no gaps)",
        "Mix of 3 tiers represented (not all longtail, not all high-competition)",
        "Keywords validated against actual user language from reviews",
        "No duplicate semantic meanings (e.g., 'photo edit' and 'edit photo')",
        "Locale-appropriate phrasing verified"
      ],
      note: "Run per platform/country. Target 15-20 keywords per locale with clear tier distribution. Save ALL raw data for audit trail.",
    },
    data: {
      raw: {
        searchApp: [],
        getAppDetails: [],
        similarApps: [],
        keywordSuggestions: {
          bySeeds: [],
          byCategory: [],
          bySimilarity: [],
          byCompetition: [],
          bySearchHints: [],
          byApps: [],
        },
        keywordScores: [],
        reviewsAnalysis: [],
        reviewsRaw: [],
      },
      summary: {
        recommendedKeywords: [],
        keywordsByTier: {
          tier1_core: [],
          tier2_feature: [],
          tier3_longtail: [],
        },
        competitorInsights: {
          topCompetitors: [],
          keywordGaps: [],
          userLanguagePatterns: [],
        },
        rationale: "",
        confidence: {
          dataQuality: "",
          localeRelevance: "",
          competitivePosition: "",
        },
        nextActions: [
          "Feed tiered keywords into improve-public Stage 1 (prioritize Tier1 for title, Tier2-3 for keyword field)",
          "Monitor keyword rankings post-update",
          "Re-run research quarterly or after major competitor changes",
        ],
      },
    },
  };
}

function saveJsonFile({
  researchDir,
  fileName,
  payload,
}: {
  researchDir: string;
  fileName: string;
  payload: any;
}) {
  fs.mkdirSync(researchDir, { recursive: true });
  const outputPath = path.join(researchDir, fileName);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  return outputPath;
}

function normalizeKeywords(raw?: string[] | string): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((k) => k.trim()).filter((k) => k.length > 0);
  }
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export async function handleKeywordResearch(
  input: KeywordResearchInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const {
    slug,
    locale,
    platform = "ios",
    country,
    seedKeywords = [],
    competitorApps = [],
    filename,
    writeTemplate = false,
    researchData,
    researchDataPath,
  } = input;

  // Use search-app to find the registered app (supports partial matching)
  const searchResult = await handleSearchApp({ query: slug, store: "all" });
  const registeredApps: RegisteredApp[] = searchResult._meta?.apps || [];
  const registeredApp = registeredApps.length > 0 ? registeredApps[0] : undefined;

  const { config, locales } = loadProductLocales(slug);
  const primaryLocale = resolvePrimaryLocale(config, locales);
  const productLocales = Object.keys(locales);
  const primaryLocaleData = locales[primaryLocale];
  const { supportedLocales, path: supportedPath } =
    getSupportedLocalesForSlug(slug, platform);
  const appStoreLocales = registeredApp?.appStore?.supportedLocales || [];
  const googlePlayLocales = registeredApp?.googlePlay?.supportedLocales || [];
  const declaredPlatforms = [
    registeredApp?.appStore ? "ios" : null,
    registeredApp?.googlePlay ? "android" : null,
  ].filter(Boolean) as string[];

  // Derive auto seeds/competitors if not provided
  const autoSeeds: string[] = [];
  const autoCompetitors: KeywordResearchInput["competitorApps"] = [];

  if (primaryLocaleData?.aso?.title) {
    autoSeeds.push(primaryLocaleData.aso.title);
  }
  const parsedKeywords = normalizeKeywords(primaryLocaleData?.aso?.keywords);
  autoSeeds.push(...parsedKeywords.slice(0, 5));

  if (config?.name) autoSeeds.push(config.name);
  if (config?.tagline) autoSeeds.push(config.tagline);
  if (!config?.name && registeredApp?.name) autoSeeds.push(registeredApp.name);
  if (!primaryLocaleData?.aso?.title) {
    if (platform === "ios" && registeredApp?.appStore?.name) {
      autoSeeds.push(registeredApp.appStore.name);
    }
    if (platform === "android" && registeredApp?.googlePlay?.name) {
      autoSeeds.push(registeredApp.googlePlay.name);
    }
  }

  if (platform === "ios") {
    if (config?.appStoreAppId) {
      autoCompetitors.push({ appId: String(config.appStoreAppId), platform });
    } else if (config?.bundleId) {
      autoCompetitors.push({ appId: config.bundleId, platform });
    } else if (registeredApp?.appStore?.appId) {
      autoCompetitors.push({
        appId: String(registeredApp.appStore.appId),
        platform,
      });
    } else if (registeredApp?.appStore?.bundleId) {
      autoCompetitors.push({
        appId: registeredApp.appStore.bundleId,
        platform,
      });
    }
  } else if (platform === "android" && config?.packageName) {
    autoCompetitors.push({ appId: config.packageName, platform });
  } else if (platform === "android" && registeredApp?.googlePlay?.packageName) {
    autoCompetitors.push({
      appId: registeredApp.googlePlay.packageName,
      platform,
    });
  }

  const resolvedSeeds =
    seedKeywords.length > 0 ? seedKeywords : Array.from(new Set(autoSeeds));
  const resolvedCompetitors =
    competitorApps.length > 0 ? competitorApps : autoCompetitors;

  const resolvedCountry =
    country ||
    (locale?.includes("-") ? locale.split("-")[1].toLowerCase() : "us");

  const researchDir = path.join(
    getKeywordResearchDir(),
    "products",
    slug,
    "locales",
    locale
  );
  const defaultFileName = `keyword-research-${platform}-${resolvedCountry}.json`;
  const fileName = filename || defaultFileName;

  let outputPath = path.join(researchDir, fileName);
  let fileAction: string | undefined;

  const parseJsonWithContext = (text: string) => {
    try {
      return JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const match =
        /position (\d+)/i.exec(message) ||
        /column (\d+)/i.exec(message) ||
        /char (\d+)/i.exec(message);
      if (match) {
        const pos = Number(match[1]);
        const start = Math.max(0, pos - 40);
        const end = Math.min(text.length, pos + 40);
        const context = text.slice(start, end);
        throw new Error(
          `Failed to parse researchData JSON: ${message}\nContext around ${pos}: ${context}`
        );
      }
      throw new Error(`Failed to parse researchData JSON: ${message}`);
    }
  };

  const loadResearchDataFromPath = (p: string) => {
    if (!fs.existsSync(p)) {
      throw new Error(`researchDataPath not found: ${p}`);
    }
    const raw = fs.readFileSync(p, "utf-8");
    return parseJsonWithContext(raw);
  };

  if (writeTemplate || researchData) {
    const payload = researchData
      ? parseJsonWithContext(researchData)
      : researchDataPath
      ? loadResearchDataFromPath(researchDataPath)
      : buildTemplate({
          slug,
          locale,
          platform,
          country: resolvedCountry,
          seedKeywords: resolvedSeeds,
          competitorApps: resolvedCompetitors,
        });

    outputPath = saveJsonFile({ researchDir, fileName, payload });
    fileAction = researchData ? "Saved provided researchData" : "Wrote template";
  }

  const templatePreview = JSON.stringify(
    buildTemplate({
      slug,
      locale,
      platform,
      country: resolvedCountry,
      seedKeywords: resolvedSeeds,
      competitorApps: resolvedCompetitors,
    }),
    null,
    2
  );

  const lines: string[] = [];
  lines.push(`# Keyword research plan (${slug})`);
  lines.push(`Locale: ${locale} | Platform: ${platform} | Country: ${resolvedCountry}`);
  lines.push(`Primary locale detected: ${primaryLocale}`);
  if (declaredPlatforms.length > 0) {
    lines.push(`Supported platforms (search-app): ${declaredPlatforms.join(", ")}`);
  } else {
    lines.push("Supported platforms (search-app): none detected—update registered-apps.json");
  }
  if (appStoreLocales.length > 0) {
    lines.push(`Declared App Store locales: ${appStoreLocales.join(", ")}`);
  }
  if (googlePlayLocales.length > 0) {
    lines.push(`Declared Google Play locales: ${googlePlayLocales.join(", ")}`);
  }
  if (supportedLocales.length > 0) {
    lines.push(
      `Registered supported locales (${platform}): ${supportedLocales.join(
        ", "
      )} (source: ${supportedPath})`
    );
    if (!supportedLocales.includes(locale)) {
      lines.push(
        `WARNING: locale ${locale} not in registered supported locales. Confirm this locale or update registered-apps.json.`
      );
    }
  } else {
    lines.push(
      `Registered supported locales not found for ${platform} (checked: ${supportedPath}).`
    );
  }
  // Build complete task matrix
  const allCombinations: Array<{ loc: string; plat: string }> = [];
  const platformsToRun = declaredPlatforms.length > 0 ? declaredPlatforms : [platform];
  for (const plat of platformsToRun) {
    for (const loc of productLocales.length > 0 ? productLocales : [locale]) {
      allCombinations.push({ loc, plat });
    }
  }
  const currentIndex = allCombinations.findIndex(
    (c) => c.loc === locale && c.plat === platform
  );
  const completedCount = currentIndex >= 0 ? currentIndex : 0;
  const remainingCombinations = allCombinations.slice(currentIndex + 1);

  if (productLocales.length > 0) {
    lines.push(
      `Existing product locales (${productLocales.length}): ${productLocales.join(", ")}`
    );
  }

  // Show execution progress tracker
  lines.push("");
  lines.push("---");
  lines.push("## 🎯 EXECUTION PROGRESS TRACKER");
  lines.push("");
  lines.push(`**Total combinations to complete:** ${allCombinations.length} (${platformsToRun.length} platforms × ${productLocales.length || 1} locales)`);
  lines.push(`**Current:** ${locale} + ${platform} (${completedCount + 1}/${allCombinations.length})`);
  lines.push("");

  if (researchData || researchDataPath) {
    lines.push(`✅ SAVED: ${locale} + ${platform} - Full research data persisted`);
  } else if (writeTemplate) {
    lines.push(`⚠️ WARNING: ${locale} + ${platform} - Only template written! You MUST run full mcp-appstore research and save actual data.`);
  } else {
    lines.push(`📋 PLANNING: ${locale} + ${platform} - Research plan shown. Now execute mcp-appstore workflow.`);
  }

  if (remainingCombinations.length > 0) {
    lines.push("");
    lines.push("## ⏭️ MANDATORY NEXT STEPS");
    lines.push("");
    lines.push("**After completing current locale+platform, you MUST continue with:**");
    lines.push("");
    remainingCombinations.forEach((combo, idx) => {
      lines.push(`${idx + 1}. keyword-research(slug="${slug}", locale="${combo.loc}", platform="${combo.plat}") → full mcp-appstore workflow → save results`);
    });
    lines.push("");
    lines.push("⛔ DO NOT mark this task as complete until ALL combinations above have FULL research data (not templates).");
  } else {
    lines.push("");
    lines.push("## ✅ FINAL STEP");
    lines.push("");
    lines.push("This is the LAST locale+platform combination. After saving full research data for this one, the task is complete.");
  }
  lines.push("---");
  lines.push("");
  lines.push(
    `Seeds: ${
      resolvedSeeds.length > 0
        ? resolvedSeeds.join(", ")
        : "(none set; add seedKeywords or ensure ASO keywords/title exist)"
    }`
  );
  lines.push(
    `Competitors (from config if empty): ${
      resolvedCompetitors.length > 0
        ? resolvedCompetitors
            .map((c) => `${c.platform}:${c.appId}`)
            .join(", ")
        : "(none set; add competitorApps or set appStoreAppId/bundleId/packageName in config.json)"
    }`
  );
  lines.push("");
  lines.push("## Research Workflow (mcp-appstore)");
  lines.push("");
  lines.push("### Phase 1: Setup & Discovery");
  lines.push(
    `1) Start mcp-appstore server: node server.js (cwd: external-tools/mcp-appstore)`
  );
  lines.push(
    `2) get_app_details(appId) → confirm app identity, category, current metadata`
  );
  lines.push(
    `3) search_app(term=seed, num=15, platform=${platform}, country=${resolvedCountry}) → find direct competitors`
  );
  lines.push(
    `4) get_similar_apps(appId=your app, num=20) → discover related apps in your space`
  );
  lines.push("");
  lines.push("### Phase 2: Keyword Mining (run ALL of these)");
  lines.push(
    `5) suggest_keywords_by_apps(apps=[top 5 competitors]) → steal competitor keywords`
  );
  lines.push(
    `6) suggest_keywords_by_seeds(seeds=[app name, core features], num=30)`
  );
  lines.push(
    `7) suggest_keywords_by_category(category=your primary category, num=30)`
  );
  lines.push(
    `8) suggest_keywords_by_similarity + by_competition + by_search (num=30 each)`
  );
  lines.push("");
  lines.push("### Phase 3: Scoring & Filtering");
  lines.push(
    `9) get_keyword_scores for ALL candidates (50-100 keywords) → get traffic & difficulty`
  );
  lines.push(
    `10) Filter: traffic ≥10, difficulty ≤70, relevant to your app's core value`
  );
  lines.push("");
  lines.push("### Phase 4: User Language Intelligence");
  lines.push(
    `11) analyze_reviews(appId=top 3 competitors, num=200) → sentiment & themes`
  );
  lines.push(
    `12) fetch_reviews(appId=top 3 competitors, num=100) → extract exact phrases users say`
  );
  lines.push(
    `13) Cross-reference keywords with review language → validate natural phrasing`
  );
  lines.push("");
  lines.push("### Phase 5: Final Selection");
  lines.push(
    `14) Categorize into tiers: Tier1 (3-5 high-traffic core), Tier2 (5-7 feature-match), Tier3 (5-8 longtail)`
  );
  lines.push(
    `15) Validate each keyword has: score, intent, locale fit, inclusion rationale`
  );
  lines.push(
    `16) Save to: ${outputPath}`
  );
  lines.push("");
  lines.push("### Quality Checklist");
  lines.push("- [ ] 15-20 keywords with complete score data");
  lines.push("- [ ] All 3 tiers represented (not just longtail)");
  lines.push("- [ ] Keywords validated against actual review language");
  lines.push("- [ ] No semantic duplicates");
  lines.push("- [ ] Locale-appropriate (not direct translations)");
  if (fileAction) {
    lines.push(`File: ${fileAction} at ${outputPath}`);
    if (writeTemplate && !researchData && !researchDataPath) {
      lines.push(
        "⚠️ Template is a placeholder—replace with FULL mcp-appstore research results for this locale (no template-only coverage)."
      );
    }
  } else {
    lines.push(
      `Tip: set writeTemplate=true to create the JSON skeleton at ${outputPath} (still run full research per locale)`
    );
  }
  lines.push("");
  lines.push("Suggested JSON shape:");
  lines.push("```json");
  lines.push(templatePreview);
  lines.push("```");

  return {
    content: [
      {
        type: "text",
        text: lines.join("\n"),
      },
    ],
  };
}
