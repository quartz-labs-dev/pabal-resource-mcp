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

const isKoreanLocale = (locale: string) =>
  locale.trim().toLowerCase().startsWith("ko");

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
 * Generate meta description based on locale/topic/app.
 */
export function buildDescription(
  locale: string,
  topic: string,
  appSlug: string
): string {
  if (isKoreanLocale(locale)) {
    return `${topic}를 주제로 ${appSlug}가 ASO와 SEO를 어떻게 연결하고 블로그 트래픽을 제품 페이지로 이어주는지 정리했습니다.`;
  }

  return `How ${appSlug} teams turn "${topic}" into a bridge between ASO pages and SEO blogs without losing consistency.`;
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

  return {
    title: options.title,
    description:
      options.description ||
      buildDescription(options.locale, options.topic, options.appSlug),
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
