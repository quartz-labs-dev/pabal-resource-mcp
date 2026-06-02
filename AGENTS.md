# pabal-resource-mcp Agent Map

This file is the short map for agents working in this repository. Keep it brief.
Move deep rules into `docs/` and link them here.

## Repository Purpose

`pabal-resource-mcp` is a TypeScript MCP server for ASO, app resource, screenshot,
app icon, and content workflows. It exposes stdio MCP tools and shared browser-safe
types/utilities for Pabal projects.

## Start Here

- Architecture: `docs/ARCHITECTURE.md`
- Agent contribution rules: `docs/CONTRIBUTING_AGENTS.md`
- Quality and freshness checks: `docs/QUALITY_SCORE.md`
- Planning workflow: `docs/PLANS.md`
- Design history: `docs/design-docs/index.md`
- Tool registry snapshot: `docs/generated/tool-registry.md`
- ASO rules: `docs/aso/ASO_OVERVIEW.md`, `docs/aso/ASO_FIELD_LIMITS.md`

## Task Routing

- Add or change an MCP tool: read `docs/CONTRIBUTING_AGENTS.md`, then inspect a
  similar tool under `src/tools/`.
- Change server lifecycle or stdio behavior: read `docs/ARCHITECTURE.md` and
  inspect `src/bin/mcp-server.ts`.
- Change ASO conversion or validation behavior: read `docs/aso/ASO_OVERVIEW.md`
  and `docs/aso/ASO_FIELD_LIMITS.md`.
- Change screenshot behavior: inspect `src/tools/screenshots/` and
  `docs/en-US/screenshots.md`.
- Change app icon behavior: inspect `src/tools/app-icon/` and
  `docs/en-US/app-icon.md`.
- Plan large work: create or update a plan in `docs/exec-plans/active/`.
- Finish large work: write outcome notes in `docs/exec-plans/completed/`.

## Commands

Use the repository package manager available in the workspace. Prefer `swpm`.

- Build: `swpm run build`
- Typecheck: `swpm run typecheck`
- Test: `swpm run test`
- Dev server: `swpm run dev`

If `swpm` is unavailable, inspect the environment before choosing an alternative.

## Non-negotiable Rules

- Keep TypeScript precise. Avoid `any` in new code unless the SDK boundary forces it.
- Validate external inputs at boundaries with Zod or existing typed SDK contracts.
- Do not write to stdout in the MCP server except JSON-RPC protocol output.
- Keep browser exports free of Node-only runtime dependencies.
- Register every public MCP tool through `src/tools/index.ts`.
- Keep user-facing docs and agent-operational docs separate.
- Do not expand this file into a manual. Add deeper guidance under `docs/`.

## Validation Expectations

For code changes, run the narrowest useful validation:

- Type or registry changes: `swpm run typecheck`
- Runtime/tool changes: `swpm run test` if relevant tests exist, plus `swpm run build`
- Documentation-only changes: no build required unless generated references changed

If a validation command cannot run, report the reason.

