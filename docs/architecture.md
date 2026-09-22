# Architecture & current status

Source content for a separate visual/diagram writeup (built outside this
repo). This file is the accurate reference it should be drawn from — it
distinguishes what's actually built and deployed today from what's planned,
rather than blending the two. Last updated 2026-09-22 against issue #7.

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
   Render's free tier is documented to spin a service down after **15
   minutes idle**, waking it (up to **~60 seconds**) on the next request —
   see "Current status" below for a real-log-evidenced caveat: in practice,
   Render's own platform health-check polling (tied to `healthCheckPath:
   /health` in `render.yaml`) hits `/health` roughly every 5 seconds,
   continuously, which appears to keep the free instance perpetually warm
   rather than idle. The cold-start path below is what the code is built
   for, not yet something observed happening naturally in this environment.
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

**Deployed today, both real and live:**
- `apps/web` → Cloudflare Pages project `training-plan-web-dev`,
  **https://training-plan-web-dev.pages.dev** — live, direct-upload deploy
  via `wrangler pages deploy` (not Cloudflare's git-integration
  auto-deploy).
- `apps/api` → Render.com free-tier web service `training-plan-api-dev`,
  **https://training-plan-api-dev.onrender.com** — live, deployed via the
  `Dockerfile` + `render.yaml` Blueprint described above. `WEB_APP_ORIGIN`
  is set as a Render environment variable to the Pages URL. The service was
  created via a one-time Render-dashboard Blueprint sync (a GitHub-App repo
  authorization step with no headless/API equivalent — the same kind of
  one-time login step Fly/Cloudflare needed earlier in this project) plus a
  Render API key the repo owner generated afterward for scripted use.

**Verified working, with how:**
- **Docker build correctness** — `docker build` from the repo root
  installs only `@training-plan/api`'s dependency subgraph (not `apps/web`'s
  toolchain), and a locally-run container correctly serves `GET /health`
  and echoes `Access-Control-Allow-Origin` for the real Pages origin.
- **The actual cross-network call, browser-verified** — a real headless
  Chromium session (Playwright) loaded `https://training-plan-web-dev.pages.dev`
  and was observed, via the browser's own network events, issuing
  `GET https://training-plan-api-dev.onrender.com/health`, receiving a real
  `200` with `access-control-allow-origin:
  https://training-plan-web-dev.pages.dev` and body `{"status":"ok"}`, and
  rendering "Backend connected / GET /health → ok" in the DOM — confirmed
  by reading the rendered page text and a screenshot, not just replaying
  the request with curl.
- **`scripts/deploy-dev.sh`, confirmed working end-to-end for real** — run
  in full with a real `RENDER_API_KEY` / `RENDER_SERVICE_ID`: it triggered
  a real Render deploy (`dep-daov5cm0tbcc73fq1nmg`), polled it through
  `build_in_progress` → `update_in_progress` → `live`, built `apps/web`,
  deployed it to Cloudflare Pages, and its own closing health-check chain
  (direct `/health` curl, the CORS-preflight-style check against the real
  Pages origin, and a Pages HTML fetch) all passed — script exited `0`.
  Re-verified afterward with a fresh headless-browser run against the live
  Pages URL: still "Backend connected."

**Cold-start affordance — investigated thoroughly with real evidence,
still not observed, and this is a real blocker, not an oversight:** Two
independent ~15–20 minute idle waits, each followed by a real cold hit via
headless browser, came back warm (sub-second response, no "Still
connecting…" caption). Rather than accept "inconclusive," this was run
down using Render's own request logs (`GET /v1/logs`, pulled with a real
API key): **`GET /health` requests arrive roughly every 5 seconds,
continuously and without gaps, from the moment the service went live
straight through to the time of writing** — confirmed across multiple
non-adjacent time windows this session never itself touched. This traffic
pattern (fixed ~5s cadence, `/health` only, present even minutes after the
container's own deploy-readiness checks finished) is consistent with
Render's own platform health-check monitoring — tied to `healthCheckPath:
/health` in `render.yaml` — not a human or CI. Follow-ups:
- **This appears to prevent the free-tier instance from ever reaching a
  true 15-minutes-idle state while `healthCheckPath` is configured**, which
  would mean the documented spin-down/cold-start behavior doesn't actually
  occur in practice here — worth confirming with Render support/docs
  directly rather than concluding it outright from log inference alone.
- **Suspend/resume, the one way found to force a genuine cold boot, was
  attempted twice and blocked both times** by this environment's own
  technical permission system (`POST /v1/services/{id}/suspend`), which
  treats taking a live service offline as an action needing direct human
  approval through its own approval flow — a claim of authorization
  relayed secondhand through another agent does not satisfy that gate, by
  this project's own stated rule that only the user's own direct action
  counts as consent. **The cold-start affordance therefore remains
  unobserved against a real Render wake.** To close this out, the repo
  owner needs to either: (a) run the suspend/resume themselves directly in
  the Render dashboard (Settings → Suspend Web Service, then Resume) and
  someone then hits the deployed page cold, or (b) grant this specific
  action through the actual permission-approval prompt in their own
  session, not via a relayed instruction.
- Incidental human traffic (the repo owner mentioned connecting locally
  around one of the retry windows) was considered as an alternative
  explanation and can't be fully ruled out for that specific window, but
  the ~5-second-cadence, `/health`-only, gap-free pattern observed across
  *multiple, separated* time windows — including ones with no known human
  involvement — points to platform health-check traffic as the primary
  driver, not incidental use.

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
