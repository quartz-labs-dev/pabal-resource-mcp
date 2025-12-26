/**
 * MCP Tools Index
 *
 * Central registry for all MCP tools. Each tool exports:
 * - Tool definition (name, description, inputSchema)
 * - Input schema (Zod schema)
 * - Handler function
 */

// ASO Tools
import {
  asoToPublicTool,
  asoToPublicInputSchema,
  handleAsoToPublic,
} from "./aso/pull.js";
import {
  publicToAsoTool,
  publicToAsoInputSchema,
  handlePublicToAso,
} from "./aso/push.js";
import {
  improvePublicTool,
  improvePublicInputSchema,
  handleImprovePublic,
} from "./aso/improve.js";
import {
  validateAsoTool,
  validateAsoInputSchema,
  handleValidateAso,
} from "./aso/validate.js";
import {
  keywordResearchTool,
  keywordResearchInputSchema,
  handleKeywordResearch,
} from "./aso/keyword-research.js";

// Apps Tools
import {
  initProjectTool,
  initProjectInputSchema,
  handleInitProject,
} from "./apps/init.js";
import {
  searchAppTool,
  searchAppInputSchema,
  handleSearchApp,
} from "./apps/search.js";

// Content Tools
import {
  createBlogHtmlTool,
  createBlogHtmlInputSchema,
  handleCreateBlogHtml,
} from "./content/create-blog-html.js";
import type { z } from "zod";

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: any;
  zodSchema?: z.ZodTypeAny;
  handler: (...args: any[]) => Promise<any>;
  category?: string;
}

/**
 * All registered tools
 */
export const tools: ToolInfo[] = [
  // ASO Tools
  {
    name: asoToPublicTool.name,
    description: asoToPublicTool.description,
    inputSchema: asoToPublicTool.inputSchema,
    zodSchema: asoToPublicInputSchema,
    handler: handleAsoToPublic,
    category: "aso",
  },
  {
    name: publicToAsoTool.name,
    description: publicToAsoTool.description,
    inputSchema: publicToAsoTool.inputSchema,
    zodSchema: publicToAsoInputSchema,
    handler: handlePublicToAso,
    category: "aso",
  },
  {
    name: improvePublicTool.name,
    description: improvePublicTool.description,
    inputSchema: improvePublicTool.inputSchema,
    zodSchema: improvePublicInputSchema,
    handler: handleImprovePublic,
    category: "aso",
  },
  {
    name: validateAsoTool.name,
    description: validateAsoTool.description,
    inputSchema: validateAsoTool.inputSchema,
    zodSchema: validateAsoInputSchema,
    handler: handleValidateAso,
    category: "aso",
  },
  {
    name: keywordResearchTool.name,
    description: keywordResearchTool.description,
    inputSchema: keywordResearchTool.inputSchema,
    zodSchema: keywordResearchInputSchema,
    handler: handleKeywordResearch,
    category: "aso",
  },
  // Apps Tools
  {
    name: initProjectTool.name,
    description: initProjectTool.description,
    inputSchema: initProjectTool.inputSchema,
    zodSchema: initProjectInputSchema,
    handler: handleInitProject,
    category: "apps",
  },
  {
    name: searchAppTool.name,
    description: searchAppTool.description,
    inputSchema: searchAppTool.inputSchema,
    zodSchema: searchAppInputSchema,
    handler: handleSearchApp,
    category: "apps",
  },
  // Content Tools
  {
    name: createBlogHtmlTool.name,
    description: createBlogHtmlTool.description,
    inputSchema: createBlogHtmlTool.inputSchema,
    zodSchema: createBlogHtmlInputSchema,
    handler: handleCreateBlogHtml,
    category: "content",
  },
];

/**
 * Get all tool definitions for MCP server
 */
export function getToolDefinitions() {
  return [
    asoToPublicTool,
    publicToAsoTool,
    improvePublicTool,
    initProjectTool,
    createBlogHtmlTool,
    keywordResearchTool,
    searchAppTool,
    validateAsoTool,
  ];
}

/**
 * Get tool handler by name
 */
export function getToolHandler(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler;
}

/**
 * Get tool input schema by name
 */
export function getToolInputSchema(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.inputSchema;
}

/**
 * Get tool Zod schema by name (for validation)
 */
export function getToolZodSchema(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.zodSchema;
}

/**
 * Get all tool infos (for documentation)
 */
export function getToolInfos(): ToolInfo[] {
  return tools;
}
