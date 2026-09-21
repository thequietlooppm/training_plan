# training_plan

Monorepo for the training_plan product. Web app first; native iOS and Android later.

## Layout

| Path | What |
|---|---|
| `apps/web/` | Web app — the current focus |
| `apps/api/` | Backend API (Node.js + Fastify) serving the web app and, later, native clients |
| `apps/ios/` | Native iOS app (Swift/SwiftUI) — later |
| `apps/android/` | Native Android app (Kotlin) — later |
| `packages/` | Code shared across platforms (API contract, domain types, validation) |
| `docs/planning/` | Product brief, scope, milestones |
| `docs/decisions/` | Architecture Decision Records |
| `.claude/agents/` | Role subagents used for planning and execution |
| `scripts/` | Repo tooling |

## Getting started

1. Create the GitHub repo and add it as `origin`.
2. Run `./scripts/setup-tracking.sh` once to create labels + the project board
   (needs the `gh` CLI authed with the `project` scope).
3. Start planning: invoke `@tpm` to scope the first requirement into a GitHub issue.

See `CLAUDE.md` for how work is tracked and how the role subagents fit together.

