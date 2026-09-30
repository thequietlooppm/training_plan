# Web v1 — requirements

> Bridge from `docs/planning/product-brief.md` to GitHub issues. Design input,
> not a status tracker — the project board is the tracker. Sourced from the
> brief, `docs/decisions/0002-web-app-stack.md`, and `docs/decisions/0003-template-source-anonymization.md`.

## Functional requirements

### Plan setup & personalization
*Serves: turn a relative, periodized template into the runner's own concrete numbers.*

- **FR1** — Runner selects one of the two available templates (club-style marathon, MCR 10-mile) to start a plan.
- **FR2** — Runner enters a recent race result (distance + time); system derives Recovery / Easy / Threshold / 10K / 5K / Interval paces (VDOT/Riegel-style equivalency).
- **FR3** — Runner enters a goal race time (marathon or half); system derives that goal pace directly (not equivalency-derived).
- **FR3a** — Plan setup requires at least one of a recent result (FR2) or a goal time (FR3) before it can be submitted; submitting with neither is rejected (disabled submit control or inline validation error). This is a UI/product-level constraint only — the underlying pace-zone `calculate()` function still accepts neither input per its own contract; the flow around it now demands one.
- **FR4** — Recent-result-only: Marathon/Half goal pace stays unset until a goal time is entered.
- **FR5** — Goal-time-only fallback: when no recent result has been entered, the other six zones (Recovery/Easy/Threshold/10K/5K/Interval) are derived from the goal time using the same VDOT/Riegel-style equivalency math as FR2, and are visibly flagged as aspirational / not based on demonstrated fitness. If a recent result exists, it remains the source for those six zones — the goal-derived values are only a fallback for when nothing else exists, never a competing source.
- **FR6** — System generates a personalized plan instance from the template, scaling daily prescriptions to the runner's derived peak-week volume (peak volume is computed from the template's own workouts, never entered manually).
- **FR7** — Plan setup rejects a race date earlier than today.
- **FR8** — Runner can view a personal pace-reference table (zone → concrete pace) alongside any workout's shorthand text.

> **Revision note (2026-09-28):** FR5 revised, and FR3a added, after #11 (pace-zone calculator) shipped and while #12/#14 (plan-setup flow) were mid-build. Original scoping had goal-time-only leave the six equivalency zones blocked entirely; Patrick decided a goal-derived, clearly-flagged aspirational fallback serves the product better — recent-result-derived paces still win whenever a real result exists, goal-derived is the fallback of last resort. Tracked in **#52**, which amends #11's scope on the same package without reopening #11 itself. FR3a codifies a related decision on the same in-flight flow: submitting plan setup with neither a recent result nor a goal time is now rejected outright, rather than left open by FR2/FR3's original "and/or" phrasing.

### Calendar & workout display
*Serves: at-a-glance status on real dates.*

- **FR9** — Runner views their personalized plan on a calendar rendered on real calendar dates (tied to plan start / race day — never relative "Week 1, Monday" labels).
- **FR10** — Each day shows its freeform workout text (pace-zone shorthand) plus the hand-set expected distance/duration, or "Rest."
- **FR11** — Strength/cross-training days display as scheduled entries with no computed pace/distance target.

### Strava activity sync
*Serves: automatic prescribed-vs-actual comparison, removing manual check-off.*

- **FR12** — Runner connects a Strava account via OAuth from settings; UI shows not-connected / connecting / connected (last-synced time) / auth-expired / error states.
- **FR13** — Once connected, activities of any type sync automatically going forward (webhook-driven), attached to their calendar day.
- **FR14** — Any same-day Strava activity of any sport type surfaces as a suggestion on a non-Rest day; the runner must confirm or dismiss — never silently auto-applied, and an unconfirmed suggestion never changes the day's status. Distance and duration are not confirm gates. A non-run confirmed on a running-prescribed day triggers the activity-swap path (FR20); a run confirmed on a strength/cross-training day triggers Partial (FR21). Runner can undo a confirmed match, which returns the day to Planned (today) or Missed (elapsed); undoing a bonus suggestion on a Rest day leaves the day as Rest.
- **FR15** — Runner can disconnect Strava at any time; disconnect revokes the token, stops future sync, purges stored raw activity data; already-applied completions persist by default.
- **FR16** — Joining a plan after its start date triggers a one-time bounded backfill (plan-start → today) of both the prescribed schedule and matched Strava activity for the elapsed days of that plan only.
- **FR17** — An unscheduled activity on a Rest day, or an extra activity on an already-matched day, surfaces as an unlinked/bonus entry — never dropped, never auto-applied. A Rest day with an activity stays Rest (no penalty, no status credit). Weekly totals follow FR20: confirmed run miles only; a Rest-day bonus run counts toward run volume, a non-run bonus does not.
- **FR18** — When multiple same-day activities plausibly match one prescribed day, the runner picks one from a single-select list (or "none of these") — never both applied.

### Completion status
*Serves: know if you're on track without manual entry.*

- **FR19** — Every day up to and including today shows a status: Planned / Achieved / Partial / Missed / Rest. Rest days stay Rest regardless — never Planned (even if today is a Rest day), never Missed. The midnight rollover (Planned → Missed when the runner's local day ends with nothing confirmed) applies only to non-Rest days. Planned applies only to the current non-Rest day, while nothing is confirmed yet. Future days show no status. Only a confirmed activity changes a day's status (see FR14); a pending or dismissed suggestion does not. Status is stored as a five-value enum including Partial (see FR20/FR21). Whenever a sync brings in new activities — including late-arriving ones for elapsed days, with no time limit — affected days are re-evaluated: the activity creates or updates a suggestion on its day, and status changes only when the runner confirms it.
- **FR20** — Running-prescribed day (v1): Achieved = any confirmed running activity. The closed v1 run-type allowlist (lives in `packages/` so all clients classify identically): Run, TrailRun, VirtualRun. Walk, Hike, Ride, Swim, Workout, WeightTraining, and all other Strava sport types are non-running. Confirmed run = Achieved regardless of distance or duration. Missed = nothing confirmed once the runner's local day has ended, *or* a non-running activity confirmed — in that case the day stays Missed, the `activitySwap` boolean is `true` on the day's API response, and the logged activity is shown with an "activity swap" indicator. Weekly totals count confirmed run miles only; swap/bonus non-run miles do not contribute to the running-volume fraction. Planned = today, nothing confirmed yet. v1 does not compute Partial for any running-day case (no short-of-prescription threshold); Partial stays in the status enum and data model so partial credit can be added later without a migration. Race day is scored under this same rule.
- **FR21** — Strength/cross-training day: Achieved = any confirmed non-running activity. Partial = the confirmed match is a run-type activity (using the same allowlist as FR20); a bonus non-running activity on the same day does not affect this — the day is still Partial if the confirmed match is a run. Partial is the only path to this status in v1. Missed = nothing confirmed once the runner's local day has ended. Planned = today, nothing confirmed yet. Running vs. non-running is classified from the Strava sport type per the FR20 allowlist.
- **FR22** — *(Deferred — no v1 template has a description-only day; not built until one does.)* Freeform-described day: Achieved = a confirmed activity. Planned = today, nothing confirmed yet. Missed = nothing confirmed once the runner's local day has ended. No Partial tier — no numeric target to fall short of.

### Plan switching
*Serves: real usage survives a runner abandoning or changing plans.*

- **FR23** — Runner can abandon their active plan and start a different one; the abandoned plan is preserved (not deleted) and viewable read-only.
- **FR24** — Exactly one active plan per runner at a time, enforced so a switch can never leave two active plans.
- **FR25** — Switching triggers the same bounded backfill as a fresh mid-cycle join, scoped to the new plan.

### Fast-follow (within the v1 release, before beta — not MVP cut line)

- **FR26** — Runner enables one-way sync that pushes their personalized schedule to their Google Calendar.
- **FR27** — Runner can sign in / create an account via "Sign in with Strava." For a new user, this same OAuth grant both authenticates them and connects Strava activity sync — one action, not two separate steps. This **revises FR12** for any user who arrives after this fast-follow ships: the standalone "connect Strava for sync only, no auth" flow remains for a user who already has an account and is added later; it is not a second, parallel Strava-integration system.

## Non-functional requirements

- **NFR1 (performance)** — Calendar view p95 load < 2s on broadband.
- **NFR2 (reliability)** — Strava webhook receiver ACKs within 2s (Strava's own requirement); the actual fetch/match work is deferred to a background job, never done in the request path.
- **NFR3 (privacy/security)** — Strava tokens encrypted at rest, column-level, in a table isolated from analytics; raw activity payloads purged within 24h of disconnect. (Specific encryption/secrets-storage approach is a deferred ADR, written when Strava-sync implementation starts.)
- **NFR4 (bounded work)** — A mid-cycle-join or plan-switch backfill completes within 5 minutes for a plan up to ~20 weeks.
- **NFR5 (accessibility)** — Calendar and day-detail sheet meet WCAG 2.1 AA color contrast and are fully keyboard-operable.
- **NFR6 (fast-follow only, session security)** — Once "Sign in with Strava" ships, session tokens expire in 24h.

No uptime/concurrency NFR is set for MVP — this is a single-user product for now; revisit once "Sign in with Strava" (FR27) is scoped for real, since that's the point multi-user load becomes possible.

## MVP cut line

**MVP (FR1–FR25, including FR3a):** the full core loop — pick a plan, get personal paces, see a personalized calendar, sync Strava, see real status, switch plans without losing history. No login; single-user by default. Nothing in this set is a coherent product with a piece removed.

**Fast-follow (within v1, before beta):** FR26 (Google Calendar push), FR27 (Sign in with Strava) + NFR6.

**Later (not this milestone):** native iOS/Android, general plan-import/parsing to scale the template library beyond the two hand-built templates.

## Data collected

Minimal-collection pass per `CLAUDE.md`'s privacy principle:

- **Race result (distance + time) / goal race time** — not identifying; keyed to opaque `user_id`. Per FR5, the goal time is also reused (no additional field collected) to derive the six equivalency zones as an aspirational fallback when no recent result exists.
- **Strava OAuth tokens (access + refresh)** — PII-adjacent secret. Isolated table, encrypted at rest per ADR 0002. Encryption/secrets approach is its own deferred ADR.
- **Strava `provider_athlete_id`** — needed to map webhook deliveries to a user; opaque-ish but provider-assigned; never used as a join key into `activities`.
- **Strava display name** — **deferred to the "Sign in with Strava" fast-follow (FR27).** Not collected in MVP (no login, "connect Strava" is sync-only, nothing in the MVP FR set displays a Strava profile). When FR27 ships, store only a display name pulled from the same OAuth grant already being requested — no separate ask of the user. No email, avatar, or other profile field unless a specific feature requires it.
- **Synced activity data** (type, start time, distance, moving/elapsed time, optional avg HR) — analytics-safe, opaque `activity_id`. No GPS/polyline/lat-lng/gear/calories.

## Timeline

No target date. Sequenced purely by dependency and value:

1. Architecture & build plan (issue #4) — scaffold, CI, walking skeleton. Blocks everything below.
2. Plan setup & personalization
3. Calendar & workout display
4. Strava activity sync
5. Completion status
6. Plan switching
7. *(fast-follow, before beta)* Google Calendar sync
8. *(fast-follow, before beta)* Sign in with Strava

## Success signals

Confirmed as written in `docs/planning/product-brief.md`:

- The runner actually opens training_plan instead of the source spreadsheet/PDF to know where they stand on a given day.
- By a few weeks into a training cycle, most elapsed scheduled days carry a real status (Achieved/Missed, or Partial where it applies) rather than sitting blank or stuck on Planned.
- The runner completes at least one full personalized plan start to finish using the app as their primary source of truth.

## Open questions / assumptions carried forward

- `docs/design/training-calendar.md` needs a redo pass (still describes a binary complete/skip flow) — designer's task, not blocking issue creation, but the calendar/day-detail issues should not be built against its current stale content. It must also add Planned, any-run = Achieved, Missed + activity-swap indicator for a non-run on a run day, and Partial kept-but-inactive for runs (reachable only via a run on a strength day).
- Strava token encryption/secrets-storage approach — deferred ADR, written when the Strava-sync epic starts implementation.
- Backfill job-status UX (poll vs. "populates over the next few minutes" messaging) — designer decision, not yet made.
- Post-race plan is unscoped — see the Backlog issue #56 "Define what a runner does after race day".
- Day-swap detection and manual calendar rearranging are unscoped — see the Backlog issue #57 "Detect day swaps after the fact". Note: issue #57's "day swap" (runner moved their long run from Sunday to Saturday — a calendar-day shift) is distinct from FR20's "activity swap" indicator (wrong sport type confirmed on a running-prescribed day, same calendar day). Do not conflate the two.
