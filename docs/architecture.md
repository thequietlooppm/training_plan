# Architecture & current status

Source content for a separate visual/diagram writeup (built outside this
repo). This file is the accurate reference it should be drawn from — it
distinguishes what's actually built and deployed today from what's planned,
rather than blending the two. Last updated 2026-09-21 against issue #7.

## Service topology

**`apps/web`** — TypeScript + React (Vite + React Router), a pure static
SPA, no server-side rendering, no server-side logic. Build output
(`apps/web/dist`) is deployed to **Cloudflare Pages** — served from
Cloudflare's edge CDN, not a server process. Calls `apps/api` over HTTP for
everything; holds no backend logic itself. TanStack Query handles server
state. Styled with Tailwind CSS + shadcn/ui.

**`apps/api`** — Node.js + Fastify, TypeScript, a single long-running
server process (not split serverless functions — the future Strava webhook
receiver needs a fast, reliable ACK, and a background worker needs a
persistent process to run in). Currently exposes one route: `GET /health`.
Runs as a Docker container.

- **Dev environment (real, deployed):** **Render.com free tier**, web
  service `training-plan-api-dev`. Chosen over Fly.io for dev specifically
  because Fly now requires a card on file even for near-$0 usage; Render's
  free Web Service doesn't. See `docs/decisions/0002-web-app-stack.md`'s
  addenda for the full comparison (including why self-hosting on the
  operator's home Raspberry Pi was evaluated and rejected).
- **Staging/prod (planned, not built):** Fly.io, one app per environment,
  kept always-on in prod (webhook deliveries need a prompt ACK, not a cold
  start after a spin-down).

**CI/CD** — GitHub Actions (`.github/workflows/ci.yml`), running on every
PR into `main` and every push to `main`: `pnpm -r --if-present run lint`,
then `typecheck`, then `test`, then `build`, recursively across every
`apps/*` and `packages/*` workspace member that defines those scripts — new
workspace members are picked up automatically, no edits to the workflow
file needed. This is a **required, branch-protection-enforced status
check** on `main` (`docs/decisions/0004-pr-review-gate-and-branch-
protection.md`) — a red pipeline blocks merge, not just deploy. CI does
**not** deploy anything — deploys are triggered explicitly and separately
(`scripts/deploy-dev.sh`), not on every merge to `main`.

**pnpm workspace** — `apps/web`, `apps/api`, and `packages/*` (currently
just a placeholder `README.md`, no packages published yet) under a single
pnpm-workspace root. The Docker build for `apps/api` is deliberately built
from the **repo root**, not `apps/api/` alone, so the workspace lockfile and
(currently empty, soon real) `packages/*` shared code stay reachable —
building from `apps/api/` alone would work today and break silently the
first time `apps/api` imports shared domain code from `packages/`.

**What's planned but not built yet:**
- **Postgres** — no database exists yet. Planned data store (with Drizzle
  as the ORM) once plan-setup/personalization work (issue #8) starts.
  `provider_connections` (Strava tokens) will need column-level encryption
  under application control, per ADR 0002.
- **Strava OAuth / webhooks** — no connect flow, no webhook receiver, no
  token storage exists yet. Planned under issue #19 ([Epic] Strava activity
  sync).
- **pg-boss** (Postgres-backed background job queue) — not provisioned;
  depends on Postgres existing first. Planned for token refresh, activity
  matching, and the bounded backfill job.

None of the above exist in the codebase or in any deployed environment
today — this doc will be updated as each lands, not written ahead of the
code.

## Request/data flow — the current walking skeleton

This is the entire real request path that exists today, concrete enough to
diagram directly:

1. A browser requests `apps/web`'s URL. Cloudflare's edge serves the
   static build (`index.html` + JS/CSS bundle) directly from its CDN — no
   origin server involved, no cold start, response is effectively
   instant regardless of where the request originates.
2. The page's JS boots, and `HomePage` fires a TanStack Query-managed
   `fetchHealth()` call (`apps/web/src/lib/health.ts`) to
   `${VITE_API_BASE_URL}/health` — a plain `fetch()`, no auth, no request
   body. `VITE_API_BASE_URL` is **baked into the JS bundle at build time**
   from `apps/web/.env.production` (a committed, public URL — not a
   secret), so it can't be changed post-build without rebuilding and
   redeploying.
3. That request crosses the public internet to `apps/api`'s Render URL.
   Render's free tier spins a service down after **15 minutes idle**; the
   next request wakes it, taking up to **~60 seconds** before it responds.
4. `apps/api`'s Fastify server has `@fastify/cors` registered with an
   allow-list read from the `WEB_APP_ORIGIN` env var — a **comma-separated
   list** (so a locally-running `apps/web` dev server and the real deployed
   Cloudflare Pages origin can both be allowed at once, without flipping
   this back and forth). On Render, `WEB_APP_ORIGIN` is set to the deployed
   Pages URL as a Render environment variable (out-of-band, not baked into
   the committed `render.yaml`, since it depends on the Pages project
   existing first). If the resolved allow-list is empty or contains a
   literal `*`, the server refuses to boot rather than silently defending
   nothing or allowing everything.
5. `GET /health` returns `{"status":"ok"}`. Fastify's CORS plugin echoes
   `Access-Control-Allow-Origin` back for the calling origin if it's on the
   allow-list; the browser only lets the page's JS read the response if
   that header matches.
6. Back in `apps/web`: while the request is in flight, `HomePage` shows a
   loading skeleton. If it's still loading after **~3 seconds**, a
   "Still connecting — waking up the API…" caption appears — this is a UX
   affordance only (no client-side fetch timeout, no abort), specifically
   so a real ~60s Render cold start reads as "waking up" rather than
   "broken." On success, the page shows "Backend connected" with the raw
   `/health` response; on failure, an error state with a "Try again"
   button (which just refetches — TanStack Query's default retry/backoff
   already covers a transient 502 mid-boot with no extra config).

A diagram of this should show exactly four hops: **browser → Cloudflare
edge (static assets)**, **browser JS → Render (`GET /health`, CORS-scoped)**,
with the Render leg annotated as "cold or warm, up to ~60s on cold," and the
`WEB_APP_ORIGIN`/`VITE_API_BASE_URL` env vars annotated as the only coupling
between the two deployed services (no shared runtime, no shared network).

## Current status

**Deployed today:**
- `apps/web` → Cloudflare Pages project `training-plan-web-dev`,
  `https://training-plan-web-dev.pages.dev` — live, direct-upload deploy via
  `wrangler pages deploy` (not Cloudflare's git-integration auto-deploy).
- `apps/api` → **not yet deployed.** The `Dockerfile` (repo-root build
  context) and `render.yaml` Blueprint are written and the Docker build has
  been verified locally (`docker build` + `docker run` + `curl /health`
  succeed, including a CORS preflight-style check against the real intended
  Pages origin) — but the `training-plan-api-dev` Render Web Service itself
  does not exist yet. Creating it is a one-time action that needs the
  repo owner directly: either completing a Render device-login flow
  (`render login`, browser-based) or a one-time dashboard step connecting
  this GitHub repo and applying the `render.yaml` Blueprint (Render's
  Blueprint sync requires GitHub-App repo authorization, which has no
  headless/API equivalent), or providing a Render API key so
  `scripts/deploy-dev.sh` can drive it end-to-end. See the PR for issue #7
  for the exact ask.
- `scripts/deploy-dev.sh` is written and its guard clauses / syntax are
  verified, but it hasn't completed a real end-to-end run yet — it's
  blocked on the same Render prerequisite above.

**Verified working:**
- The Docker image builds correctly from the repo root and only installs
  `@training-plan/api`'s dependency subgraph (not `apps/web`'s toolchain),
  confirming the workspace-aware `pnpm install --filter` approach in the
  `Dockerfile` is correct.
- The running container binds correctly, serves `GET /health`, and
  correctly echoes `Access-Control-Allow-Origin` for the real deployed
  Cloudflare Pages origin when `WEB_APP_ORIGIN` is set to it — verified
  locally against a real container, not just read from source.
- `apps/web`'s production build correctly bakes the intended Render URL
  into its JS bundle from the committed `.env.production`.
- The Cloudflare Pages deploy itself is real and live (`curl` returns
  `200` with the real page HTML).

**Not yet verified (blocked on the above):**
- The actual live cross-network call from the deployed `apps/web` to a
  deployed `apps/api` on Render.
- The cold-start "Still connecting…" affordance against a real ~60s Render
  wake (only exercisable once a real service exists and has been left idle
  15+ minutes).

**Explicitly out of scope for now** (per issue #7): staging/prod
environments (still planned for Fly.io later), self-hosting `apps/api` on
the operator's home Raspberry Pi (evaluated and rejected — see ADR 0002),
CI-triggered auto-deploy on either Cloudflare or Render, and any further
production-hardening (timeouts, retry tuning, an always-on paid instance)
beyond what this walking skeleton needs.

**Next milestone:** the MVP feature epics, once the dev environment is
fully verified end-to-end — #8 ([Epic] Plan setup & personalization), #15
([Epic] Calendar & workout display), #19 ([Epic] Strava activity sync), and
the smaller epics after that (#27 completion scoring, #30 plan switching,
#34 Google Calendar sync, #37 Sign in with Strava). Each of these is the
first real point Postgres, pg-boss, and Strava OAuth/webhooks actually get
built — none of it exists yet, per the topology section above.
