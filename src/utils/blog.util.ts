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

export function resolveRelativeImagePath(
  appSlug: string,
  slug: string,
  relativePath?: string
): { raw: string; absolute: string } {
  const raw = relativePath?.trim() || "./images/hero.png";
  const normalized = raw.replace(/^\.\//, "");
  return {
    raw,
    absolute: `${toPublicBlogBase(appSlug, slug)}/${normalized}`,
  };
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

function renderEnglishBody(args: {
  meta: BlogMetaOutput;
  topic: string;
  appSlug: string;
  includeRelativeImageExample?: boolean;
  relativeImagePath?: { raw: string; absolute: string };
}) {
  const {
    meta,
    topic,
    appSlug,
    includeRelativeImageExample,
    relativeImagePath,
  } = args;

  const lines: string[] = [];

  lines.push(`<h1>${meta.title}</h1>`);
  lines.push(
    `<p>${appSlug} keeps product pages and blogs aligned. This article shows how to use "${topic}" as a shared story so ASO and SEO stay in sync.</p>`
  );

  if (includeRelativeImageExample && relativeImagePath) {
    lines.push(
      `<img src="${relativeImagePath.raw}" alt="${appSlug} ${topic} cover" />`
    );
    lines.push(
      `<p>The image above is stored next to this file and resolves to <code>${relativeImagePath.absolute}</code> when published.</p>`
    );
  }

  lines.push(`<h2>Why the gap appears</h2>`);
  lines.push(
    `<p>ASO pages are tuned for storefronts while SEO posts speak to search crawlers. Teams often duplicate work, drift on messaging, and miss internal links back to /products/${appSlug}.</p>`
  );
  lines.push(`<h3>Signals that drift</h3>`);
  lines.push(
    `<p>Different headlines, mismatched screenshots, and stale dates make ranking harder. "${topic}" is a strong bridge topic because it touches both acquisition paths.</p>`
  );

  lines.push(`<h2>How to bridge with ${appSlug}</h2>`);
  lines.push(
    `<p>Start with the product story, then reuse it in blog form. Keep the same core claim, swap storefront keywords for search intent, and reference the canonical product slug.</p>`
  );
  lines.push(`<h3>Mini playbook</h3>`);
  lines.push(
    `<ul>
  <li>Reuse the app store hero claim inside the intro.</li>
  <li>Map ASO keywords to SEO phrases for the "${topic}" angle.</li>
  <li>Link feature blurbs to product screenshots and changelog notes.</li>
  <li>Close with a CTA back to <code>/products/${appSlug}</code>.</li>
</ul>`
  );

  lines.push(`<h2>Example flow to copy</h2>`);
  lines.push(
    `<p>Pick one release, outline how it helps with "${topic}", then add a short proof (metric, quote, or screenshot). Keep h2/h3 hierarchy stable so translations stay predictable.</p>`
  );

  lines.push(`<h2>Wrap up</h2>`);
  lines.push(
    `<p>${appSlug} keeps ASO and SEO talking to each other. Publish this HTML under <code>/blogs/${appSlug}/${meta.slug}/${meta.locale}.html</code> and link it from the product page so traffic flows both ways.</p>`
  );
  lines.push(
    `<p><strong>CTA:</strong> Explore the product page at <a href="/products/${appSlug}">/products/${appSlug}</a>.</p>`
  );

  return lines.join("\n\n");
}

function renderKoreanBody(args: {
  meta: BlogMetaOutput;
  topic: string;
  appSlug: string;
  includeRelativeImageExample?: boolean;
  relativeImagePath?: { raw: string; absolute: string };
}) {
  const {
    meta,
    topic,
    appSlug,
    includeRelativeImageExample,
    relativeImagePath,
  } = args;

  const lines: string[] = [];

  lines.push(`<h1>${meta.title}</h1>`);
  lines.push(
    `<p>${appSlug}는 제품 페이지와 블로그의 흐름이 끊기지 않도록 "${topic}"을 같은 이야기로 묶어냅니다. 이 글은 ASO 신호와 SEO 콘텐츠를 하나의 메시지로 연결하는 방법을 설명합니다.</p>`
  );

  if (includeRelativeImageExample && relativeImagePath) {
    lines.push(
      `<img src="${relativeImagePath.raw}" alt="${appSlug} ${topic} 표지 이미지" />`
    );
    lines.push(
      `<p>위 이미지는 글과 같은 폴더에 저장되어 퍼블리시 시 <code>${relativeImagePath.absolute}</code> 경로로 노출됩니다.</p>`
    );
  }

  lines.push(`<h2>ASO와 SEO가 갈라지는 지점</h2>`);
  lines.push(
    `<p>스토어 최적화는 전환에 집중하고, 블로그는 검색 노출을 노립니다. 같은 제품이라도 제목, 스크린샷, 날짜가 달라지면 신뢰도가 떨어지고 /products/${appSlug}로 이어지는 링크도 약해집니다.</p>`
  );
  lines.push(`<h3>흔히 놓치는 신호</h3>`);
  lines.push(
    `<p>스토어 메시지와 블로그 카피가 따로 놀거나, 출시 맥락이 빠지는 경우입니다. "${topic}" 같은 주제는 두 채널을 모두 건드리기 때문에 일관성이 더 중요합니다.</p>`
  );

  lines.push(`<h2>${appSlug}로 다리 놓기</h2>`);
  lines.push(
    `<p>제품 이야기를 먼저 정리하고 블로그 버전으로 재사용합니다. 핵심 주장과 증거는 유지하되, 검색 의도에 맞춰 키워드와 예시를 조정하고 제품 슬러그를 함께 노출합니다.</p>`
  );
  lines.push(`<h3>적용 체크리스트</h3>`);
  lines.push(
    `<ul>
  <li>스토어 헤드라인을 인트로에 재사용하고 동일한 주장으로 풀어가기</li>
  <li>"${topic}"를 위한 SEO 키워드를 ASO 키워드와 매핑하기</li>
  <li>신기능/스크린샷/변경 사항을 블로그 본문에 짧게 연결하기</li>
  <li>마지막 문단에서 <code>/products/${appSlug}</code>로 자연스러운 CTA 배치</li>
</ul>`
  );

  lines.push(`<h2>사례 흐름 예시</h2>`);
  lines.push(
    `<p>최근 릴리스를 하나 골라 "${topic}"과 어떻게 맞물리는지 설명하고, 숫자·인용·스크린샷 중 하나로 증거를 남기세요. h2/h3 구조를 고정하면 다국어 확장도 수월해집니다.</p>`
  );

  lines.push(`<h2>마무리</h2>`);
  lines.push(
    `<p>${appSlug}는 블로그와 제품 페이지가 서로 트래픽을 주고받도록 설계했습니다. 이 HTML을 <code>/blogs/${appSlug}/${meta.slug}/${meta.locale}.html</code> 위치에 저장하고 제품 상세에서 링크를 걸어두세요.</p>`
  );
  lines.push(
    `<p><strong>CTA:</strong> 제품 페이지 <a href="/products/${appSlug}">/products/${appSlug}</a>에서 더 자세히 살펴보세요.</p>`
  );

  return lines.join("\n\n");
}

export function renderBlogBody(options: {
  meta: BlogMetaOutput;
  topic: string;
  appSlug: string;
  includeRelativeImageExample?: boolean;
  relativeImagePath?: { raw: string; absolute: string };
}): string {
  if (isKoreanLocale(options.meta.locale)) {
    return renderKoreanBody(options);
  }
  return renderEnglishBody(options);
}

export function buildBlogHtmlDocument(options: {
  meta: BlogMetaOutput;
  topic: string;
  appSlug: string;
  includeRelativeImageExample?: boolean;
  relativeImagePath?: { raw: string; absolute: string };
}) {
  const metaBlock = renderBlogMetaBlock(options.meta);
  const body = renderBlogBody({
    meta: options.meta,
    topic: options.topic,
    appSlug: options.appSlug,
    includeRelativeImageExample: options.includeRelativeImageExample,
    relativeImagePath: options.relativeImagePath,
  });

  return `${metaBlock}\n${body}`;
}

export function resolveTargetLocales(
  input: CreateBlogHtmlInput,
  defaultLocale = "en-US"
): string[] {
  if (input.locales?.length) {
    const locales = input.locales.map((loc) => loc.trim()).filter(Boolean);
    return Array.from(new Set(locales));
  }
  const fallback = input.locale?.trim() || defaultLocale;
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
