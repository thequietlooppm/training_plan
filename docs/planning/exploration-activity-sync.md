# Exploration — Activity sync (Strava/Garmin) auto-completes prescribed runs

> **Status: exploratory pre-issue planning pass, not a committed plan.** No
> GitHub issue exists yet. This is tech-lead framing the problem and
> synthesizing input from designer, swe, data-engineer, data-scientist, and
> deploy-engineer so `@tpm` can cut it into a real issue (or issues) with
> `needs:plan` resolved. Product decisions marked **open** below are not
> settled — don't build against them without confirming.

---

## 1. Problem statement

Today, completing a prescribed run in the training plan is 100% manual: the
runner has to open the day and tap "Mark complete" (see
`docs/design/training-calendar.md`, open question #3). For a runner who
already records every run on Strava or Garmin, this is redundant data entry,
and if they forget, the plan looks like they trained less than they did —
undermining the calendar's whole "one glance tells you where you stand"
premise. Every competitor referenced in the design spec (TrainingPeaks,
Strava, Runna) solves this with device/app sync.

## 2. MVP acceptance criteria (Strava-only)

1. From Settings, a runner can connect a Strava account via OAuth; the UI
   shows not-connected / connecting / connected (with last-synced time) /
   auth-expired / error states.
2. Only one provider connected at a time (Garmin is explicitly out of scope
   for this MVP — see §4).
3. After connecting, new Strava activities sync automatically going forward
   (webhook-driven). No historical backfill in MVP.
4. When a synced running activity plausibly matches a prescribed run (same
   local day, running-type, distance within tolerance — exact rule in §5), it
   surfaces as a **suggested match** in the day-detail sheet ("5.2 mi on
   Strava — mark complete?") with confirm/dismiss. **MVP does not silently
   auto-complete** — see §5 for why and the promotion path.
5. Confirming a suggestion marks the run complete, fills `Completed` with the
   activity's distance, and shows "from Strava" provenance + a link out. The
   filled/checked visual state is identical to a manual completion.
6. A runner can undo a confirmed match from the day-detail sheet.
7. A runner can disconnect Strava at any time. Disconnecting revokes the
   token, stops future sync, and purges stored raw activity data. Already
   applied completions persist by default; an explicit checkbox offers "also
   un-check runs that came from Strava" (opt-in, off by default — **open
   product question**, see §7).
8. No name, email, avatar, GPS/polyline, or lat/lng is ever stored in the
   activities table or emitted in analytics; it lives only in an isolated,
   access-restricted identity table (§5.3).
9. `activity_synced`, `match_evaluated`, and `match_user_response` events
   (opaque IDs only) are emitted from day one — without them we can never
   evaluate whether it's safe to promote matching from suggested to silent.
10. Feature ships behind a flag, default off, staged rollout (internal →
    allowlist → percentage).

Out of scope for this MVP: Garmin, historical backfill, silent auto-mark,
GPS/route display, cross-provider dedupe (only one provider connectable),
auto-skip of anything.

---

## 3. Synthesized approach

### 3.1 Sequencing forces the stack ADR

Both swe and data-engineer independently flagged the same thing: this is
likely the feature that **forces `docs/decisions/0002-web-app-stack.md`** to
get decided, not a feature that can be built on top of an already-settled
stack. Doing OAuth + token refresh + a webhook receiver + background sync
correctly requires: a real server-side process (rules out a purely static or
client-only frontend), a datastore capable of encrypted-at-rest columns, and
a background job/queue mechanism for token refresh and async sync/matching.
**Recommendation: settle ADR 0002 as part of scoping this issue**, with these
requirements as the constraints, rather than guessing at a stack in the
abstract. This is the single biggest sequencing dependency in the plan.

### 3.2 Strava first, Garmin later — not a stylistic choice, a gating one

Strava's API is self-serve (OAuth app registration, webhook subscription,
published rate limits). Garmin's Activity API sits behind the **Garmin
Connect Developer Program** — an application + approval process with no
guaranteed timeline and a real chance of rejection. Building against a
provider we don't have approved access to is wasted motion. Recommendation:

- **MVP ships Strava-only.**
- Design the internal activity model and a `ProviderAdapter` interface now so
  Garmin is a second adapter later, not a rewrite (deploy-engineer, swe).
- Submit the Garmin developer-program application in parallel with MVP build
  — it costs only calendar time and de-risks the "later" milestone without
  blocking it.
- Garmin becomes its own milestone, contingent on approval landing.

### 3.3 Matching logic — resolved as suggest-first, not silent, at launch

This was the explicit open design question. data-scientist's read: this is a
record-linkage heuristic, not a sports-science model, and there's a real
asymmetry in the cost of getting it wrong — a **false miss** costs the user
one tap (the manual "Mark complete" they already do today); a **false match**
is invisible and pollutes the numbers that later logic (weekly completed
volume, any future load/ACWR-style progression check) would trust. A
false-match that overstates completed volume, or that papers over a skipped
key workout, has a real injury-adjacent failure mode once the app starts
using "completed" data to decide anything about future training.

**Matching rule (first pass, implementable):**
- Filter synced activities to running types (Run/TrailRun/Treadmill/Track);
  exclude Ride/Walk/Hike/Swim.
- Bucket to the *activity's own local calendar day* (open question: vs. the
  user's app-configured timezone if they differ — see §7).
- Aggregate same-day running activities into one "day execution" (handles
  warm-up + workout + cooldown as separate files).
- Distance tolerance: `max(1.5 mi, 15% of target)`, symmetric.
- Intensity (pace/effort vs. prescribed tempo/interval) is **not** gated on
  in MVP (no pace zones yet per the calendar spec) but is computed as a
  non-blocking `intensity_flag` for future use.
- Decision tiers: single same-day match within tolerance → **candidate for
  auto-mark**; ambiguous/multiple candidates/out-of-tolerance/±1-day →
  **suggestion**; no candidate → leave unmarked; **no case ever auto-skips**.

**Conflict resolved:** designer's spec assumed high-confidence matches apply
automatically with non-modal undo, matching the "remove the friction of
OAuth" goal; data-scientist recommends launching in suggest-only mode for
*all* tiers, even the clean single-match case, until precision is validated
on real usage (target ≥98% precision on a labeled sample before going
silent). These aren't actually incompatible — **designer's UI already has
both a silent-done state and a suggestion state as separate patterns**, so
the resolution is: **ship with every match routed through the suggestion UI
at launch**, instrument every confirm/dismiss/undo, and flip a
config threshold to let the top tier go silent once precision clears the bar
— a config change, not new UI work. This is a fast-follow decision, not a
blocking one.

### 3.4 Token storage, refresh, revocation, disconnect

- Standard OAuth authorization-code flow; store access token, refresh token,
  expiry, and provider athlete ID — encrypted at rest, in a table isolated
  from everything else (§3.5).
- Refresh proactively / on 401 via a background job (Strava tokens expire
  hourly).
- Disconnect: revoke at the provider, delete the token row, tear down the
  per-user webhook association, purge stored raw activity rows (GPS-adjacent
  data doesn't get a silent shadow copy after consent is withdrawn), keep the
  derived "this run was completed, N miles" fact with provenance downgraded
  to "imported" per designer's proposed copy. Whether already-applied
  completions revert is the one open product question in this flow (§7).

### 3.5 Schema and PII isolation (data-engineer)

Three tables, three access paths:

- **`provider_connections`** — `user_id`, `provider`, `provider_athlete_id`,
  encrypted access/refresh tokens, scope, expiry. Restricted to the sync
  service role only; never joined into analytics.
- **`provider_identity`** (PII) — `user_id`, `provider`, `provider_athlete_id`,
  display name, email, avatar URL. Separate table, touched only for
  account-linking/display. This is new PII → **needs an ADR** (see §8).
- **`activities`** (analytics-safe) — opaque `activity_id` PK, `user_id`,
  `provider`, `provider_activity_id` (dedupe key), `activity_type`,
  `start_time` (UTC + tz offset), `distance_m`, `moving_time_s`,
  `elapsed_time_s`, `avg_hr` (nullable), `matched_workout_id` (nullable FK),
  `match_status`. **No name, GPS polyline, lat/lng, gear, or calories** — none
  are needed to drive matching or show "actual distance," and storing GPS by
  default conflicts with the minimization constraint. A future map view, if
  ever built, is a separate opt-in table.
- `provider_athlete_id` never becomes a join key into `activities` — that
  join is always via the internal opaque `user_id`.

### 3.6 Backfill, dedupe, idempotency

- **MVP is go-forward sync only** (no historical backfill at connect time) —
  both data-engineer and deploy-engineer converged on this independently: it
  avoids a large first-sync hammering Strava's rate limits, sidesteps the
  webhook chicken-and-egg problem for old data, and most of the value (making
  "did I do today's run" effortless) is forward-looking anyway. Backfill is a
  reasonable fast-follow once the pipeline is proven.
- **Idempotency/dedupe key:** unique constraint on `(provider,
  provider_activity_id)`, upserted on every webhook delivery (including
  redelivery) and any future backfill pass. Provider-side edits update the
  row; provider-side deletes soft-delete and unlink `matched_workout_id`,
  which reverts the prescribed run to unmarked rather than leaving a stale
  completion.
- **Ingestion path:** webhook endpoint is a thin receiver that enqueues a job;
  the actual fetch + match runs in a background worker, not the request path
  (keeps webhook ACKs fast and retries safe, per swe).

### 3.7 Deployment / rollout realities (deploy-engineer)

- Strava allows **one Authorization Callback Domain and one webhook
  subscription per app** — each environment (dev/staging/prod) needs its own
  registered Strava app, its own client ID/secret, its own callback domain.
  Plan for 3 credential sets from day one, not one shared config.
- Webhook subscription creation triggers a GET verification challenge to our
  endpoint — the endpoint must be **publicly deployed before the subscription
  can be registered**, a chicken-and-egg step that needs to be scripted into
  the release process, not done by hand.
- Rate limits (~200/15min, ~2000/day, shared per app/environment) mean
  webhook push (not polling) plus a token-bucket limiter with backoff on 429.
- Secrets: a real secret store (chosen alongside the stack ADR), per-user
  tokens encrypted at rest with a rotatable KEK, and a logging redaction
  filter + CI check so tokens/PII never land in logs or the error tracker —
  called out as a hard requirement given the project's privacy constraint.
- Ship behind a feature flag, default off; staged rollout
  internal → beta allowlist → percentage ramp; flag-off is the rollback path
  (stored tokens stay valid, so re-enabling is clean — avoid a full app
  de-registration as a rollback tool).

---

## 4. Ownership

| Piece | Owner | Depends on |
|---|---|---|
| ADR: web app stack (0002) settled against this feature's constraints | tech-lead + swe | — (blocks everything else) |
| Strava app registration (dev/staging/prod), secrets store, webhook endpoint deploy sequencing | deploy-engineer | stack ADR |
| Schema: `provider_connections` / `provider_identity` / `activities`, migrations | data-engineer | stack ADR |
| OAuth connect flow, token refresh job, webhook receiver + background worker, matcher implementation | swe | schema, deploy-engineer's env/secrets setup |
| Matching rule spec, decision tiers, instrumentation spec (`activity_synced`, `match_evaluated`, `match_user_response`) | data-scientist | delivered — ready to hand to swe/data-engineer |
| Connect/disconnect screens, suggestion-state day-detail sheet, provenance line, copy, focus/live-region behavior | designer | delivered — ready to hand to swe |
| Feature flag, staged rollout, Garmin developer-program application (parallel, non-blocking) | deploy-engineer | — |
| Precision/recall evaluation on live suggestion data; decision to promote top tier to silent auto-mark | data-scientist | usage data post-launch (fast-follow, not MVP-blocking) |
| Garmin `ProviderAdapter` (later milestone) | swe | Garmin approval |

## 5. Sequencing

1. Tech-lead + swe settle ADR 0002 (web stack) against this feature's
   requirements (server, encrypted secrets, background jobs, relational-ish
   store).
2. Deploy-engineer registers per-environment Strava apps, stands up the
   secrets store.
3. Data-engineer lands the three-table schema + migrations.
4. Swe builds OAuth connect + token refresh, webhook endpoint + subscription
   lifecycle, background worker, matcher (per data-scientist's spec), all
   emitting the specified instrumentation.
5. Designer's connect/disconnect + suggestion-state UI is implemented against
   the same states already specced (can start once §1–2 unblock a working
   backend to point at; the spec itself is ready now).
6. Deploy-engineer wraps it behind a flag, stages the rollout.
7. Post-launch (fast-follow, separate issue): data-scientist evaluates
   precision/recall on `match_evaluated`/`match_user_response` data and
   decides whether to promote clean single-match cases from suggested to
   silent auto-mark.
8. Later milestone, gated on external approval: Garmin adapter.

## 6. Risks

- **Stack-ADR drag risk.** If ADR 0002 doesn't get settled crisply, this
  issue's effort (independently estimated M/L by swe, M by data-engineer)
  balloons, since it's also carrying the weight of the first real backend
  decision.
- **Rate-limit exhaustion.** A retry storm or over-eager backfill could burn
  a shared per-environment quota and break sync for every connected user at
  once; needs the limiter/backoff from day one, not as a hardening pass.
- **Token/PII leakage.** Tokens or provider athlete IDs landing in logs or an
  error tracker would violate the project's hard privacy constraint; needs
  redaction enforced in CI before first ship.
- **Matching precision is unvalidated.** No labeled data exists yet — that's
  why MVP launches suggest-first rather than silent; treat any push to skip
  straight to silent auto-mark as a rejected shortcut.
- **Webhook chicken-and-egg.** Subscription registration requires a publicly
  reachable, already-deployed endpoint; if this isn't scripted into the
  release process it becomes a manual, error-prone step every environment
  setup.
- **Garmin timeline is unknown and non-binding.** Don't let any roadmap
  commitment depend on Garmin approval landing by a date.

## 7. Open questions (product decisions — not invented here)

1. **Disconnect + already-applied completions.** Default is "keep them,
   offer an opt-in checkbox to revert" (designer's proposal) — needs product
   sign-off, not just a default we picked.
2. **Timezone for "same local day."** The matching rule as specced uses the
   *activity's own* timezone offset from the provider. If the runner travels
   or the app has its own configured timezone, these can disagree — which
   wins?
3. **Explicit consent/copy beyond the OAuth scope grant.** Given the
   project's privacy stance, does connecting a provider need its own
   in-product consent step naming exactly what we store (distance, time,
   date — not GPS/name), separate from Strava's own OAuth consent screen?
4. **Demand for Garmin at all.** Before spending the developer-program
   application effort, does the (currently nonexistent) user base actually
   need Garmin, or is Strava-only sufficient for v1? tpm to validate.
5. **Promotion criteria sign-off.** data-scientist proposed ≥98% precision on
   a ~300–500 labeled-pair sample before any tier goes silent — is that bar
   acceptable, or does product want a different threshold/timeline?

## 8. ADRs this plan requires

Per CLAUDE.md, any non-obvious architectural choice or new PII use needs an
ADR in `docs/decisions/` before code lands. This plan settles or introduces:

1. **`0002-web-app-stack.md`** (existing, currently Proposed) — gets decided
   as part of scoping this issue; this feature's constraints (server,
   encrypted secrets, background job runner) are the forcing input.
2. **Token/secrets storage** — encryption-at-rest approach, secret-store
   choice, KEK rotation policy for OAuth client secrets and per-user tokens.
3. **Provider PII isolation & activity data model** — the
   `provider_connections` / `provider_identity` / `activities` three-table
   split, what's stored vs. explicitly dropped (no GPS/polyline/name in
   `activities`), and retention on disconnect. Required because
   `provider_identity` is a new use of PII (name, email, avatar).
4. **Activity-matching heuristic & promotion criteria** — the matching rule
   itself, the decision-tier logic, the suggest-first launch posture, and the
   precision/recall bar that gates promoting any tier to silent auto-mark
   (this also fixes `matcher_version` and a recompute trigger on plan edits
   into the schema, per data-scientist).

---

*Consulted for this pass: designer, swe, data-engineer, data-scientist,
deploy-engineer. Synthesized by tech-lead. Next step: `@tpm` cuts this into a
real GitHub issue (or a small epic) with acceptance criteria drawn from §2,
and resolves the open questions in §7 before implementation starts.*
