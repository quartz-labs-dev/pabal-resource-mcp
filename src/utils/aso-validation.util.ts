import type { AsoData } from "../types/aso/index.js";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
} from "../types/aso/index.js";
import { DEFAULT_LOCALE } from "../constants/unified-locales.js";

export const FIELD_LIMITS_DOC_PATH = "docs/aso/ASO_FIELD_LIMITS.md";

export const APP_STORE_LIMITS = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  promotionalText: 170,
  description: 4000,
  whatsNew: 4000,
} as const;

export const GOOGLE_PLAY_LIMITS = {
  title: 50,
  shortDescription: 80,
  fullDescription: 4000,
  releaseNotes: 500,
} as const;

// Control + BOM + zero-width/invisible/variation selectors
const INVALID_CHAR_REGEX =
  /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\uFEFF\u200B-\u200F\u202A-\u202E\u2060\uFE00-\uFE0F]/g;

export interface ValidationIssue {
  locale: string;
  store: "appStore" | "googlePlay";
  field: string;
  currentLength: number;
  limit: number;
  severity: "error" | "warning";
}

export interface SanitizeResult {
  sanitizedData: AsoData;
  warnings: string[];
}

/**
 * Sanitize text by removing invalid characters
 */
export function sanitizeText(
  value: string | undefined,
  fieldPath: string,
  warnings: string[]
): string | undefined {
  if (typeof value !== "string") return value;

  const cleaned = value.replace(INVALID_CHAR_REGEX, "");
  if (cleaned !== value) {
    warnings.push(`Removed invalid characters from ${fieldPath}`);
  }
  return cleaned;
}

/**
 * Sanitize all ASO data fields
 */
export function sanitizeAsoData(configData: AsoData): SanitizeResult {
  const sanitizedData: AsoData = JSON.parse(JSON.stringify(configData));
  const warnings: string[] = [];

  if (sanitizedData.appStore) {
    const appStoreData = sanitizedData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    for (const [locale, data] of Object.entries(locales)) {
      data.name = sanitizeText(
        data.name,
        `App Store [${locale}].name`,
        warnings
      )!;
      data.subtitle = sanitizeText(
        data.subtitle,
        `App Store [${locale}].subtitle`,
        warnings
      );
      data.keywords = sanitizeText(
        data.keywords,
        `App Store [${locale}].keywords`,
        warnings
      );
      data.promotionalText = sanitizeText(
        data.promotionalText,
        `App Store [${locale}].promotionalText`,
        warnings
      );
      data.description = sanitizeText(
        data.description,
        `App Store [${locale}].description`,
        warnings
      )!;
      data.whatsNew = sanitizeText(
        data.whatsNew,
        `App Store [${locale}].whatsNew`,
        warnings
      );
    }
  }

  if (sanitizedData.googlePlay) {
    const googlePlayData = sanitizedData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };

    for (const [locale, data] of Object.entries(locales)) {
      data.title = sanitizeText(
        data.title,
        `Google Play [${locale}].title`,
        warnings
      )!;
      data.shortDescription = sanitizeText(
        data.shortDescription,
        `Google Play [${locale}].shortDescription`,
        warnings
      )!;
      data.fullDescription = sanitizeText(
        data.fullDescription,
        `Google Play [${locale}].fullDescription`,
        warnings
      )!;
    }
  }

  return { sanitizedData, warnings };
}

/**
 * Validate field lengths against store limits
 */
export function validateFieldLimits(configData: AsoData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    for (const [locale, data] of Object.entries(locales)) {
      const checkField = (
        field: keyof typeof APP_STORE_LIMITS,
        value: string | undefined
      ) => {
        if (
          typeof value === "string" &&
          value.length > APP_STORE_LIMITS[field]
        ) {
          issues.push({
            locale,
            store: "appStore",
            field,
            currentLength: value.length,
            limit: APP_STORE_LIMITS[field],
            severity: "error",
          });
        }
      };

      checkField("name", data.name);
      checkField("subtitle", data.subtitle);
      checkField("keywords", data.keywords);
      checkField("promotionalText", data.promotionalText);
      checkField("description", data.description);
      checkField("whatsNew", data.whatsNew);
    }
  }

  if (configData.googlePlay) {
    const googlePlayData = configData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : {
          [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData,
        };

    for (const [locale, data] of Object.entries(locales)) {
      const checkField = (
        field: keyof typeof GOOGLE_PLAY_LIMITS,
        value: string | undefined
      ) => {
        if (
          typeof value === "string" &&
          value.length > GOOGLE_PLAY_LIMITS[field]
        ) {
          issues.push({
            locale,
            store: "googlePlay",
            field,
            currentLength: value.length,
            limit: GOOGLE_PLAY_LIMITS[field],
            severity: "error",
          });
        }
      };

      checkField("title", data.title);
      checkField("shortDescription", data.shortDescription);
      checkField("fullDescription", data.fullDescription);
    }
  }

  return issues;
}

/**
 * Format validation issues as a human-readable string
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return `✅ All fields within limits (checked against ${FIELD_LIMITS_DOC_PATH})`;
  }

  const grouped: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    const key = `${issue.store} [${issue.locale}]`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(issue);
  }

  const lines: string[] = [
    `⚠️ Field limit violations (see ${FIELD_LIMITS_DOC_PATH}):`,
  ];

  for (const [key, localeIssues] of Object.entries(grouped)) {
    lines.push(`\n${key}:`);
    for (const issue of localeIssues) {
      const over = issue.currentLength - issue.limit;
      lines.push(
        `  - ${issue.field}: ${issue.currentLength}/${issue.limit} (${over} over)`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Check for duplicate keywords in App Store keywords field
 */
export function checkKeywordDuplicates(keywords: string): {
  hasDuplicates: boolean;
  duplicates: string[];
  uniqueKeywords: string[];
} {
  const keywordList = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const uniqueKeywords: string[] = [];

  for (const keyword of keywordList) {
    if (seen.has(keyword)) {
      if (!duplicates.includes(keyword)) {
        duplicates.push(keyword);
      }
    } else {
      seen.add(keyword);
      uniqueKeywords.push(keyword);
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
    uniqueKeywords,
  };
}

/**
 * Validate keywords field for duplicates
 */
export function validateKeywords(configData: AsoData): {
  locale: string;
  duplicates: string[];
}[] {
  const issues: { locale: string; duplicates: string[] }[] = [];

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    for (const [locale, data] of Object.entries(locales)) {
      if (data.keywords) {
        const result = checkKeywordDuplicates(data.keywords);
        if (result.hasDuplicates) {
          issues.push({ locale, duplicates: result.duplicates });
        }
      }
    }
  }

  return issues;
}





