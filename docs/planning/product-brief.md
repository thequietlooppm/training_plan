# Product brief — training_plan

> Owned by `@tpm`. This is the source input for scoping issues. Keep it short and
> current; detail lives in the GitHub issues it spawns.

## Problem

Runners following a real periodized, pace-based training plan have to manually
translate relative prescriptions ("72% of peak week," "40 min tempo at
threshold pace") into concrete daily targets, and then manually check
completion against what they actually ran. training_plan personalizes a plan
template into a runner's own daily distances and paces, and automatically
compares prescribed vs. actual (via Strava) so a runner can tell at a glance
whether they're on track.

## Target users

The runner themself — not a coach. There is no coach-side plan-authoring or
plan-distribution tooling in scope; a runner picks and consumes a plan
personalized to them.

## What the product does (v1, web)

### MVP core

- **Plan library.** Runner picks a plan from a small, hand-built template
  library. Build order: (1) a de-branded "club-style marathon plan" — sourced
  from a real club plan, but stripped of the club's name/branding and any
  club-specific jargon so it's presented generically, then (2) the MCR
  15-week 10-mile plan. General plan ingestion (parsing arbitrary
  uploaded plans to scale the library) is an acknowledged future direction,
  not scoped for v1 — see Out of scope.
  **The source club is never named in any artifact — including commits,
  issues, and internal docs — for as long as v1/MVP lasts.** Branding it
  properly (with permission) is a real possibility post-v1, not ruled out
  forever, just not now.
- **Pace-zone calculator.** Runner enters a recent race result (distance +
  time) and/or a goal race time.
  - A recent result derives Recovery, Easy, Threshold, 10K, 5K, and
    Interval/Repetition paces via VDOT/Riegel-style equivalency.
  - A goal time derives Marathon or Half-Marathon goal pace directly (not
    equivalency-derived from current fitness, since a goal pace is often a
    deliberate stretch).
- **Personalization.** The template is scaled into daily prescriptions based
  on the runner's own peak-week volume, which is *derived* from the
  template's own workouts, never manually entered.
- **Workout authoring model.** Each calendar day is: (a) a freeform text
  description using pace-zone shorthand exactly as real plans write it
  (e.g. "3-4x1K repeats @ TP"), shown alongside the runner's personal
  pace-reference table so the shorthand resolves to a concrete number for
  them, plus (b) a hand-set expected distance/duration authored by whoever
  builds the template. There is no structured multi-segment workout schema
  and no text parsing. Named formula workouts (e.g. Yasso 800s) and
  composite multi-pace-zone workouts (e.g. a fartlek spanning HMGP/10K/5K)
  use this same model with no special-casing.
- **Calendar view.** Rendered on real calendar dates tied to the plan's
  start date / race day — never relative labels like "Week 1, Monday."
- **Strength/cross-training days.** Prescribed and shown on the calendar,
  but with no periodization or progression logic behind them — they're
  scheduled, not cycled.
- **Strava sync.** Runner connects Strava; all synced activity types (not
  just runs) attach to their corresponding calendar day.
- **Mid-cycle join / bounded backfill.** If a runner joins a plan after its
  calculated start date, the app backfills both the prescribed schedule and
  the Strava match for that plan's already-elapsed days only (plan-start →
  today, one-time at setup) — not a general or unbounded historical Strava
  import. Plan setup only accepts a future or current race date — a runner
  can't set up a plan for a race that's already happened.
- **Plan switching.** A runner can abandon their current plan and start a
  different one mid-stream. The new plan gets the same bounded backfill
  treatment as any mid-cycle join (new-plan-start → today). The abandoned
  plan is preserved, not deleted, so its history stays visible.
- **Completion status.** Every day — including freeform-described ones —
  gets a status via suggest-and-confirm sync: **Achieved / Partial / Missed
  / Rest**. Partial means an activity happened but was the wrong type or
  short of the prescription (e.g. hiked instead of ran). Freeform days score
  the same way (a logged, confirmed activity = Achieved), just without a
  numeric target to check against.

### Fast-follow (within the v1 release, required before beta — not MVP)

- **Google Calendar sync.** One-way push (app → runner's Google Calendar) of
  the personalized schedule.

## Explicitly out of scope for v1

- Native iOS / Android apps (later phase — separate native codebases per
  `CLAUDE.md`, not in this release)
- General plan import/parsing of arbitrary uploaded documents (acknowledged
  as the next conversation after the two hand-built templates ship; not
  scoped now)
- Coach-side plan authoring or distribution tools
- Manual per-zone pace entry — zones are always derived from a race result
  or goal time, never typed in directly
- Unbounded/general historical Strava import (only the bounded
  plan-start-to-today backfill case above is in scope)
- Silent auto-completion of Strava matches (suggest-and-confirm only, per
  `docs/planning/exploration-activity-sync.md`)
- Periodization/progression modeling for non-running workout types
  (strength/cross-training is scheduled, not cycled)
- Tracking more than one active plan concurrently (switching between plans
  is supported — see above; running two plans at once is not)
- Kilometer/metric units (miles-only for v1)

## Success signals

*Proposed — not yet confirmed by the user; edit or replace.*

- The runner actually opens training_plan instead of the source
  spreadsheet/PDF to know where they stand on a given day.
- By a few weeks into a training cycle, most scheduled days carry a real
  status (Achieved / Partial / Missed) rather than sitting blank — i.e. the
  Strava sync + confirm loop is actually being used, not bypassed.
- The runner completes at least one full personalized plan (club-style or
  MCR) start to finish using the app as their primary source of truth.

## Later phases

- **Phase 2 — native iOS** (`apps/ios/`, Swift/SwiftUI) against the same backend.
- **Phase 3 — native Android** (`apps/android/`, Kotlin).
- Shared API contract / types graduate into `packages/` as soon as a second
  client is on the horizon.
- General plan ingestion (parse an arbitrary uploaded plan document into the
  template format) to scale the template library beyond the two hand-built
  templates.

## Resolved (tech-lead hardening pass, 2026-09-18)

- **Web stack, backend, and data store.** Decided — TypeScript/React on
  `apps/web/`, Node/Fastify on `apps/api/`, Postgres/Drizzle, Fly.io. See
  `docs/decisions/0002-web-app-stack.md` (Accepted).
- **Post-race-window join.** Moot — plan setup only accepts a future or
  current race date, so this state is unreachable. See Plan switching above.
- **Unscheduled or extra activity handling.** Surfaced as an unlinked/bonus
  entry in the day-detail sheet — never dropped, never auto-applied.
- **Ambiguous same-day matches.** Single-select in the day-detail sheet
  (radio-style, plus "none of these") — not both-apply.
- **Pace calculator, recent result only (no goal time).** Marathon/Half
  goal pace stays **unset**, not equivalency-derived — protects a declared
  stretch target from being silently overwritten, and long-range VDOT/Riegel
  extrapolation is weakest here anyway.
- **Pace calculator, goal time only (no recent result).** The other six
  zones (Recovery/Easy/Threshold/10K/5K/Interval) are **blocked**, not
  derived from the goal — deriving Easy/Recovery from an aspirational goal
  risks the highest-volume zone running too fast.
- **Strength/cross-training completion.** Any non-running activity logged =
  Achieved; a running-only activity = Partial; nothing = Missed. Prevents a
  runner substituting a run for every strength day from showing false 100%
  adherence.
- **Template naming.** See Plan library above — never named, permanently,
  for v1/MVP.
- **Units.** Miles only for v1.
- **Multiple plans.** See Plan switching above — one active plan, switching
  supported.

## Still open

- **Strava token / activity PII.** Schema shape is settled (isolated
  `provider_connections` table, encrypted token columns), but the actual
  encryption/secrets-storage approach is a separate ADR, deliberately
  deferred until the Strava-sync issue starts.
- **`docs/design/training-calendar.md` needs a redo pass** — still describes
  a binary mark-complete flow, not the Achieved/Partial/Missed/Rest model.
  Designer's task, not blocking planning.
- **Backfill job-status UX.** Backfill is async/queued, but a mid-cycle
  joiner expects their calendar populated at setup — needs a design decision
  (poll a job-status field vs. "populates over the next few minutes"
  messaging).
