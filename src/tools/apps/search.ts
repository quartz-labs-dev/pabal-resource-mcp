/**
 * search-app: Search registered apps
 *
 * Search apps from registered-apps.json.
 * - Called without query: Returns all app list
 * - Called with query: Search by slug, bundleId, packageName, name
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  loadRegisteredApps,
  findRegisteredApp,
  type RegisteredApp,
} from "../../utils/registered-apps.util.js";

const TOOL_NAME = "search-app";

export const searchAppInputSchema = z.object({
  query: z
    .string()
    .trim()
    .optional()
    .describe(
      "Search term (slug, bundleId, packageName, name). Returns all apps if empty."
    ),
  store: z
    .enum(["all", "appStore", "googlePlay"])
    .default("all")
    .describe("Store filter (default: all)"),
});

export type SearchAppInput = z.infer<typeof searchAppInputSchema>;

const jsonSchema = zodToJsonSchema(searchAppInputSchema as any, {
  name: "SearchAppInput",
  $refStrategy: "none",
});

const inputSchema = jsonSchema.definitions?.SearchAppInput || jsonSchema;

export const searchAppTool = {
  name: TOOL_NAME,
  description: `Search registered apps from registered-apps.json.

- Called without query: Returns all app list
- Called with query: Search by slug, bundleId, packageName, name
- Use store filter to narrow results to appStore or googlePlay only`,
  inputSchema,
};

/**
 * Check if app matches query
 */
function matchesQuery(app: RegisteredApp, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // slug match
  if (app.slug.toLowerCase().includes(lowerQuery)) return true;

  // name match
  if (app.name?.toLowerCase().includes(lowerQuery)) return true;

  // App Store bundleId match
  if (app.appStore?.bundleId?.toLowerCase().includes(lowerQuery)) return true;

  // App Store name match
  if (app.appStore?.name?.toLowerCase().includes(lowerQuery)) return true;

  // Google Play packageName match
  if (app.googlePlay?.packageName?.toLowerCase().includes(lowerQuery))
    return true;

  // Google Play name match
  if (app.googlePlay?.name?.toLowerCase().includes(lowerQuery)) return true;

  return false;
}

/**
 * Apply store filter
 */
function filterByStore(
  apps: RegisteredApp[],
  store: "all" | "appStore" | "googlePlay"
): RegisteredApp[] {
  if (store === "all") return apps;

  return apps.filter((app) => {
    if (store === "appStore") return !!app.appStore;
    if (store === "googlePlay") return !!app.googlePlay;
    return true;
  });
}

/**
 * Format app information
 */
function formatAppInfo(app: RegisteredApp): string {
  const lines: string[] = [];

  lines.push(`📱 **${app.name || app.slug}** (\`${app.slug}\`)`);

  if (app.appStore) {
    lines.push(`   🍎 App Store: \`${app.appStore.bundleId || "N/A"}\``);
    if (app.appStore.appId) {
      lines.push(`      App ID: ${app.appStore.appId}`);
    }
    if (app.appStore.name) {
      lines.push(`      Name: ${app.appStore.name}`);
    }
  }

  if (app.googlePlay) {
    lines.push(
      `   🤖 Google Play: \`${app.googlePlay.packageName || "N/A"}\``
    );
    if (app.googlePlay.name) {
      lines.push(`      Name: ${app.googlePlay.name}`);
    }
  }

  return lines.join("\n");
}

export async function handleSearchApp(
  input: SearchAppInput
): Promise<{ content: Array<{ type: string; text: string }>; _meta?: any }> {
  const { query, store = "all" } = input;

  try {
    const { apps: allApps, path: configPath } = loadRegisteredApps();
    let results: RegisteredApp[];

    if (!query) {
      // If no query, return full list
      results = allApps;
    } else {
      // Try exact match first (by slug)
      const { app: exactMatch } = findRegisteredApp(query);

      // Also search for partial matches
      const partialMatches = allApps.filter((app) => matchesQuery(app, query));

      // Combine results: exact match first, then partial matches
      // Remove duplicates by slug
      const seenSlugs = new Set<string>();
      results = [];

      // Add exact match first if found
      if (exactMatch && !seenSlugs.has(exactMatch.slug)) {
        results.push(exactMatch);
        seenSlugs.add(exactMatch.slug);
      }

      // Add partial matches (excluding exact match if already added)
      for (const app of partialMatches) {
        if (!seenSlugs.has(app.slug)) {
          results.push(app);
          seenSlugs.add(app.slug);
        }
      }
    }

    // Apply store filter
    results = filterByStore(results, store);

    if (results.length === 0) {
      const message = query
        ? `No apps found matching "${query}".`
        : "No apps registered.";

      return {
        content: [
          {
            type: "text",
            text: `❌ ${message}

💡 Register apps in ${configPath}`,
          },
        ],
        _meta: { apps: [], count: 0, configPath },
      };
    }

    const header = query
      ? `🔍 Search results for "${query}": ${results.length} app(s)`
      : `📋 Registered app list: ${results.length} app(s)`;

    const appList = results.map(formatAppInfo).join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `${header}

${appList}

---
Config: ${configPath}`,
        },
      ],
      _meta: { apps: results, count: results.length, configPath },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `❌ App search failed: ${message}`,
        },
      ],
    };
  }
}
