# Contributing Agents

This document describes how agents should make changes in this repository.

## Working Principles

- Read the closest relevant docs before editing.
- Prefer existing tool patterns over new abstractions.
- Keep changes scoped to the requested domain.
- Use TypeScript interfaces for object shapes where practical.
- Avoid `any` in new code unless a third-party boundary makes it unavoidable.
- Keep comments rare and useful.

## Adding an MCP Tool

Before adding a tool, inspect a similar tool in the same category.

Checklist:

1. Create the tool file under the right `src/tools/<category>/` directory.
2. Define a Zod input schema.
3. Convert the Zod schema to JSON schema for the MCP tool definition.
4. Export the MCP tool definition.
5. Export an async handler.
6. Register the tool in `src/tools/index.ts`.
7. Add the tool to both `tools` and `getToolDefinitions()`.
8. Add or update tests when behavior is non-trivial.
9. Update user docs if the tool is public.
10. Update `docs/generated/tool-registry.md` if the public tool list changes.

## Changing an Existing Tool

For behavior changes:

1. Read the tool implementation.
2. Read any domain docs referenced by `AGENTS.md`.
3. Check for shared utilities before modifying multiple tools.
4. Preserve MCP response shape unless the user requested a breaking change.
5. Run the narrowest useful validation.

For description or prompt changes:

1. Keep instructions concrete and tool-specific.
2. Avoid vague words like "improve" without acceptance criteria.
3. If the tool requires another tool first, state the dependency directly.

## ASO Changes

ASO changes must preserve the domain rules in:

- `docs/aso/ASO_OVERVIEW.md`
- `docs/aso/ASO_FIELD_LIMITS.md`

Important invariants:

- Do not duplicate search terms across title, subtitle, and keyword fields.
- Respect App Store and Google Play field limits.
- Keep keyword source priority explicit.
- Preserve locale-aware behavior.

## Screenshot and App Icon Changes

For screenshot changes, inspect:

- `src/tools/screenshots/`
- `src/tools/screenshots/utils/`
- `docs/en-US/screenshots.md`

For app icon changes, inspect:

- `src/tools/app-icon/`
- `src/tools/app-icon/utils/`
- `docs/en-US/app-icon.md`

Generated image workflows should avoid duplicating Gemini client logic.

## Server Changes

For `src/bin/mcp-server.ts` changes:

- Preserve stdout for MCP JSON-RPC only.
- Keep tool input validation before handler execution.
- Update `docs/ARCHITECTURE.md` if lifecycle or dispatch behavior changes.

## Browser Export Changes

For `src/browser.ts` changes:

- Do not export Node-only utilities.
- Keep browser-safe shared types and pure conversion helpers available.
- Re-check `package.json` browser mappings when exports change.

## Documentation Changes

User-facing docs:

- `docs/en-US/`
- `docs/ko-KR/`
- `README.md`

Agent-operational docs:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRIBUTING_AGENTS.md`
- `docs/QUALITY_SCORE.md`
- `docs/PLANS.md`
- `docs/design-docs/`
- `docs/exec-plans/`
- `docs/generated/`
- `docs/references/`

Do not bury operational rules inside locale docs.

## Test Layout

Current tests live under `tests/`.

- Unit tests: `tests/unit/`
- Existing example: `tests/unit/utils/aso-validation.test.ts`
- Test command: `swpm run test`

When adding behavior in `src/tools/**`, prefer tests that exercise the handler or the
pure utility that owns the branch. If the handler mostly orchestrates filesystem or
image-generation side effects, test the pure validation and transformation helpers
first, then add integration coverage when the side effect has meaningful failure
paths.

## Validation

Use `swpm` by preference.

- Documentation-only changes: inspect changed docs and run no build unless generated references changed.
- Type-only changes: `swpm run typecheck`.
- Tool behavior changes: `swpm run test` and `swpm run build` when practical.
- Export/package changes: `swpm run build`.

Report any validation that was skipped and why.
