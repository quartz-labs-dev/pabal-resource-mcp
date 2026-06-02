# Quality Score

This document tracks current quality dimensions for agent work. It is not a badge.
It is a map of where the repo is strong, where it is thin, and what must stay fresh.

## Current Score

Overall: 7/10

This repo has a clear MCP tool registry and useful domain docs, but it is still early
in agent-operational structure. The new docs layer should raise repeatability first.

## Dimensions

| Area | Score | Notes |
| --- | ---: | --- |
| Tool registry legibility | 8 | `src/tools/index.ts` centralizes definitions, schemas, handlers, and categories. |
| Runtime boundary clarity | 7 | MCP stdio behavior is clear, but architecture docs were missing before this pass. |
| ASO domain rules | 8 | `docs/aso/` captures strong rules for keywords and field limits. |
| Public docs | 7 | Locale docs exist, but operational and user docs were mixed by implication. |
| Test discoverability | 5 | `swpm run test` is defined, but test layout and coverage expectations need more explicit docs. |
| Agent planning | 4 | Execution plans did not have a stable in-repo home before this pass. |
| Freshness enforcement | 4 | Rules are now documented, but not yet mechanically enforced. |

## Freshness Checklist

Use this when reviewing changes:

- If `src/tools/index.ts` changes, update `docs/generated/tool-registry.md`.
- If a public tool is added or renamed, update relevant public docs.
- If ASO behavior changes, update or confirm `docs/aso/`.
- If server dispatch or stdout behavior changes, update `docs/ARCHITECTURE.md`.
- If browser exports change, verify browser-safe boundaries in `package.json`.
- If an active execution plan becomes stale, move it to completed or mark it stale.
- If `AGENTS.md` grows beyond roughly 100 lines, move details into `docs/`.

## Future Mechanical Checks

Good next checks to automate:

- Compare public tool names in `src/tools/index.ts` against `docs/generated/tool-registry.md`.
- Fail when `AGENTS.md` exceeds the agreed line budget.
- Warn when active plans are older than 30 days.
- Require ASO docs review when `src/tools/aso/**` changes.
- Require architecture docs review when `src/bin/mcp-server.ts` changes.

## Quality Bar

A change is done when:

- The implementation matches existing local patterns.
- Inputs are validated at boundaries.
- Public behavior is documented.
- The tool registry remains accurate.
- Validation was run or the skip reason is explicit.
- Any new long-lived rule is encoded in `docs/`, not hidden in chat context.

