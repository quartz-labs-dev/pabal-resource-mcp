import type { UnifiedLocale } from "../constants/unified-locales.js";

/**
 * Blog type definitions
 * Used by both MCP tools and web application
 */

/**
 * Blog Meta Block (raw from HTML comment)
 * All fields are optional as they may be parsed from HTML or defaults
 */
export interface BlogMetaBlock {
  title: string;
  description: string;
  appSlug: string;
  slug: string;
  locale?: string;
  coverImage?: string;
  publishedAt?: string;
  modifiedAt?: string;
  tags?: string[];
}

/**
 * Blog Meta (resolved with UnifiedLocale)
 * Used by web application after normalization
 */
export interface BlogMeta extends BlogMetaBlock {
  locale: UnifiedLocale;
  coverImage?: string;
  publishedAt?: string;
  modifiedAt?: string;
}

/**
 * Blog Article (complete parsed article with HTML content)
 */
export interface BlogArticle {
  appSlug: string;
  slug: string;
  locale: UnifiedLocale;
  html: string;
  meta: BlogMeta;
  filePath: string;
}

/**
 * Blog Summary (aggregated metadata across locales)
 */
export interface BlogSummary {
  appSlug: string;
  slug: string;
  title: string;
  description: string;
  coverImage?: string;
  publishedAt?: string;
  modifiedAt?: string;
  locales: UnifiedLocale[];
  defaultLocale: UnifiedLocale;
}



