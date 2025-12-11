import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  buildBlogHtmlDocument,
  buildBlogMeta,
  getBlogOutputPaths,
  resolveRelativeImagePath,
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
      .optional()
      .default("en-US")
      .describe(
        "Primary locale (default en-US). Ignored when locales[] is set."
      ),
    locales: z
      .array(z.string().trim().min(1))
      .optional()
      .describe(
        "Optional list of locales to generate. Each locale gets its own HTML file."
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
    includeRelativeImageExample: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Inject a relative image example (./images/hero.png) into the body to demonstrate path rewriting."
      ),
    relativeImagePath: z
      .string()
      .trim()
      .optional()
      .describe(
        "Override the relative image path (default ./images/hero.png)."
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

Slug rules:
- slug = slugify(English title, kebab-case ASCII)
- path: public/blogs/<appSlug>/<slug>/<locale>.html
- coverImage default: /products/<appSlug>/og-image.png (relative paths are rewritten under /blogs/<app>/<slug>/)
- overwrite defaults to false (throws when file exists)

Template:
- Intro connecting topic/app
- 3-4 sections (problem → solution → tips/examples) using h2/h3
- Optional relative image example (./images/hero.png)
- Conclusion + CTA linking to /products/<appSlug>

Supports multiple locales when locales[] is provided (default single locale). Content language follows locale (ko -> Korean, otherwise English).`,
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
    includeRelativeImageExample = false,
    relativeImagePath,
    publishedAt,
    modifiedAt,
    overwrite = false,
  } = input;

  const resolvedTitle = (title && title.trim()) || topic.trim();
  const slug = slugifyTitle(resolvedTitle);
  const targetLocales = resolveTargetLocales(input);

  if (!targetLocales.length) {
    throw new Error("At least one locale is required to generate blog HTML.");
  }

  const shouldIncludeRelativeImage =
    includeRelativeImageExample || Boolean(relativeImagePath);

  const relativeImage = shouldIncludeRelativeImage
    ? resolveRelativeImagePath(appSlug, slug, relativeImagePath)
    : undefined;

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
      topic,
      appSlug,
      includeRelativeImageExample: shouldIncludeRelativeImage,
      relativeImagePath: relativeImage,
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
