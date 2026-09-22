# 2. Web app stack

Date: 2026-09-18
Status: Accepted

## Context

The web app in `apps/web/` is the first platform. The stack was deliberately
left open at repo setup so it could be chosen against real v1 scope instead of
guessed abstractly. That scope is now clear from `docs/planning/product-brief.md`
and the tech-lead hardening pass that followed it: pace-zone calculation from a
recent race result and/or goal time (closed-form VDOT/Riegel arithmetic, no ML
in the request path), two hand-built plan templates personalized into daily
prescriptions, a calendar rendered on real dates, Strava OAuth connect with
webhook-driven go-forward sync, a **bounded one-time backfill** at mid-cycle
join (plan-start → today), and suggest-and-confirm completion status — never
silent auto-complete.

Constraints that follow directly from that scope:

- A **persistent server process**, not static-only or pure edge functions: an
  OAuth callback, a webhook receiver that must ACK fast and reliably, and a
  background job/queue for token refresh, async matching, and the one-time
  bounded backfill (a small paginated bulk pull per user, still async so it
  doesn't block the join flow).
- A **relational-ish data store that supports encrypted-at-rest columns** under
  application control — `provider_connections` holds per-user Strava
  access/refresh tokens (PII-adjacent secrets) and needs column-level
  encryption with an app-held key, not just disk-level encryption as an opaque
  host feature.
- **Solo project** (see `CLAUDE.md`): optimize for one person building and
  operating this — minimal moving infra pieces, low/no recurring cost, fast to
  iterate in — not for team-scaling concerns.
- Native iOS and Android arrive later as **separate native codebases** against
  the same backend (`CLAUDE.md` → Platforms & sequencing), so the API contract,
  domain types, and validation rules must not be trapped inside `apps/web/`.

This decision was made against these constraints — informed by `@swe`
(stack/framework pick) and `@deploy-engineer` (hosting, cost, rollout) — not in
the abstract.

## Decision

**Frontend:** TypeScript + React via **Vite + React Router**, as an SPA. v1 is
entirely behind auth with no crawlable public marketing surface, so
Next.js-class SSR machinery isn't earning its cost. **TanStack Query** for
server state (Strava-sync polling, backfill-job status). **Tailwind CSS** with
**shadcn/ui** (over Radix primitives) for components, per
`docs/design/ui-toolkit.md`'s already-recorded intent. **Lucide** icons.

**Backend / API:** **Node.js + Fastify**, TypeScript end-to-end, as a single
long-running server process — not split serverless functions, per the
webhook-ACK and background-worker constraints above. **REST + an OpenAPI
spec** is the contract, not tRPC or a framework-coupled RPC layer — this is
non-negotiable given iOS/Android arrive later as genuinely separate native
codebases that need a language-agnostic contract to generate Swift/Kotlin
clients from. `apps/web/` generates its own TS client off the same spec so we
don't lose day-to-day DX for it.

**Background jobs:** **pg-boss** (Postgres-backed queue), not BullMQ+Redis.
Solo project → fewest moving infra pieces; Postgres is already required, so
this avoids provisioning and paying for a separate Redis service. Handles
token refresh, async match evaluation, and backfill as **its own job type**,
sharing a single rate-limiter/backoff path with go-forward webhook processing
so a bounded backfill burst never starves webhook ACKs for other users.

**Data store:** **Postgres**, with **Drizzle** as the ORM — chosen over Prisma
specifically because `provider_connections`' encrypted token columns need
explicit application-level control over the crypto rather than an ORM
abstraction hiding it; Drizzle stays closer to raw SQL. Managed hosting (Fly
Postgres or Neon) rather than self-managed — deploy-engineer finalizes the
specific provider when the Strava-sync issue starts; not blocking here.

**Hosting / infra:** **Fly.io**, one small app per environment
(dev/staging/prod). Each environment gets its own free `*.fly.dev` HTTPS
subdomain out of the box, which directly satisfies Strava's one-callback-domain-
per-app requirement without buying real domains. Keep **prod always-on**
(webhook deliveries need a prompt ACK, not a cold start); let dev/staging
auto-stop-to-zero. Expect roughly **$5–15/mo total** across all three
environments — a real, small recurring cost, not free, and worth tracking as
an actual line item rather than assuming $0.

**Monorepo tooling:** pnpm workspaces across `apps/*` and `packages/*`.

**Repository layout correction:** the current `apps/` tree in `CLAUDE.md` only
names `apps/web/` (+ future `apps/ios/`, `apps/android/`) and `packages/` —
there's no slot for the server. OAuth/webhook wiring, the Drizzle schema, and
the background worker are backend-only plumbing, not shared with any client,
so they don't belong in `packages/` — but they're also not a platform client
in the sense the rest of the `apps/` tree implies. **Decision: add
`apps/api/`** as a sibling to `apps/web/`, and record it as the backend target
every client (web now, iOS/Android later) talks to. `CLAUDE.md`'s repository
layout section is updated in this same pass to reflect it.

**`packages/` vs `apps/web/` / `apps/api/` from day one:**

- `packages/` — domain types + Zod schemas (template/day shape, personalized
  plan/day/status, pace-zone calculator input/output, activity-match types);
  the pace-zone calculator itself as pure VDOT/Riegel functions (framework-free,
  unit-testable, and the one piece of domain logic most worth keeping identical
  across web and future native clients); the two hand-built plan **templates**
  as versioned JSON/YAML data files with a shared validating schema (not DB
  rows — see Consequences); the generated TS client from the OpenAPI spec;
  shared request/form validation (race-result entry, goal-time entry).
- `apps/api/` — Fastify server, OAuth/webhook handling, Drizzle schema and
  queries, pg-boss workers, token encryption, and the **personalized plan
  instance** as materialized Postgres rows generated from a template at
  plan-join time (not computed on the fly at read time — suggest-and-confirm
  needs a stable, individually addressable day row to attach a Strava match
  and status to, and mobile sync later needs stable IDs / `updated_at` to page
  over).
- `apps/web/` — all UI: pages, calendar rendering, day-detail sheet,
  connect/disconnect screens, routing, TanStack Query wiring.

## Consequences

- Unblocks issue #4 ([Epic] Architecture & build plan), which was gated on
  this ADR.
- Template content (2 hand-built plans, hand-authored, never end-user-edited
  in v1 — general plan ingestion is explicitly out of scope) lives as files
  under version control, reviewed like code, not as DB-admin-authored rows.
  Revisit this if the template library grows past a handful or general plan
  ingestion ships and templates become runtime-editable — that's a real
  trigger to move template content into the database.
  `template_id` + `template_version` are stored on each personalized plan
  instance so a later template edit never silently rewrites what a runner
  already trained against.
  - This decision was reached independently by `@swe` (app-architecture
    reasoning) and `@data-engineer` (data-layer reasoning) during the
    hardening-pass consult — cross-checked, not just asserted once.
- Token/secrets encryption approach (which KMS/secret store, KEK rotation) is
  a **separate ADR**, written when the Strava-sync issue actually starts —
  deliberately not decided here, since it's downstream of this one (some
  options, e.g. a managed Postgres provider's built-in vault, only exist for
  certain provider choices) and the exploration pass that scoped it explicitly
  said not to lock it in before the host is chosen.
- Bounded backfill (plan-start → today, one-time) turned out, on review by
  both `@data-engineer` and `@deploy-engineer`, to be low risk against
  Strava's per-app rate limits (a single paginated windowed call per user, not
  N calls) — it does not change this stack pick, but it does mean pg-boss /
  a background-job mechanism is core-path for MVP, not an optional add-on to
  defer.
- Fly.io + Cloudflare Workers were both viable on cost; Workers was rejected
  because it pushes the app toward an edge/per-invocation model that doesn't
  fit a conventional persistent Fastify server + background worker cleanly —
  Fly.io's container model matches the stack chosen above without forcing a
  rewrite of the framework decision to fit the host.
- Prisma remains a legitimate alternative to Drizzle if DX is weighted over
  explicit crypto control later — not disqualified by this architecture, just
  the second choice.

## Addendum — scope resolved after this ADR (2026-09-18)

Four product/scope questions raised during the hardening pass were resolved
by the user immediately after this ADR was written. Two are pure scope with
no technical decision attached (noted here for traceability, not because they
changed anything above): **units are miles-only for v1** — no per-user
setting, no conversion logic, so no unit field needed in the domain types
beyond storing a plain numeric distance; and **plan setup only accepts a
future/current race date** — blocks the "post-race-window join" scenario
entirely (nothing to build for a historical/completed read-only view). The
latter is enforced as ordinary request validation (race date ≥ today) in the
shared Zod schema already scoped for plan-join input in `packages/` — no new
architecture.

The third, template-source anonymization, is a standing content-handling rule
now recorded separately as `docs/decisions/0003-template-source-anonymization.md`.

The fourth — **plan switching is a first-class v1 capability** (one active
plan at a time, but a runner can abandon it and start a different one,
triggering a fresh bounded backfill for the new plan) — has a real schema
implication, verified with `@data-engineer` rather than assumed:

- Add a `status` field to the personalized-plan-instance row: `active` |
  `switched_away` | `completed`. Abandoned plans are **preserved, not
  deleted** — both because a runner reasonably wants their history back, and
  because it matches the brief's existing framing that a completed plan has
  standalone value.
- **One active plan per user is enforced at the database level**, not just
  app logic: a partial unique index, `UNIQUE (user_id) WHERE status =
  'active'`. App-layer-only enforcement is a race condition (double-submit,
  multiple tabs, eventually multiple devices once mobile ships) that could
  produce two active rows — cheap to prevent correctly now.
- Backfill and matching are already keyed by `plan_instance_id` (per the
  `(user, plan)`-keyed backfill design above), so a switch mid-backfill needs
  no special handling — the old plan's in-flight backfill job runs to
  completion and writes against the old plan's own rows; the new plan's
  backfill is an independent job against the new `plan_instance_id`.
- One implementation detail this surfaces for whoever builds the Strava-sync
  matcher: **go-forward webhook matching must resolve "which plan is this
  activity matched against" by looking up the user's `status = 'active'` row
  at match time**, not a `plan_instance_id` cached from whenever the webhook
  subscription was first set up. A one-line lookup clarification, not a
  schema change.

No structural change to the materialized-rows model this ADR already
decided — confirmed, not assumed.

## Addendum — web hosting split from Fly.io (2026-09-20)

Issue #7 (deploying the walking skeleton to a real dev environment) is the
first point this ADR's blanket "Infra / deploy: Fly.io" line actually got
tested against a concrete requirement, rather than reasoned about in the
abstract. `@deploy-engineer` was asked to re-derive it, not assume it — same
treatment issue #5 gave the frontend framework pick.

**Refinement: `apps/api` stays on Fly.io as decided. `apps/web` (a pure
static SPA build, no SSR, no server-side logic) deploys to Cloudflare Pages
instead**, not Fly. Reasoning: this ADR's original Fly.io pick was driven by
`apps/api`'s needs specifically — a persistent process, a future webhook
receiver, background jobs — none of which apply to a static build artifact.
Hosting a static SPA on Fly would mean paying for an idle container running a
file server; Cloudflare Pages serves the same artifact from its edge CDN for
free (unlimited requests/bandwidth on the free tier, generous per-deployment
file limits), with no cold start at all — strictly better on both cost and
latency for this specific workload. Splitting hosting providers between the
two apps was weighed and rejected as a real complexity concern: the two apps
share no runtime, only a URL contract (an env var), so "one platform for
operational simplicity" wasn't actually buying anything a single `fly deploy`
/ `wrangler pages deploy` pair doesn't already give a solo operator.

This changes `CLAUDE.md`'s "Infra / deploy" line from "Fly.io" to "Fly.io
(`apps/api`) + Cloudflare Pages (`apps/web` static hosting)" — updated in the
same pass as this addendum.

Concretely, for the dev environment (full detail in issue #7's plan comment):
Fly app `training-plan-api-dev` (Dockerfile build from the repo root, so the
pnpm workspace's lockfile and `packages/*` are reachable — not `apps/api/`
alone, which would break the first time `apps/api` imports shared code);
Cloudflare Pages project `training-plan-web-dev`, deployed via `wrangler
pages deploy`, not Cloudflare's git-integration auto-deploy-on-push (that's
CI-triggered auto-deploy, explicitly out of scope for #7). `apps/web`'s
`VITE_API_BASE_URL` is baked in at build time via a committed
`.env.production` (a public URL, not a secret — consistent with the
`.env.example` convention already in the repo) pointed at the Fly app's
deterministic `*.fly.dev` hostname, which is reserved the moment the Fly app
is created, before it needs to be fully deployed.

**What would change this:** if `apps/web` ever needs server-side rendering,
API routes colocated with the frontend, or anything beyond a static build
(none of which is in scope anywhere in the current product brief), Cloudflare
Pages' Functions or a move back to a Fly-hosted server would need
re-evaluating. Not expected, not designed around preemptively.

## What would change this

- If `@data-scientist`'s future precision/recall work on Strava-match
  promotion ever needs an in-process scoring model (vs. today's offline
  pandas-script evaluation against exported event data), that's a live input
  that could pull Python into the service — flagged, not scoped now.
- If concurrent backfill volume grows materially beyond "roughly one runner
  onboarding at a time" (a cohort launch, a reactivation campaign), the
  shared rate-limiter design should be re-verified, and Fly.io's tier pricing
  should be re-checked at that time rather than assumed stable from this ADR.
