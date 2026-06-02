# Tool Registry

Generated snapshot source: `src/tools/index.ts`

This file is currently hand-maintained. If the public tool registry changes, update
this snapshot in the same change. A future CI check should generate and compare it.

## Public MCP Tools

| Category | Tool | Implementation |
| --- | --- | --- |
| aso | `aso-to-public` | `src/tools/aso/aso-to-public.ts` |
| aso | `public-to-aso` | `src/tools/aso/public-to-aso.ts` |
| aso | `improve-public` | `src/tools/aso/improve-public.ts` |
| aso | `validate-aso` | `src/tools/aso/validate-aso.ts` |
| aso | `keyword-research` | `src/tools/aso/keyword-research.ts` |
| screenshots | `translate-screenshots` | `src/tools/screenshots/translate-screenshots.ts` |
| screenshots | `resize-screenshots` | `src/tools/screenshots/resize-screenshots.ts` |
| screenshots | `phone-to-tablet` | `src/tools/screenshots/phone-to-tablet.ts` |
| app-icon | `generate-app-icons` | `src/tools/app-icon/generate-app-icons.ts` |
| app-icon | `stylize-app-icon` | `src/tools/app-icon/stylize-app-icon.ts` |
| apps | `init-project` | `src/tools/apps/init.ts` |
| apps | `search-app` | `src/tools/apps/search.ts` |
| content | `create-blog-html` | `src/tools/content/create-blog-html.ts` |

## Registry Rules

- Every public tool must be listed in the `tools` array.
- Every public tool must be returned by `getToolDefinitions()`.
- Every public tool should have a Zod schema for runtime validation.
- Tool categories should stay stable unless the public workflow changes.

