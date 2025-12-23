import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getKeywordResearchDir } from "../utils/config.util.js";

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

Run this before improve-public. It gives a concrete MCP-powered research plan and a storage path under .aso/keywordResearch/products/[slug]/locales/[locale]/. Optionally writes a template or saves raw JSON from mcp-appstore tools.`,
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
        "Start mcp-appstore server (npm start in external-tools/mcp-appstore).",
        "Discover competitors: search_app(term=seed keyword), get_similar_apps(appId=known competitor).",
        "Collect candidates: suggest_keywords_by_seeds, suggest_keywords_by_category, suggest_keywords_by_similarity, suggest_keywords_by_competition.",
        "Score shortlist: get_keyword_scores for 15–30 candidates per platform/country.",
        "Context check: analyze_reviews on top apps for language/tone cues.",
      ],
      note: "Run per platform/country. Save raw tool outputs plus curated top keywords.",
    },
    data: {
      raw: {
        searchApp: [],
        keywordSuggestions: {
          bySeeds: [],
          byCategory: [],
          bySimilarity: [],
          byCompetition: [],
          bySearchHints: [],
        },
        keywordScores: [],
        reviewsAnalysis: [],
      },
      summary: {
        recommendedKeywords: [],
        rationale: "",
        nextActions: "Feed top 10–15 into improve-public Stage 1.",
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
  } = input;

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

  if (writeTemplate || researchData) {
    const payload = researchData
      ? (() => {
          try {
            return JSON.parse(researchData);
          } catch (err) {
            throw new Error(
              `Failed to parse researchData JSON: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        })()
      : buildTemplate({
          slug,
          locale,
          platform,
          country: resolvedCountry,
          seedKeywords,
          competitorApps,
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
      seedKeywords,
      competitorApps,
    }),
    null,
    2
  );

  const lines: string[] = [];
  lines.push(`# Keyword research plan (${slug})`);
  lines.push(`Locale: ${locale} | Platform: ${platform} | Country: ${resolvedCountry}`);
  lines.push(
    `Seeds: ${seedKeywords.length > 0 ? seedKeywords.join(", ") : "(none set)"}`
  );
  lines.push(
    `Competitors: ${
      competitorApps.length > 0
        ? competitorApps
            .map((c) => `${c.platform}:${c.appId}`)
            .join(", ")
        : "(none set)"
    }`
  );
  lines.push("");
  lines.push("How to run (uses mcp-appstore):");
  lines.push(
    `1) Start the local mcp-appstore server for this run: node server.js (cwd: /ABSOLUTE/PATH/TO/pabal-web-mcp/external-tools/mcp-appstore). LLM should start it before calling tools and stop it after, if the client supports process management; otherwise, start/stop manually.`
  );
  lines.push(
    `2) Discover apps: search_app(term=seed, platform=${platform}, country=${country}); get_similar_apps(appId=known competitor).`
  );
  lines.push(
    `3) Expand keywords: suggest_keywords_by_seeds, suggest_keywords_by_category, suggest_keywords_by_similarity, suggest_keywords_by_competition, suggest_keywords_by_search.`
  );
  lines.push(
    `4) Score shortlist: get_keyword_scores for 15–30 candidates (note: scores are heuristic per README).`
  );
  lines.push(
    `5) Context check: analyze_reviews on top apps to harvest native phrasing; keep snippets for improve-public.`
  );
  lines.push(
    `6) Save all raw responses + your final top 10–15 keywords to: ${outputPath} (structure mirrors .aso/pullData/.aso/pushData under products/<slug>/locales/<locale>)`
  );
  if (fileAction) {
    lines.push(`File: ${fileAction} at ${outputPath}`);
  } else {
    lines.push(
      `Tip: set writeTemplate=true to create the JSON skeleton at ${outputPath}`
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
