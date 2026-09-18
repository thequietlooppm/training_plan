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
  import.
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

## Open questions

- Web stack, backend, and data store — to be decided by tech-lead during
  planning (`docs/decisions/0002-web-app-stack.md`).
- **Post-race-window join.** If a runner joins after a plan's entire date
  range has already elapsed, does the app refuse, or show a
  historical/completed view?
- **Unscheduled or extra activity handling.** An unscheduled Strava activity
  on a Rest day, or a second activity on a day that already has a confirmed
  match — ignored, surfaced as unlinked/bonus, or something else?
- **Ambiguous same-day matches.** Two same-day activities both plausibly
  match one prescribed day — which does suggest-and-confirm surface, or
  both?
- **Pace calculator with only a recent result (no goal time).** Does
  Marathon/Half-Marathon goal pace fall back to equivalency from current
  fitness, or stay unset until a goal time is provided?
- **Pace calculator with only a goal time (no recent result).** Can the
  other zones (Recovery/Easy/Threshold/10K/5K/Interval) still be produced,
  or is a recent race result a hard prerequisite?
- **Strava token as PII.** Connecting Strava means storing a per-user
  access/refresh token. Per `CLAUDE.md`'s PII-isolation principle, this
  needs to live isolated from analytics/event data, and is a likely
  candidate for its own ADR when this is scoped (tech-lead's call, flagged
  here so it isn't missed).
