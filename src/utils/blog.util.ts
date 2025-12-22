import fs from "node:fs";
import path from "node:path";
import type {
  BlogMetaOutput,
  CreateBlogHtmlInput,
} from "../types/tools/create-blog.types.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const BLOG_ROOT = "blogs";

const removeDiacritics = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const compact = (items?: Array<string | undefined | null>) =>
  (items || []).filter((item): item is string => Boolean(item && item.trim()));

/**
 * Convert a title into a kebab-case ASCII slug.
 */
export function slugifyTitle(title: string): string {
  const normalized = removeDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ") // drop non-ASCII
    .replace(/[_\s]+/g, "-") // spaces/underscores -> hyphen
    .replace(/-+/g, "-") // collapse hyphens
    .replace(/^-+|-+$/g, ""); // trim

  return normalized || "post";
}

/**
 * Normalize and validate a YYYY-MM-DD date string.
 */
export function normalizeDate(date?: string): string {
  if (date) {
    if (!DATE_REGEX.test(date)) {
      throw new Error(
        `Invalid date format "${date}". Use YYYY-MM-DD (e.g. 2024-09-30).`
      );
    }
    return date;
  }

  return new Date().toISOString().slice(0, 10);
}

const toPublicBlogBase = (appSlug: string, slug: string) =>
  `/${BLOG_ROOT}/${appSlug}/${slug}`;

/**
 * Resolve cover image path with default + relative path rewrite.
 */
export function resolveCoverImagePath(
  appSlug: string,
  slug: string,
  coverImage?: string
): string {
  if (!coverImage || !coverImage.trim()) {
    return `/products/${appSlug}/og-image.png`;
  }

  const cleaned = coverImage.trim();
  const relativePath = cleaned.replace(/^\.\//, "");

  // Treat ./foo or foo/bar as relative to /blogs/<app>/<slug>/
  if (!cleaned.startsWith("/") && !/^https?:\/\//.test(cleaned)) {
    return `${toPublicBlogBase(appSlug, slug)}/${relativePath}`;
  }

  if (cleaned.startsWith("./")) {
    return `${toPublicBlogBase(appSlug, slug)}/${relativePath}`;
  }

  return cleaned;
}

/**
 * Derive a minimal tag list from topic/appSlug when user does not pass tags.
 */
export function deriveTags(topic: string, appSlug: string): string[] {
  const topicParts = topic
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean)
    .slice(0, 6);

  const set = new Set<string>([...topicParts, appSlug.toLowerCase(), "blog"]);
  return Array.from(set);
}

export function buildBlogMeta(options: {
  title: string;
  description?: string;
  appSlug: string;
  slug: string;
  locale: string;
  topic: string;
  coverImage?: string;
  tags?: string[];
  publishedAt?: string;
  modifiedAt?: string;
}): BlogMetaOutput {
  const publishedAt = normalizeDate(options.publishedAt);
  const modifiedAt = normalizeDate(options.modifiedAt || publishedAt);

  const coverImage = resolveCoverImagePath(
    options.appSlug,
    options.slug,
    options.coverImage
  );

  if (!options.description || !options.description.trim()) {
    throw new Error(
      "Description is required. The LLM must generate a meta description based on the topic and locale."
    );
  }

  return {
    title: options.title,
    description: options.description.trim(),
    appSlug: options.appSlug,
    slug: options.slug,
    locale: options.locale,
    publishedAt,
    modifiedAt,
    coverImage,
    tags: compact(options.tags)?.length
      ? Array.from(
          new Set(compact(options.tags).map((tag) => tag.toLowerCase()))
        )
      : deriveTags(options.topic, options.appSlug),
  };
}

export function renderBlogMetaBlock(meta: BlogMetaOutput): string {
  const serialized = JSON.stringify(meta, null, 2);
  return `<!--BLOG_META\n${serialized}\n-->`;
}

/**
 * Build complete HTML document with BLOG_META block and body content.
 *
 * Structure follows public/en-US.html:
 * - BLOG_META block at the top
 * - HTML body content (paragraphs, headings, images, lists, etc.)
 *
 * The content must be provided by the LLM based on the topic and locale.
 */
export function buildBlogHtmlDocument(options: {
  meta: BlogMetaOutput;
  content: string;
}) {
  const metaBlock = renderBlogMetaBlock(options.meta);
  const body = options.content.trim();

  return `${metaBlock}\n${body}`;
}

/**
 * Resolve target locales from input.
 *
 * If locales[] is provided, use it (ignoring locale parameter).
 * Otherwise, use locale parameter (which is now required).
 * Returns empty array if no valid locale is found.
 */
export function resolveTargetLocales(input: CreateBlogHtmlInput): string[] {
  if (input.locales?.length) {
    const locales = input.locales.map((loc) => loc.trim()).filter(Boolean);
    return Array.from(new Set(locales));
  }
  const fallback = input.locale?.trim();
  return fallback ? [fallback] : [];
}

export function getBlogOutputPaths(options: {
  appSlug: string;
  slug: string;
  locale: string;
  publicDir: string;
}) {
  const baseDir = path.join(
    options.publicDir,
    BLOG_ROOT,
    options.appSlug,
    options.slug
  );
  const filePath = path.join(baseDir, `${options.locale}.html`);
  const publicBasePath = toPublicBlogBase(options.appSlug, options.slug);

  return { baseDir, filePath, publicBasePath };
}

/**
 * Parse BLOG_META block from HTML content.
 * Returns the meta object and the body content (without BLOG_META block).
 */
export function parseBlogHtml(htmlContent: string): {
  meta: BlogMetaOutput | null;
  body: string;
} {
  const metaBlockRegex = /<!--BLOG_META\s*\n([\s\S]*?)\n-->/;
  const match = htmlContent.match(metaBlockRegex);

  if (!match) {
    return { meta: null, body: htmlContent.trim() };
  }

  try {
    const metaJson = match[1].trim();
    const meta = JSON.parse(metaJson) as BlogMetaOutput;
    const body = htmlContent.replace(metaBlockRegex, "").trim();

    return { meta, body };
  } catch (error) {
    // If parsing fails, return the whole content as body
    return { meta: null, body: htmlContent.trim() };
  }
}

/**
 * Find existing blog posts for a given appSlug and locale.
 * Returns up to 2 blog posts sorted by publishedAt (newest first).
 */
export function findExistingBlogPosts({
  appSlug,
  locale,
  publicDir,
  limit = 2,
}: {
  appSlug: string;
  locale: string;
  publicDir: string;
  limit?: number;
}): Array<{ filePath: string; meta: BlogMetaOutput; body: string }> {
  const blogAppDir = path.join(publicDir, BLOG_ROOT, appSlug);

  if (!fs.existsSync(blogAppDir)) {
    return [];
  }

  const posts: Array<{
    filePath: string;
    meta: BlogMetaOutput;
    body: string;
    publishedAt: string;
  }> = [];

  // Scan all subdirectories in blogs/<appSlug>/
  const subdirs = fs.readdirSync(blogAppDir, { withFileTypes: true });
  for (const subdir of subdirs) {
    if (!subdir.isDirectory()) continue;

    const localeFile = path.join(blogAppDir, subdir.name, `${locale}.html`);
    if (!fs.existsSync(localeFile)) continue;

    try {
      const htmlContent = fs.readFileSync(localeFile, "utf-8");
      const { meta, body } = parseBlogHtml(htmlContent);

      if (meta && meta.locale === locale) {
        posts.push({
          filePath: localeFile,
          meta,
          body,
          publishedAt: meta.publishedAt,
        });
      }
    } catch (error) {
      // Skip files that can't be read or parsed
      continue;
    }
  }

  // Sort by publishedAt (newest first) and return up to limit
  posts.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    return dateB - dateA; // newest first
  });

  return posts.slice(0, limit).map(({ filePath, meta, body }) => ({
    filePath,
    meta,
    body,
  }));
}
