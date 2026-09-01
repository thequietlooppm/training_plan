# 1. Record architecture decisions

Date: 2026-08-31
Status: Accepted

## Context

We want a lightweight, durable record of the architectural choices on this
project — what we chose, what we considered, and why — so the reasoning
survives past the conversation it happened in.

## Decision

Every non-obvious architectural or cross-cutting choice gets an ADR in
`docs/decisions/`, numbered sequentially: `NNNN-short-title.md`.

Format: **Context** (the forces at play), **Decision** (what we're doing),
**Consequences** (what gets easier, what gets harder). Status is one of
`Proposed`, `Accepted`, `Superseded by NNNN`.

Keep them short. An ADR is a paragraph or two, not a design doc.

## Consequences

- New contributors (human or subagent) can read `docs/decisions/` to understand
  why the codebase looks the way it does.
- `@tech-lead` writes an ADR as part of synthesizing a plan whenever the plan
  settles an architectural question.
