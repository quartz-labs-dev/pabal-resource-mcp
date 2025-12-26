import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  buildBlogHtmlDocument,
  buildBlogMeta,
  findExistingBlogPosts,
  getBlogOutputPaths,
  resolveTargetLocales,
  slugifyTitle,
} from "../../utils/blog.util.js";
import { getPublicDir } from "../../utils/config.util.js";
import { DEFAULT_APP_SLUG } from "../../constants/blog.constants.js";
import type {
  BlogMetaOutput,
  CreateBlogHtmlResult,
} from "../../types/tools/create-blog.types.js";

const toJsonSchema: (
  schema: z.ZodTypeAny,
  options?: Parameters<typeof zodToJsonSchema>[1]
) => ReturnType<typeof zodToJsonSchema> = zodToJsonSchema;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * create-blog-html MCP Tool
 *
 * Generates static HTML blog posts under public/blogs/<appSlug>/<slug>/<locale>.html.
 * - BLOG_META block is embedded at the top of each file
 * - coverImage defaults to /products/<appSlug>/og-image.png unless provided
 * - Relative image example (./images/hero.png) can be injected into the body
 * - Overwrite is opt-in to avoid clobbering existing posts
 */

export const createBlogHtmlInputSchema = z
  .object({
    appSlug: z
      .string()
      .trim()
      .min(1)
      .default(DEFAULT_APP_SLUG)
      .describe(
        `Product/app slug used for paths and CTAs. Defaults to "${DEFAULT_APP_SLUG}" when not provided.`
      ),
    title: z
      .string()
      .trim()
      .optional()
      .describe(
        "English title used for slug (kebab-case). Falls back to topic when omitted."
      ),
    topic: z
      .string()
      .trim()
      .min(1, "topic is required")
      .describe("Topic/angle to write about in the blog body"),
    locale: z
      .string()
      .trim()
      .min(1, "locale is required")
      .describe(
        "Primary locale (e.g., 'en-US', 'ko-KR'). Required to determine the language for blog content generation."
      ),
    locales: z
      .array(z.string().trim().min(1))
      .optional()
      .describe(
        "Optional list of locales to generate. Each locale gets its own HTML file. If provided, locale parameter is ignored."
      ),
    content: z
      .string()
      .trim()
      .min(1, "content is required")
      .describe(
        "HTML content for the blog body. You (the LLM) must generate this HTML content based on the topic and locale. Structure should follow the pattern in public/en-US.html: paragraphs (<p>), headings (<h2>, <h3>), images (<img>), lists (<ul>, <li>), horizontal rules (<hr>), etc. The content should be written in the language corresponding to the locale."
      ),
    description: z
      .string()
      .trim()
      .min(1, "description is required")
      .describe(
        "Meta description for the blog post. You (the LLM) must generate this based on the topic and locale. Should be a concise summary of the blog content in the language corresponding to the locale."
      ),
    tags: z
      .array(z.string().trim().min(1))
      .optional()
      .describe(
        "Optional tags for BLOG_META. Defaults to tags derived from topic."
      ),
    coverImage: z
      .string()
      .trim()
      .optional()
      .describe(
        "Cover image path. Relative paths rewrite to /blogs/<app>/<slug>/..., default is /products/<appSlug>/og-image.png."
      ),
    publishedAt: z
      .string()
      .trim()
      .regex(DATE_REGEX, "publishedAt must use YYYY-MM-DD")
      .optional()
      .describe("Publish date (YYYY-MM-DD). Defaults to today."),
    modifiedAt: z
      .string()
      .trim()
      .regex(DATE_REGEX, "modifiedAt must use YYYY-MM-DD")
      .optional()
      .describe("Last modified date (YYYY-MM-DD). Defaults to publishedAt."),
    overwrite: z
      .boolean()
      .optional()
      .default(false)
      .describe("Overwrite existing files when true (default: false)."),
  })
  .describe("Generate static HTML blog posts with BLOG_META headers.");

export type CreateBlogHtmlInputParsed = z.infer<
  typeof createBlogHtmlInputSchema
>;

const jsonSchema = toJsonSchema(createBlogHtmlInputSchema, {
  name: "CreateBlogHtmlInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.CreateBlogHtmlInput || jsonSchema;

export const createBlogHtmlTool = {
  name: "create-blog-html",
  description: `Generate HTML blog posts under public/blogs/<appSlug>/<slug>/<locale>.html with a BLOG_META block.

CRITICAL: WRITING STYLE CONSISTENCY
Before generating content, you MUST:
1. Read existing blog posts from public/blogs/<appSlug>/*/<locale>.html (use findExistingBlogPosts utility or read files directly)
2. Analyze the writing style, tone, and format from 2 existing posts in the same locale
3. Match that exact writing style when generating the new blog post content and description
4. Maintain consistency in: paragraph structure, heading usage, tone, formality level, and overall format

IMPORTANT REQUIREMENTS:
1. The 'locale' parameter is REQUIRED. If the user does not provide a locale, you MUST ask them to specify which language/locale they want to write the blog in (e.g., 'en-US', 'ko-KR', 'ja-JP', etc.).
2. The 'content' parameter is REQUIRED. You (the LLM) must generate the HTML content based on the 'topic' and 'locale' provided by the user. The content should be written in the language corresponding to the locale AND match the writing style of existing blog posts for that locale.
3. The 'description' parameter is REQUIRED. You (the LLM) must generate this based on the topic, locale, AND the writing style of existing blog posts.
4. The 'appSlug' parameter: 
   - If the user explicitly requests "developer category", "developer blog", "personal category", "my category", or similar, you MUST set appSlug to "developer".
   - If the user mentions a specific app/product, use that app's slug.
   - If not specified, defaults to "developer".

Slug rules:
- slug = slugify(English title, kebab-case ASCII)
- path: public/blogs/<appSlug>/<slug>/<locale>.html
- appSlug: Use "developer" when user requests developer/personal category. Defaults to "developer" if not specified.
- coverImage default: /products/<appSlug>/og-image.png (relative paths are rewritten under /blogs/<app>/<slug>/)
- overwrite defaults to false (throws when file exists)

HTML Structure (follows public/en-US.html pattern):
- BLOG_META block at the top with JSON metadata
- HTML body content: paragraphs (<p>), headings (<h2>, <h3>), images (<img>), lists (<ul>, <li>), horizontal rules (<hr>), etc.
- You must generate the HTML content based on the topic, making it relevant and engaging for the target locale's language, while maintaining consistency with existing blog posts.

Supports multiple locales when locales[] is provided. Each locale gets its own HTML file. For each locale, you must:
1. Read existing posts in that locale to understand the writing style
2. Generate appropriate content in that locale's language
3. Match the writing style and format of existing posts`,
  inputSchema,
};

export async function handleCreateBlogHtml(
  input: CreateBlogHtmlInputParsed
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const publicDir = getPublicDir();

  const {
    appSlug = DEFAULT_APP_SLUG,
    topic,
    title,
    description,
    tags,
    coverImage,
    publishedAt,
    modifiedAt,
    overwrite = false,
    content,
  } = input;

  if (!content || !content.trim()) {
    throw new Error(
      "Content is required. Please provide HTML content for the blog body based on the topic and locale."
    );
  }

  const resolvedTitle = (title && title.trim()) || topic.trim();
  const slug = slugifyTitle(resolvedTitle);
  const targetLocales = resolveTargetLocales(input);

  if (!targetLocales.length) {
    throw new Error(
      "Locale is required. Please specify which language/locale you want to write the blog in (e.g., 'en-US', 'ko-KR', 'ja-JP')."
    );
  }

  // Find existing blog posts for writing style reference
  const existingPostsByLocale: Record<
    string,
    Array<{ filePath: string; meta: BlogMetaOutput; body: string }>
  > = {};

  for (const locale of targetLocales) {
    const existingPosts = findExistingBlogPosts({
      appSlug,
      locale,
      publicDir,
      limit: 2,
    });
    if (existingPosts.length > 0) {
      existingPostsByLocale[locale] = existingPosts;
    }
  }

  const output: CreateBlogHtmlResult = {
    slug,
    baseDir: path.join(publicDir, "blogs", appSlug, slug),
    files: [],
    coverImage:
      coverImage && coverImage.trim().length > 0
        ? coverImage.trim()
        : `/products/${appSlug}/og-image.png`,
    metaByLocale: {},
  };

  // Check for existing files before writing to avoid partial writes
  const plannedFiles = targetLocales.map((locale) =>
    getBlogOutputPaths({
      appSlug,
      slug,
      locale,
      publicDir,
    })
  );

  const existing = plannedFiles.filter(({ filePath }) =>
    fs.existsSync(filePath)
  );
  if (existing.length > 0 && !overwrite) {
    const existingList = existing.map((f) => f.filePath).join("\n- ");
    throw new Error(
      `Blog HTML already exists. Set overwrite=true to replace:\n- ${existingList}`
    );
  }

  fs.mkdirSync(output.baseDir, { recursive: true });

  for (const locale of targetLocales) {
    const { filePath } = getBlogOutputPaths({
      appSlug,
      slug,
      locale,
      publicDir,
    });

    const meta: BlogMetaOutput = buildBlogMeta({
      title: resolvedTitle,
      description,
      appSlug,
      slug,
      locale,
      topic,
      coverImage,
      tags,
      publishedAt,
      modifiedAt,
    });

    output.coverImage = meta.coverImage;
    output.metaByLocale[locale] = meta;

    const html = buildBlogHtmlDocument({
      meta,
      content,
    });

    fs.writeFileSync(filePath, html, "utf-8");
    output.files.push({ locale, path: filePath });
  }

  const summaryLines = [
    `Created blog HTML for ${appSlug}`,
    `Slug: ${slug}`,
    `Locales: ${targetLocales.join(", ")}`,
    `Cover image: ${output.coverImage}`,
    "",
    "Files:",
    ...output.files.map((file) => `- ${file.locale}: ${file.path}`),
  ];

  // Include information about existing posts used for style reference
  const styleReferenceInfo: string[] = [];
  for (const [locale, posts] of Object.entries(existingPostsByLocale)) {
    if (posts.length > 0) {
      styleReferenceInfo.push(
        `\nWriting style reference for ${locale}: Found ${posts.length} existing post(s) used for style consistency.`
      );
    }
  }

  if (styleReferenceInfo.length === 0) {
    styleReferenceInfo.push(
      "\nNote: No existing blog posts found for style reference. This is the first post for this app/locale combination."
    );
  }

  return {
    content: [
      {
        type: "text",
        text: summaryLines.join("\n") + styleReferenceInfo.join(""),
      },
    ],
  };
}
