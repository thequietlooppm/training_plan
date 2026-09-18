# Project: training_plan

## What this project does

<!-- TODO(you): 1–3 sentences. What is the product, who uses it, what problem does it solve?
     This drives every issue the tpm subagent scopes, so fill it in before planning starts. -->
_Not yet written — see `docs/planning/product-brief.md`._

## Platforms & sequencing

1. **Web app** — the first target. Lives in `apps/web/`.
2. **Native iOS** — later, `apps/ios/` (Swift/SwiftUI).
3. **Native Android** — later, `apps/android/` (Kotlin).

The web app is built first. Native apps are separate native codebases (not a
cross-platform runtime) that talk to the same backend, so anything shared —
the API contract, domain types, validation rules — belongs in `packages/`, not
inside `apps/web/`.

## Tech stack

- **Web:** TypeScript + React (Vite + React Router), TanStack Query, Tailwind + shadcn/ui.
  Decided in `docs/decisions/0002-web-app-stack.md`.
- **Backend / API:** Node.js + Fastify (`apps/api/`), TypeScript, REST + OpenAPI as the
  cross-client contract, pg-boss for background jobs. ADR 0002.
- **Data store:** Postgres, Drizzle ORM. ADR 0002.
- **Native iOS (later):** Swift / SwiftUI.
- **Native Android (later):** Kotlin.
- **Infra / deploy:** Fly.io (one app per environment: dev/staging/prod). ADR 0002.

## Repository layout

```
training_plan/
├── .claude/agents/     role subagents (tpm, tech-lead, designer, swe, …)
├── apps/
│   ├── web/            web app (start here)
│   └── api/            backend server all clients talk to (web now, iOS/Android later)
│       (later: apps/ios/, apps/android/)
├── packages/           code shared across platforms (API client, domain types, validation, plan templates)
├── docs/
│   ├── planning/       product brief, scope, milestones
│   └── decisions/      ADRs — one file per architectural decision
└── scripts/            repo tooling (setup-tracking.sh, …)
```

## How we track work

All feature work lives in **GitHub Issues**, organized on a Project board:

- **Backlog** — not yet scoped
- **Ready** — scoped, unblocked, ready to start
- **In Progress** — actively being worked
- **In Review** — PR open, awaiting review
- **Done** — merged and verified

Every feature gets an issue with acceptance criteria before code is written. Use
`gh issue create`, `gh issue list`, and `gh project item-list` to read and update
status from the terminal — don't track progress anywhere else (no separate doc,
no duplicate task list).

Run `scripts/setup-tracking.sh` once, after the GitHub repo exists, to create the
labels below and the project board.

Label convention:
- `area:design`, `area:data-eng`, `area:data-sci`, `area:swe`, `area:deploy` — which role owns it
- `type:feature`, `type:bug`, `type:chore`
- `priority:p0` / `priority:p1` / `priority:p2`
- `platform:web`, `platform:ios`, `platform:android`, `platform:shared` — which target it affects

## Roles (subagents)

This project defines seven subagents in `.claude/agents/`, mapped to how a real
product team designs and ships work:

| Role | Subagent | Used for |
|---|---|---|
| Technical Program Manager | `tpm` | Sourcing and scoping requirements, sequencing, tracking status |
| Tech Lead | `tech-lead` | Synthesizing input from every role into a plan; design + code review |
| Designer | `designer` | User flows, interface specs, interaction design |
| Software Engineer | `swe` | Implementation, tests, bug fixes |
| Data Engineer | `data-engineer` | Pipelines, schemas, data infra |
| Data Scientist | `data-scientist` | Analysis, modeling, experiment design |
| Deploy Engineer | `deploy-engineer` | CI/CD, rollout strategy, release, rollback |

### How work flows

Requirements flow from TPM to Tech Lead, who is the hub: it gathers input from
whichever other roles are relevant and synthesizes it into one plan before
anyone implements.

1. `@tpm` sources and scopes a requirement into a GitHub issue — problem and acceptance criteria, not a prescribed solution.
2. `@tech-lead` reads the issue and pulls in whichever of designer / swe / data-engineer / data-scientist / deploy-engineer are relevant, asking each for their read on approach, effort, and risk.
3. `@tech-lead` synthesizes the input into one plan — chosen approach, ownership, sequencing, open risks — and writes it back to the issue.
4. The relevant roles implement against that plan: designer produces specs, swe / data-engineer / data-scientist build, deploy-engineer preps the release.
5. `@tech-lead` reviews the diff against the plan.
6. `@deploy-engineer` ships it, following the rollout/rollback plan from step 3.
7. `@tpm` closes the issue and updates the board.

Tech Lead can delegate to the other subagents directly (nested subagents are
supported up to 3 layers by default), so you can hand it a scoped issue and
let it gather input and synthesize a plan without relaying messages between
roles yourself.

Invoke a role explicitly with `@agent-<name>` (e.g. `@agent-tpm`), or just describe
the task and Claude will delegate based on each subagent's description.

## Privacy & data minimization

A focal point for every role, not just the data ones. The product should run on
the smallest amount of personal data that makes it work.

- **Collect the minimum.** Every field that identifies a person needs a reason
  tied to a shipping feature. "Might be useful later" is not a reason — add it
  when the feature that needs it is built, not before.
- **Prefer non-PII identifiers.** Key users and records by opaque, randomly
  generated IDs. Don't use email, name, phone, or a device identifier as a
  primary key, foreign key, or join key anywhere it can be avoided.
- **Keep PII out of analytics.** Usage and outcome metrics are computed over
  aggregates and opaque IDs. No email, name, precise location, or free text in
  event payloads, logs, dashboards, or analysis outputs. If a metric needs a
  personal attribute, bucket it (age band, not birthdate) and report it only in
  aggregate with a minimum group size.
- **Isolate the PII that is collected.** The few tables holding real PII stay
  separate from the event/analytics store, with their own access path.
- **New PII is an ADR.** Any new personal-data field, or a new use of an existing
  one, gets a file in `docs/decisions/` — what, why, where it lives, retention,
  and how it's kept out of analytics — before the code lands.

Per role: `tpm` scopes to the minimum identifying data and flags requirements
that need PII; `designer` doesn't ask for personal data a flow doesn't need and
designs for opaque accounts; `tech-lead` enforces non-PII keys and PII isolation
in the plan and at review; `swe` and `data-engineer` build to that; `data-scientist`
specs metrics and instrumentation that aggregate PII away; `deploy-engineer` keeps
PII out of logs, error traces, and third-party config.

## Conventions

- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…).
- **Branches:** one branch per issue, named `<issue-number>-short-slug`.
- **Tests:** colocated with the code they cover; every PR that changes behavior updates tests.
- **ADRs:** any non-obvious architectural choice gets a file in `docs/decisions/` before the code lands.
- **Don't merge to main without:** green CI + tech-lead review + the change matching the plan on the issue.
