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

## Addendum — `apps/api` dev hosting re-derived: Render.com, not Fly.io; self-host on a home Pi considered and rejected for now (2026-09-21)

Issue #7 (walking-skeleton deploy) originally specced `apps/api`'s dev
environment on Fly.io per this ADR's original hosting line. Setting that up
surfaced a real objection: Fly.io now requires a card on file even though
`min_machines_running: 0` should keep actual dev usage near $0. The user
asked, in good faith, whether `apps/api` could instead run for genuinely $0
on a Raspberry Pi (4/5, 4GB+ RAM) they already own, which currently runs
**Home Assistant OS (HAOS)**. `@deploy-engineer` re-derived the hosting
choice as a genuine three-way comparison — self-host, Fly.io, Render.com —
rather than defaulting back to Fly.

**Decision: `apps/api`'s dev environment moves to Render.com's free tier.**
Self-hosting on the Pi was seriously evaluated, not dismissed, and rejected
for *this* purpose. Fly.io remains the plan for **staging/prod** once that
work starts — unchanged, since the original case for Fly (persistent
process, prompt webhook ACK, background jobs) was never about dev-environment
cost.

### Why not self-host on the Pi

Not rejected on reliability grounds — see calibration below, that's
deliberately not the deciding factor here. Rejected because making it
actually satisfy issue #7's own acceptance criteria (a stable, scriptable,
repeatable public URL that `apps/web`'s `.env.production` can bake in and
keep working across redeploys) costs more, in real terms, than it saves:

- **HAOS forces a choice between two imperfect integration paths**, since the
  Supervisor owns the system and you can't `docker run` an unrelated
  container the normal way:
  1. **Advanced SSH & Web Terminal add-on with protected mode disabled** —
     gives raw `docker` access on the host. This is the one we'd pick if we
     self-hosted at all: `apps/api` is a generic Fastify/Node service with
     zero relation to home automation, so treating the Pi as "a Docker host
     that happens to also run HA" is the right mental model, not forcing a
     generic web app through HA's own packaging conventions. But disabling
     protected mode is a real, permanent reduction in HAOS's isolation
     posture on a device the user depends on for actual home automation —
     not a footnote, a genuine cost, and one they'd be accepting knowingly
     for a dev-only convenience.
  2. **Package `apps/api` as a proper local HA add-on** (`config.yaml` /
     `build.yaml`, HA's build/ingress conventions) — the "correct" HAOS-native
     path, but disproportionate, HA-specific packaging overhead for a service
     that has nothing to do with home automation. Rejected as effort that
     buys nothing.
- **A home Pi behind residential NAT/CGNAT needs Cloudflare Tunnel
  (`cloudflared`)** to be reachable at all — free, no port-forwarding, no
  static IP, works behind CGNAT, and pairs naturally with `apps/web` already
  being on Cloudflare Pages. But a **stable** public hostname (one that
  doesn't change every time `cloudflared` restarts) requires a **named**
  tunnel routed through a domain added to the Cloudflare account. We don't
  own a domain yet (confirmed — nothing in `docs/` or `CLAUDE.md` references
  one). `cloudflared`'s no-domain option, **Quick Tunnels**, hands out a
  random `*.trycloudflare.com` URL that changes on every restart —
  explicitly meant for a five-minute ad-hoc test, not something
  `apps/web/.env.production` can be committed against and expected to keep
  working after the Pi reboots (a home power blip, not a hypothetical). That
  breaks the "scripted and repeatable" acceptance criterion outright, not
  just makes it worse. Getting a stable hostname means buying a domain
  (roughly $10–15/yr at cost through Cloudflare Registrar) — a real,
  non-zero recurring cost, which directly contradicts the "genuinely $0"
  premise of the ask. (This cost isn't uniquely caused by the Pi option — a
  real domain is coming eventually for prod regardless — but it's not
  currently a cost, and self-hosting is the one option that pulls it forward
  to right now.)
- **Fly's and Render's free subdomains solve Strava's one-callback-domain-
  per-app requirement for free**, the same way this ADR already noted for
  Fly's `*.fly.dev`. Self-hosting is the only one of the three options that
  loses this benefit — it needs a purchased domain to get a comparable
  stable hostname, cloud hosts don't.
- Net effect: self-hosting doesn't actually land at "genuinely $0" once
  built correctly for this issue's own requirements, costs real setup effort
  (SSH-based deploy scripting, tunnel config, domain purchase) that isn't
  reusable for staging/prod (those still go to Fly per this ADR), and asks
  the user to knowingly weaken the security posture of a device with real
  home-automation authority — for a benefit (dev-only $0 hosting) that
  Render.com already provides without any of those costs.

### Why Render.com over Fly.io, for dev specifically

Render's free tier for web services has historically **not required a
card on file** — the actual friction the user hit with Fly. It also gives a
free `*.onrender.com` subdomain (same Strava-callback-domain benefit Fly's
`*.fly.dev` gave), supports the same Docker-based deploy issue #7 already
scoped (a `Dockerfile` built from the repo root, not `apps/api/` alone —
that would work today and break silently once `apps/api` imports from
`packages/*`), and needs no new bespoke SSH/tunnel tooling — it's the same
class of managed host Fly is, just without the card requirement at our
scale.

**Live-verified 2026-09-21** (checked directly against `render.com/docs/free`
and `render.com/pricing`, not asserted from memory — this was flagged as the
one load-bearing fact this whole recommendation depended on):

- **No credit card required** to create or run a Free Web Service. Render's
  own docs describe what happens *without* a payment method on file
  (services get suspended if you exceed free limits) — phrasing that only
  makes sense if a card was never required to begin with. One caveat: a
  Render community-feedback thread has scattered reports of a
  "please enter your payment information" prompt, but on inspection that's
  tied to selecting a paid/higher-limit *instance type* in the dashboard, not
  the Free instance type itself — worth a quick manual signup check, but not
  a reason to expect a card gate on the plan actually being used here.
- **Cold start is concretely ~1 minute, not "a few seconds."** A Free
  service spins down after **15 minutes with no inbound traffic** and spins
  back up on the next request, taking **about 60 seconds** (Render shows a
  loading page to browsers while it wakes). This is materially slower than
  the vague "generally slower than Fly" framing first used here — the
  "still connecting…" affordance already scoped for swe (appears after ~3s,
  no fixed cutoff) covers this correctly as designed, but it's worth
  building and testing against a real ~60s wait, not assuming it's a
  two-or-three-second gap. This is also the concrete reason swe was right
  not to add a client-side fetch timeout for this issue — a short timeout
  would misfire on every cold start.
- **750 free instance-hours/month** shared across all Free services in the
  workspace (unused hours don't roll over), plus capped bandwidth and build
  minutes. Not a real constraint at solo-dev usage with 15-minute
  spin-down — a service that's mostly idle stays far under 750 hours/month
  — but worth knowing if usage patterns change.
- Ephemeral filesystem (wiped on spin-down/redeploy) and no persistent disk
  on the Free plan — irrelevant to `apps/api` today (stateless, no local
  writes), but a real constraint to remember if a future decision considers
  colocating anything stateful here (it shouldn't — Postgres has its own,
  separate hosting decision ahead per ADR 0002's Data Store section).

Net: the recommendation holds. No open fact-check remains blocking
implementation.

### Reliability, calibrated to what this actually is

A home Pi is a real single point of failure a managed host isn't — a home
power outage, an ISP outage, SD-card wear, or HA's own workload competing
for the Pi's resources can all take `apps/api` down in a way Fly or Render
can't. Naming this plainly, not glossing over it. But it is **not** the
reason self-hosting was rejected above — issue #7 is a dev-only walking
skeleton with no real users and no uptime expectation, so a Pi being down
for the length of a power blip has close to zero real-world consequence
today. This calculus is explicitly different for **staging/prod**, where
this ADR already requires prod to be always-on because Strava webhook
deliveries need a prompt ACK — a home Pi was never a candidate for that
environment, and nothing here changes that.

### If self-hosting is revisited later

Documented so this doesn't need to be re-derived from scratch: pick
integration path 1 (Advanced SSH & Web Terminal, protected mode off), not
the HA-add-on route. `apps/api`'s Dockerfile (to be added in issue #7; not
in-tree yet) runs unchanged in a `docker-compose.yml` on the Pi (no
Fly-specific bits to strip, since the build itself is host-agnostic).
`cloudflared` runs as its own host-level
service — a named tunnel's routing config (`config.yml`, hostname →
`http://localhost:3001`) is low-sensitivity and could be checked into the
repo (e.g. `infra/cloudflared/config.yml`) as a template; the tunnel's
credentials file is a secret and stays Pi-local only, never committed, same
convention as every other secret in this project. Since there's no
`fly deploy`-equivalent CLI for a home box, "scripted, not manual" means a
`scripts/deploy-pi-dev.sh` that SSHes into the Pi (host/user from an env
var) and runs `git pull && docker compose up -d --build` against the Pi's
own clone of the repo, ending in the same `curl .../health` verification the
Fly- and Render-based scripts will end with (per issue #7's plan — neither
exists in-tree yet). Rollback is
`git checkout <last-good-sha> && docker compose up -d --build` on the Pi —
same "redeploy the last-good build" shape as the cloud options, via a git
ref instead of an image registry.

### What would revisit this

- Render's free-tier terms turning out to have changed (card now required,
  tier discontinued/reduced) — check this first, before implementing, since
  it's the one fact this whole recommendation leans on.
- The project buying a domain anyway once staging/prod work starts (a real
  custom domain will be needed for Cloudflare Pages and Strava's prod
  callback regardless) — that removes self-hosting's domain-purchase
  objection and is worth a fresh look at that point, if $0-and-no-card still
  matters more than the HAOS security trade-off by then.
- Postgres landing on the same Pi later (a separate, future decision — not
  needed for this issue, not designed here) — changes the resource and
  SD-card-endurance math for HA + API + DB sharing one box, and deserves its
  own look when it comes up, not an assumption carried over from this
  addendum.
- Strava OAuth/webhook work starting sooner than expected and needing
  prod-adjacent reliability pre-launch (Strava's webhook delivery doesn't
  tolerate a flaky ACK path well even in testing) — pulls toward Fly/Render
  over a Pi sooner than "prod only."
- The user deciding, on reflection, that disabling HAOS protected mode isn't
  acceptable on a device they depend on for real home automation — decisive
  on its own, independent of every cost/effort argument above.

`CLAUDE.md`'s "Infra / deploy" line is updated in this same pass:
Render.com (`apps/api` dev) + Fly.io (`apps/api` staging/prod, later) +
Cloudflare Pages (`apps/web`).

## What would change this

- If `@data-scientist`'s future precision/recall work on Strava-match
  promotion ever needs an in-process scoring model (vs. today's offline
  pandas-script evaluation against exported event data), that's a live input
  that could pull Python into the service — flagged, not scoped now.
- If concurrent backfill volume grows materially beyond "roughly one runner
  onboarding at a time" (a cohort launch, a reactivation campaign), the
  shared rate-limiter design should be re-verified, and Fly.io's tier pricing
  should be re-checked at that time rather than assumed stable from this ADR.
