/**
 * Blog constants
 * Used for blog-related default values and configurations
 */

/**
 * App slug for personal/daily developer posts.
 */
export const DEVELOPER_JOURNAL_APP_SLUG = "developer-journal";

/**
 * App slug for technical developer posts.
 */
export const DEVELOPER_TECH_APP_SLUG = "developer-tech";

/**
 * Default app slug for developer-related blog posts.
 * New posts default to journal.
 */
export const DEFAULT_APP_SLUG = DEVELOPER_JOURNAL_APP_SLUG;

const DEVELOPER_BLOG_APP_SLUGS = new Set<string>([
  DEVELOPER_JOURNAL_APP_SLUG,
  DEVELOPER_TECH_APP_SLUG,
]);

export function isDeveloperBlogAppSlug(appSlug: string): boolean {
  return DEVELOPER_BLOG_APP_SLUGS.has(appSlug);
}
