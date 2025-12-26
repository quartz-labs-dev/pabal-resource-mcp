import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadAsoFromConfig } from "../../utils/aso-converter.js";
import {
  FIELD_LIMITS_DOC_PATH,
  APP_STORE_LIMITS,
  GOOGLE_PLAY_LIMITS,
  sanitizeAsoData,
  validateFieldLimits,
  validateKeywords,
  formatValidationIssues,
} from "../../utils/aso-validation.util.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../../types/aso/index.js";
import { DEFAULT_LOCALE } from "../../constants/unified-locales.js";

const toJsonSchema: (
  schema: z.ZodTypeAny,
  options?: Parameters<typeof zodToJsonSchema>[1]
) => ReturnType<typeof zodToJsonSchema> = zodToJsonSchema;

/**
 * validate-aso MCP Tool
 *
 * Validates ASO data against store field limits and rules.
 * Can be used standalone or after improve-public optimization.
 */

// Input schema
export const validateAsoInputSchema = z.object({
  slug: z.string().describe("Product slug"),
  locale: z
    .string()
    .optional()
    .describe("Specific locale to validate (default: all locales)"),
  fix: z
    .boolean()
    .optional()
    .default(false)
    .describe("Auto-fix issues where possible (e.g., remove invalid chars)"),
});

export type ValidateAsoInput = z.infer<typeof validateAsoInputSchema>;

/**
 * MCP Tool Definition
 */
const jsonSchema = toJsonSchema(validateAsoInputSchema, {
  name: "ValidateAsoInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.ValidateAsoInput || jsonSchema;

export const validateAsoTool = {
  name: "validate-aso",
  description: `Validates ASO data against App Store / Google Play field limits and rules.

**IMPORTANT:** Use 'search-app' tool first to resolve the exact slug.

## WHAT IT VALIDATES
1. **Field Length Limits** (${FIELD_LIMITS_DOC_PATH}):
   - App Store: name ≤${APP_STORE_LIMITS.name}, subtitle ≤${APP_STORE_LIMITS.subtitle}, keywords ≤${APP_STORE_LIMITS.keywords}, description ≤${APP_STORE_LIMITS.description}
   - Google Play: title ≤${GOOGLE_PLAY_LIMITS.title}, shortDescription ≤${GOOGLE_PLAY_LIMITS.shortDescription}, fullDescription ≤${GOOGLE_PLAY_LIMITS.fullDescription}

2. **Keyword Duplicates** (App Store only):
   - Checks for duplicate keywords in comma-separated list

3. **Invalid Characters**:
   - Control characters, BOM, zero-width/invisible characters, variation selectors

## WHEN TO USE
- After running improve-public Stage 1/2 to verify optimization results
- Before running public-to-aso to ensure data is valid
- Anytime you want to check ASO data validity

## OPTIONS
- \`locale\`: Validate specific locale only (e.g., "ko-KR")
- \`fix\`: Auto-fix issues where possible (removes invalid characters)`,
  inputSchema,
};

interface LocaleStats {
  locale: string;
  store: "appStore" | "googlePlay";
  fields: {
    field: string;
    length: number;
    limit: number;
    status: "ok" | "warning" | "error";
  }[];
}

function getLocaleStats(
  configData: ReturnType<typeof loadAsoFromConfig>
): LocaleStats[] {
  const stats: LocaleStats[] = [];

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    for (const [locale, data] of Object.entries(locales)) {
      const fields: LocaleStats["fields"] = [];

      const checkField = (
        field: string,
        value: string | undefined,
        limit: number
      ) => {
        const length = value?.length || 0;
        let status: "ok" | "warning" | "error" = "ok";
        if (length > limit) status = "error";
        else if (length > limit * 0.9) status = "warning";
        fields.push({ field, length, limit, status });
      };

      checkField("name", data.name, APP_STORE_LIMITS.name);
      checkField("subtitle", data.subtitle, APP_STORE_LIMITS.subtitle);
      checkField("keywords", data.keywords, APP_STORE_LIMITS.keywords);
      checkField(
        "promotionalText",
        data.promotionalText,
        APP_STORE_LIMITS.promotionalText
      );
      checkField("description", data.description, APP_STORE_LIMITS.description);

      stats.push({ locale, store: "appStore", fields });
    }
  }

  if (configData.googlePlay) {
    const googlePlayData = configData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : { [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData };

    for (const [locale, data] of Object.entries(locales)) {
      const fields: LocaleStats["fields"] = [];

      const checkField = (
        field: string,
        value: string | undefined,
        limit: number
      ) => {
        const length = value?.length || 0;
        let status: "ok" | "warning" | "error" = "ok";
        if (length > limit) status = "error";
        else if (length > limit * 0.9) status = "warning";
        fields.push({ field, length, limit, status });
      };

      checkField("title", data.title, GOOGLE_PLAY_LIMITS.title);
      checkField(
        "shortDescription",
        data.shortDescription,
        GOOGLE_PLAY_LIMITS.shortDescription
      );
      checkField(
        "fullDescription",
        data.fullDescription,
        GOOGLE_PLAY_LIMITS.fullDescription
      );

      stats.push({ locale, store: "googlePlay", fields });
    }
  }

  return stats;
}

function formatStats(stats: LocaleStats[], filterLocale?: string): string {
  const filteredStats = filterLocale
    ? stats.filter((s) => s.locale === filterLocale)
    : stats;

  if (filteredStats.length === 0) {
    return filterLocale
      ? `No data found for locale: ${filterLocale}`
      : "No ASO data found";
  }

  const lines: string[] = ["## Field Length Report\n"];

  for (const stat of filteredStats) {
    const storeLabel = stat.store === "appStore" ? "App Store" : "Google Play";
    lines.push(`### ${storeLabel} [${stat.locale}]\n`);
    lines.push("| Field | Length | Limit | Status |");
    lines.push("|-------|--------|-------|--------|");

    for (const field of stat.fields) {
      const statusEmoji =
        field.status === "error"
          ? "❌"
          : field.status === "warning"
          ? "⚠️"
          : "✅";
      lines.push(
        `| ${field.field} | ${field.length} | ${field.limit} | ${statusEmoji} |`
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Main handler function
 */
export async function handleValidateAso(
  input: ValidateAsoInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { slug, locale, fix } = input;

  // Load ASO data
  const configData = loadAsoFromConfig(slug);

  if (!configData.googlePlay && !configData.appStore) {
    throw new Error(`No ASO data found for ${slug}`);
  }

  const results: string[] = [];
  results.push(`# ASO Validation Report: ${slug}\n`);

  // 1. Sanitize and check for invalid characters
  const { sanitizedData, warnings: sanitizeWarnings } =
    sanitizeAsoData(configData);

  if (sanitizeWarnings.length > 0) {
    results.push(`## Invalid Characters Found\n`);
    if (fix) {
      results.push(
        `The following invalid characters were ${
          fix ? "removed" : "detected"
        }:\n`
      );
    }
    for (const warning of sanitizeWarnings) {
      results.push(`- ${warning}`);
    }
    results.push("");
  }

  // 2. Validate field limits
  const dataToValidate = fix ? sanitizedData : configData;
  const limitIssues = validateFieldLimits(dataToValidate);
  const filteredIssues = locale
    ? limitIssues.filter((issue) => issue.locale === locale)
    : limitIssues;

  results.push(formatValidationIssues(filteredIssues));
  results.push("");

  // 3. Check keyword duplicates
  const keywordIssues = validateKeywords(dataToValidate);
  const filteredKeywordIssues = locale
    ? keywordIssues.filter((issue) => issue.locale === locale)
    : keywordIssues;

  if (filteredKeywordIssues.length > 0) {
    results.push(`## Keyword Duplicates\n`);
    for (const issue of filteredKeywordIssues) {
      results.push(`- [${issue.locale}]: ${issue.duplicates.join(", ")}`);
    }
    results.push("");
  }

  // 4. Field length stats (detailed view)
  const stats = getLocaleStats(dataToValidate);
  results.push(formatStats(stats, locale));

  // 5. Summary
  const hasErrors =
    filteredIssues.length > 0 || filteredKeywordIssues.length > 0;
  const hasSanitizeWarnings = sanitizeWarnings.length > 0;

  results.push(`---\n`);
  if (hasErrors) {
    results.push(
      `❌ **Validation failed** - Fix the issues above before pushing to stores.`
    );
    results.push(`\nReference: ${FIELD_LIMITS_DOC_PATH}`);
  } else if (hasSanitizeWarnings && !fix) {
    results.push(
      `⚠️ **Invalid characters detected** - Run with \`fix: true\` to auto-remove.`
    );
  } else {
    results.push(`✅ **Validation passed** - Ready to push to stores.`);
  }

  return {
    content: [
      {
        type: "text",
        text: results.join("\n"),
      },
    ],
  };
}

