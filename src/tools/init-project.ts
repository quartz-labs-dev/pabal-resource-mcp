import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getPullDataDir, getProductsDir } from "../utils/config.util.js";

const listSlugDirs = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
};

/**
 * init-project MCP Tool
 *
 * Guides the initial setup: run pabal-mcp Init, then convert ASO pullData into public/products/[slug]/.
 * This is a read-only checklist generator; it does not modify files.
 */

export const initProjectInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .optional()
    .describe(
      "Optional product slug to focus on. Defaults to all slugs in .aso/pullData/products/"
    ),
});

export type InitProjectInput = z.infer<typeof initProjectInputSchema>;

const jsonSchema = zodToJsonSchema(initProjectInputSchema as any, {
  name: "InitProjectInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.InitProjectInput || jsonSchema;

export const initProjectTool = {
  name: "init-project",
  description: `Guides the initialization flow: run pabal-mcp Init, then convert ASO pullData into public/products/[slug]/.

This tool is read-only and returns a checklist. It does not call pabal-mcp directly or write files.

Steps:
1) Ensure pabal-mcp 'init' ran and .aso/pullData/products/[slug]/ exists (path from ~/.config/pabal-mcp/config.json dataDir)
2) Convert pulled ASO data -> public/products/[slug]/ using pabal-web-mcp tools (aso-to-public, public-to-aso dry run)
3) Validate outputs and next actions`,
  inputSchema,
};

export async function handleInitProject(
  input: InitProjectInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const pullDataDir = path.join(getPullDataDir(), "products");
  const publicDir = getProductsDir();

  const pullDataSlugs = listSlugDirs(pullDataDir);
  const publicSlugs = listSlugDirs(publicDir);

  const targetSlugs =
    input.slug?.length && input.slug.trim().length > 0
      ? [input.slug.trim()]
      : pullDataSlugs.length > 0
      ? pullDataSlugs
      : publicSlugs;

  const lines: string[] = [];

  lines.push("Init workflow (pabal-mcp -> pabal-web-mcp)");
  lines.push(
    `Target slugs: ${
      targetSlugs.length > 0 ? targetSlugs.join(", ") : "(none detected)"
    }`
  );
  lines.push(
    `pullData: ${
      pullDataSlugs.length > 0 ? "found" : "missing"
    } at ${pullDataDir}`
  );
  lines.push(
    `public/products: ${
      publicSlugs.length > 0 ? "found" : "missing"
    } at ${publicDir}`
  );
  lines.push("");

  if (targetSlugs.length === 0) {
    lines.push(
      "No products detected. Run pabal-mcp 'init' for your slug(s) to populate .aso/pullData/products/, then rerun this tool."
    );
    return {
      content: [
        {
          type: "text",
          text: lines.join("\n"),
        },
      ],
    };
  }

  lines.push("Step 1: Fetch raw ASO data (pabal-mcp 'init')");
  for (const slug of targetSlugs) {
    const hasPull = pullDataSlugs.includes(slug);
    lines.push(`- ${slug}: ${hasPull ? "pullData ready" : "pullData missing"}`);
  }
  lines.push(
    "Action: In pabal-mcp, run the 'init' tool for each slug above that is missing pullData."
  );
  lines.push("");

  lines.push(
    "Step 2: Convert pullData to web assets (pabal-web-mcp 'aso-to-public')"
  );
  for (const slug of targetSlugs) {
    const hasPull = pullDataSlugs.includes(slug);
    const hasPublic = publicSlugs.includes(slug);
    const pullStatus = hasPull ? "pullData ready" : "pullData missing";
    const publicStatus = hasPublic
      ? "public/products ready"
      : "public/products missing";
    lines.push(
      `- ${slug}: ${pullStatus}, ${publicStatus}${
        hasPull && !hasPublic ? " (ready to convert)" : ""
      }`
    );
  }
  lines.push(
    "Action: After pullData exists, run pabal-web-mcp 'aso-to-public' per slug to generate locale prompts. Save results to public/products/[slug]/locales/, copy screenshots, and ensure config.json/icon/og-image are in place."
  );
  lines.push("");

  lines.push("Step 3: Verify and prepare for push (optional)");
  lines.push(
    "Use pabal-web-mcp 'public-to-aso' with dryRun=true to validate structure and build pushData before uploading via store tooling."
  );
  lines.push("");

  lines.push("Notes:");
  lines.push(
    "- This tool is read-only; it does not write files or call pabal-mcp."
  );
  lines.push(
    "- Extend this init checklist as new processes are added (e.g., asset generation or validations)."
  );

  return {
    content: [
      {
        type: "text",
        text: lines.join("\n"),
      },
    ],
  };
}
