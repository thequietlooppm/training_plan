# 2. Web app stack

Date: 2026-08-31
Status: Proposed

## Context

The web app in `apps/web/` is the first platform. The stack was deliberately
left open at repo setup — it should be chosen against the actual v1 scope, not
guessed up front. Constraints known so far:

- Native iOS and Android clients come later against the same backend, so the
  web app should not own domain logic that the API contract could own instead.
- Team roles are modeled as subagents (see `CLAUDE.md`); no strong existing
  in-house stack preference has been recorded.

## Decision

_Pending._ `@tech-lead` decides during planning of the first web issue, with
input from `@swe` (and `@designer` / `@deploy-engineer` as relevant). Fill in:

- Frontend framework + language
- Backend / API approach (and where it's deployed)
- Data store
- What lives in `packages/` vs `apps/web/` from day one

## Consequences

_To be filled in when the decision is made._
