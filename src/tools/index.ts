/**
 * MCP Tools Index
 *
 * Central registry for all MCP tools. Each tool exports:
 * - Tool definition (name, description, inputSchema)
 * - Input schema (Zod schema)
 * - Handler function
 */

import {
  asoToPublicTool,
  asoToPublicInputSchema,
  handleAsoToPublic,
} from "./aso-to-public.js";
import {
  publicToAsoTool,
  publicToAsoInputSchema,
  handlePublicToAso,
} from "./public-to-aso.js";
import {
  improvePublicTool,
  improvePublicInputSchema,
  handleImprovePublic,
} from "./improve-public.js";
import {
  initProjectTool,
  initProjectInputSchema,
  handleInitProject,
} from "./init-project.js";
import {
  createBlogHtmlTool,
  createBlogHtmlInputSchema,
  handleCreateBlogHtml,
} from "./create-blog-html.js";
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
  {
    name: asoToPublicTool.name,
    description: asoToPublicTool.description,
    inputSchema: asoToPublicTool.inputSchema,
    zodSchema: asoToPublicInputSchema,
    handler: handleAsoToPublic,
    category: "ASO Data Conversion",
  },
  {
    name: publicToAsoTool.name,
    description: publicToAsoTool.description,
    inputSchema: publicToAsoTool.inputSchema,
    zodSchema: publicToAsoInputSchema,
    handler: handlePublicToAso,
    category: "ASO Data Conversion",
  },
  {
    name: improvePublicTool.name,
    description: improvePublicTool.description,
    inputSchema: improvePublicTool.inputSchema,
    zodSchema: improvePublicInputSchema,
    handler: handleImprovePublic,
    category: "ASO Optimization",
  },
  {
    name: initProjectTool.name,
    description: initProjectTool.description,
    inputSchema: initProjectTool.inputSchema,
    zodSchema: initProjectInputSchema,
    handler: handleInitProject,
    category: "Setup",
  },
  {
    name: createBlogHtmlTool.name,
    description: createBlogHtmlTool.description,
    inputSchema: createBlogHtmlTool.inputSchema,
    zodSchema: createBlogHtmlInputSchema,
    handler: handleCreateBlogHtml,
    category: "Content",
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
