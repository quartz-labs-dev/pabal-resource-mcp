#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getToolDefinitions,
  getToolHandler,
  getToolZodSchema,
} from "../tools/index.js";

/**
 * pabal-resource-mcp Server
 *
 * MCP server for ASO data management
 * Tools: aso-to-public, public-to-aso, improve-public, init-project, create-blog-html
 */

const server = new Server(
  {
    name: "pabal-resource-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Provide tool list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: getToolDefinitions(),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const zodSchema = getToolZodSchema(name);
  const handler = getToolHandler(name);

  // Validate and parse input using Zod schema
  if (!zodSchema) {
    throw new Error(`No schema found for tool: ${name}`);
  }
  const input = zodSchema.parse(args);

  return await handler(input);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("pabal-resource-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
