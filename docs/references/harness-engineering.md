# Harness Engineering Reference

Source: https://openai.com/index/harness-engineering/

## Relevant Takeaways

- Treat `AGENTS.md` as a table of contents, not a full manual.
- Put repository knowledge in local, versioned, structured docs.
- Make application and repository state legible to agents.
- Encode architecture and taste as enforceable invariants where possible.
- Capture plans, decisions, quality gaps, and technical debt inside the repo.
- Add freshness and cleanup loops so agent-generated work does not drift.

## How This Repo Applies It

`pabal-resource-mcp` uses:

- `AGENTS.md` for the short map.
- `docs/ARCHITECTURE.md` for codebase topology.
- `docs/CONTRIBUTING_AGENTS.md` for agent workflow rules.
- `docs/QUALITY_SCORE.md` for quality and freshness tracking.
- `docs/PLANS.md` plus `docs/exec-plans/` for execution plans.
- `docs/generated/` for mechanically maintained references.

