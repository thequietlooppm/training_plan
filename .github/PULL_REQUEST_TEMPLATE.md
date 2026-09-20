<!--
This template exists so a reviewer — human or AI agent — has what they need
to review this PR without asking for it first. Fill in what you can; delete
this comment block before submitting.
-->

## What & why

<!-- One or two sentences: what changed, and why (link the issue). -->

Closes #

## Plan it should match

<!-- Link the issue comment / tech-lead plan this diff implements. -->

## How to review this PR

```
gh pr diff <this-pr-number>
gh pr checkout <this-pr-number>   # to run it locally
```

Leave findings as a normal PR review (not just chat):

```
gh pr review <this-pr-number> --comment -b "..."      # non-blocking note
gh pr review <this-pr-number> --request-changes -b ".." # blocking
gh pr review <this-pr-number> --approve -b "..."       # looks good
```

Or run `/code-review` (single-agent) or the cloud multi-agent "ultra" review
against this PR — either posts findings as PR comments directly.

## Checklist (per `CLAUDE.md`)

- [ ] CI is green (lint, typecheck, test, build)
- [ ] Diff matches the plan tech-lead wrote on the issue — no unplanned scope
- [ ] Tests added/updated for any behavior change
- [ ] No new PII field/use without an ADR (`docs/decisions/`)
- [ ] No secrets committed; new env vars added to `.env.example` (names only)
- [ ] Migrations (if any): backward-compatible, staged, rollback noted

## Rollout notes (deploy-engineer — skip if not applicable)

- Risk level / rollout method:
- Rollback plan:
- Flag (if any):
