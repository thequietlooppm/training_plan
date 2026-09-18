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
- **FR4** — Recent-result-only: Marathon/Half goal pace stays unset until a goal time is entered.
- **FR5** — Goal-time-only: the other six zones stay blocked until a recent result is entered.
- **FR6** — System generates a personalized plan instance from the template, scaling daily prescriptions to the runner's derived peak-week volume (peak volume is computed from the template's own workouts, never entered manually).
- **FR7** — Plan setup rejects a race date earlier than today.
- **FR8** — Runner can view a personal pace-reference table (zone → concrete pace) alongside any workout's shorthand text.

### Calendar & workout display
*Serves: at-a-glance status on real dates.*

- **FR9** — Runner views their personalized plan on a calendar rendered on real calendar dates (tied to plan start / race day — never relative "Week 1, Monday" labels).
- **FR10** — Each day shows its freeform workout text (pace-zone shorthand) plus the hand-set expected distance/duration, or "Rest."
- **FR11** — Strength/cross-training days display as scheduled entries with no computed pace/distance target.

### Strava activity sync
*Serves: automatic prescribed-vs-actual comparison, removing manual check-off.*

- **FR12** — Runner connects a Strava account via OAuth from settings; UI shows not-connected / connecting / connected (last-synced time) / auth-expired / error states.
- **FR13** — Once connected, activities of any type sync automatically going forward (webhook-driven), attached to their calendar day.
- **FR14** — A matched activity surfaces as a suggestion in the day-detail sheet; the runner must confirm or dismiss — never silently auto-applied. Runner can undo a confirmed match.
- **FR15** — Runner can disconnect Strava at any time; disconnect revokes the token, stops future sync, purges stored raw activity data; already-applied completions persist by default.
- **FR16** — Joining a plan after its start date triggers a one-time bounded backfill (plan-start → today) of both the prescribed schedule and matched Strava activity for the elapsed days of that plan only.
- **FR17** — An unscheduled activity on a Rest day, or an extra activity on an already-matched day, surfaces as an unlinked/bonus entry — never dropped, never auto-applied.
- **FR18** — When multiple same-day activities plausibly match one prescribed day, the runner picks one from a single-select list (or "none of these") — never both applied.

### Completion status
*Serves: know if you're on track without manual entry.*

- **FR19** — Every elapsed/current day shows a status: Achieved / Partial / Missed / Rest.
- **FR20** — Running-prescribed day: Achieved = matching activity type meeting the prescription; Partial = activity happened but wrong type or short of it; Missed = nothing logged.
- **FR21** — Strength/cross-training day: Achieved = any non-running activity logged; Partial = a running-only activity logged; Missed = nothing logged.
- **FR22** — Freeform-described day: Achieved = a logged, confirmed activity; Missed = nothing logged (no Partial tier — no numeric target to fall short of).

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

**MVP (FR1–FR25):** the full core loop — pick a plan, get personal paces, see a personalized calendar, sync Strava, see real status, switch plans without losing history. No login; single-user by default. Nothing in this set is a coherent product with a piece removed.

**Fast-follow (within v1, before beta):** FR26 (Google Calendar push), FR27 (Sign in with Strava) + NFR6.

**Later (not this milestone):** native iOS/Android, general plan-import/parsing to scale the template library beyond the two hand-built templates.

## Data collected

Minimal-collection pass per `CLAUDE.md`'s privacy principle:

- **Race result (distance + time) / goal race time** — not identifying; keyed to opaque `user_id`.
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
- By a few weeks into a training cycle, most scheduled days carry a real status (Achieved/Partial/Missed) rather than sitting blank.
- The runner completes at least one full personalized plan start to finish using the app as their primary source of truth.

## Open questions / assumptions carried forward

- `docs/design/training-calendar.md` needs a redo pass (still describes a binary complete/skip flow) — designer's task, not blocking issue creation, but the calendar/day-detail issues should not be built against its current stale content.
- Strava token encryption/secrets-storage approach — deferred ADR, written when the Strava-sync epic starts implementation.
- Backfill job-status UX (poll vs. "populates over the next few minutes" messaging) — designer decision, not yet made.
