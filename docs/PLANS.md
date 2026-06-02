# Plans

Execution plans are first-class project artifacts. Use them when work is too large
to safely complete from memory or a single short prompt.

## When to Create a Plan

Create a plan under `docs/exec-plans/active/` when work touches:

- multiple tool categories
- package exports or build configuration
- MCP server behavior
- data shape migrations
- user-facing workflow changes
- quality or architecture rules

Small single-file fixes do not need a plan.

## Active Plan Format

Use this filename pattern:

```text
docs/exec-plans/active/YYYY-MM-DD-short-topic.md
```

Use this structure:

```markdown
# Plan: Short topic

Status: ACTIVE
Created: YYYY-MM-DD
Owner: agent

## Goal

## Context

## Steps

## Validation

## Decisions

## Open Questions
```

## Completed Plan Format

When work finishes, write a completion note under:

```text
docs/exec-plans/completed/YYYY-MM-DD-short-topic.md
```

Include:

- what changed
- validation run
- skipped validation and why
- follow-up work
- links to design docs or generated references

## Plan Hygiene

- Do not let active plans become stale.
- If a plan is abandoned, mark it as `STALE` and explain why.
- If a plan changes direction, update the decisions section.
- Completed plans should describe outcomes, not intentions.

