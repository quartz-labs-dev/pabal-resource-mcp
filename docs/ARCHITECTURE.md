# Architecture

This document is the agent-readable map of the codebase. It explains where behavior
lives and which boundaries matter.

## Package Shape

`pabal-resource-mcp` is an ESM TypeScript package with three public entry points:

- `src/index.ts`: Node/server-facing exports.
- `src/browser.ts`: browser-safe exports.
- `src/bin/mcp-server.ts`: stdio MCP server executable.

The package builds with `tsup` and emits `dist/` files plus TypeScript declarations.

## Runtime Flow

1. An MCP client starts `dist/bin/mcp-server.js`.
2. `src/bin/mcp-server.ts` creates an MCP `Server`.
3. `ListToolsRequestSchema` returns tool definitions from `getToolDefinitions()`.
4. `CallToolRequestSchema` resolves the tool by name.
5. The input is parsed with the tool's Zod schema.
6. The matching handler runs and returns MCP content.

The server redirects `console.log` and `console.info` to stderr. This protects stdout
because strict MCP clients expect stdout to contain only JSON-RPC protocol data.

## Tool Registry

`src/tools/index.ts` is the central registry.

Each public tool should provide:

- MCP tool definition: `name`, `description`, `inputSchema`
- Zod input schema
- Async handler
- Category in the `tools` array

The registry exports:

- `getToolDefinitions()` for MCP list-tools responses.
- `getToolHandler(name)` for call dispatch.
- `getToolInputSchema(name)` for documentation and inspection.
- `getToolZodSchema(name)` for runtime validation.
- `getToolInfos()` for generated references.

When a tool is added, update both the `tools` array and `getToolDefinitions()`.

## Source Layout

- `src/bin/`: executable entry points.
- `src/tools/`: MCP tool implementations by domain.
- `src/tools/aso/`: ASO and public product metadata conversion.
- `src/tools/screenshots/`: screenshot translation, resize, and phone-to-tablet flows.
- `src/tools/app-icon/`: icon generation and stylization.
- `src/tools/apps/`: app discovery and initialization guidance.
- `src/tools/content/`: content generation tools.
- `src/tools/**/utils/`: domain-specific helper functions.
- `src/utils/`: shared utilities used across domains.
- `src/types/`: exported and internal TypeScript interfaces.
- `src/constants/`: stable shared constants.
- `docs/`: user docs, domain rules, and agent-operational docs.
- `external-tools/`: vendored or companion tools.

## Dependency Boundaries

- Tool handlers may use Node filesystem APIs when they operate on local Pabal data.
- Browser exports must not import Node-only modules.
- Shared domain rules should live in `src/utils/`, `src/constants/`, or `src/types/`
  instead of being copied between tools.
- ASO behavior must stay aligned with `docs/aso/ASO_OVERVIEW.md` and
  `docs/aso/ASO_FIELD_LIMITS.md`.
- Generated image workflows should centralize Gemini and image resizing behavior in
  existing utility modules before adding new helper code.

## External Configuration

The runtime reads Pabal configuration from the local Pabal config path described in
the public docs. Tools that need app context should prefer existing config and
registered-app helpers instead of parsing ad hoc paths.

## Documentation Boundaries

- `README.md`: package overview and install surface.
- `docs/en-US/` and `docs/ko-KR/`: user-facing product docs.
- `docs/aso/`: ASO domain invariants.
- `docs/ARCHITECTURE.md`: codebase and dependency map.
- `docs/CONTRIBUTING_AGENTS.md`: agent workflow rules.
- `docs/QUALITY_SCORE.md`: quality state and freshness rules.
- `docs/PLANS.md`: execution planning conventions.
- `docs/design-docs/`: design decisions.
- `docs/exec-plans/`: active and completed implementation plans.
- `docs/generated/`: generated or mechanically maintained references.
- `docs/references/`: stable external references useful to agents.

