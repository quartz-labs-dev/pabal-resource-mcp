import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  buildBlogHtmlDocument,
  buildBlogMeta,
  getBlogOutputPaths,
  resolveTargetLocales,
  slugifyTitle,
} from "../utils/blog.util.js";
import { getPublicDir } from "../utils/config.util.js";
import type {
  BlogMetaOutput,
  CreateBlogHtmlResult,
} from "../types/tools/create-blog.types.js";

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
      .min(1, "appSlug is required")
      .describe("Product/app slug used for paths and CTAs"),
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
      .optional()
      .describe(
        "Meta description override. If omitted, the tool generates one from appSlug/topic per locale."
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

IMPORTANT REQUIREMENTS:
1. The 'locale' parameter is REQUIRED. If the user does not provide a locale, you MUST ask them to specify which language/locale they want to write the blog in (e.g., 'en-US', 'ko-KR', 'ja-JP', etc.).
2. The 'content' parameter is REQUIRED. You (the LLM) must generate the HTML content based on the 'topic' and 'locale' provided by the user. The content should be written in the language corresponding to the locale.

Slug rules:
- slug = slugify(English title, kebab-case ASCII)
- path: public/blogs/<appSlug>/<slug>/<locale>.html
- coverImage default: /products/<appSlug>/og-image.png (relative paths are rewritten under /blogs/<app>/<slug>/)
- overwrite defaults to false (throws when file exists)

HTML Structure (follows public/en-US.html pattern):
- BLOG_META block at the top with JSON metadata
- HTML body content: paragraphs (<p>), headings (<h2>, <h3>), images (<img>), lists (<ul>, <li>), horizontal rules (<hr>), etc.
- You must generate the HTML content based on the topic, making it relevant and engaging for the target locale's language.

Supports multiple locales when locales[] is provided. Each locale gets its own HTML file. For each locale, you must generate appropriate content in that locale's language.`,
  inputSchema,
};

export async function handleCreateBlogHtml(
  input: CreateBlogHtmlInputParsed
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const publicDir = getPublicDir();

  const {
    appSlug,
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

  return {
    content: [
      {
        type: "text",
        text: summaryLines.join("\n"),
      },
    ],
  };
}
