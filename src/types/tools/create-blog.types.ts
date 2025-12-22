/**
 * Types for the create-blog-html MCP tool
 */

/**
 * BlogMetaOutput for MCP tool output
 * All fields are required (resolved values)
 * Note: This is separate from blog.types.ts BlogMeta which uses UnifiedLocale
 */
export interface BlogMetaOutput {
  title: string;
  description: string;
  appSlug: string;
  slug: string;
  locale: string;
  publishedAt: string;
  modifiedAt: string;
  coverImage: string;
  tags: string[];
}

export interface CreateBlogHtmlInput {
  /**
   * Product/app slug used for paths and CTAs
   */
  appSlug: string;
  /**
   * English title used for slug creation and H1
   */
  title?: string;
  /**
   * Topic/angle to cover inside the article body
   */
  topic: string;
  /**
   * Single locale to generate (REQUIRED). Ignored when locales[] is provided.
   */
  locale: string;
  /**
   * Optional list of locales to generate. Each gets its own HTML file.
   */
  locales?: string[];
  /**
   * HTML content for the blog body. REQUIRED. The LLM must generate this based on the topic and locale.
   * Structure should follow public/en-US.html pattern.
   */
  content: string;
  /**
   * Meta description override. If absent, a locale-aware summary is generated from topic/appSlug.
   */
  description?: string;
  /**
   * Optional tags for BLOG_META. If absent, tags are derived from topic and appSlug.
   */
  tags?: string[];
  /**
   * Optional cover image. Relative paths are rewritten to /blogs/<app>/<slug>/...
   */
  coverImage?: string;
  /**
   * Include a relative image example in the body (./images/hero.png by default).
   */
  includeRelativeImageExample?: boolean;
  /**
   * Override the relative image path used when includeRelativeImageExample is true.
   */
  relativeImagePath?: string;
  /**
   * Publish date (YYYY-MM-DD). Defaults to today.
   */
  publishedAt?: string;
  /**
   * Last modified date (YYYY-MM-DD). Defaults to publishedAt.
   */
  modifiedAt?: string;
  /**
   * Overwrite existing HTML files when true (default false).
   */
  overwrite?: boolean;
}

export interface GeneratedBlogFile {
  locale: string;
  path: string;
}

export interface CreateBlogHtmlResult {
  slug: string;
  baseDir: string;
  files: GeneratedBlogFile[];
  coverImage: string;
  metaByLocale: Record<string, BlogMetaOutput>;
}
