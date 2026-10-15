# Web v1 — requirements

> Bridge from `docs/planning/product-brief.md` to GitHub issues. Design input,
> not a status tracker — the project board is the tracker. Sourced from the
> brief, `docs/decisions/0002-web-app-stack.md`, and `docs/decisions/0003-template-source-anonymization.md`.

## Functional requirements

### Plan setup & personalization
*Serves: turn a relative, periodized template into the runner's own concrete numbers.*

- **FR1** — Runner selects one of the two available templates (club-style marathon, MCR 10-mile) to start a plan.
- **FR2** — Runner enters a recent race result (distance + time); system derives Recovery / Easy / Threshold / 10K / 5K / Interval paces (VDOT/Riegel-style equivalency).
- **FR3** — Runner enters a goal race time (marathon or half); system derives that goal pace directly (not equivalency-derived). *Distance set widened by FR30 (QA: Slice 1 alignment review); direct derivation of marathon/half goal pace is unchanged.*
- **FR3a** — Plan setup requires at least one of a recent result (FR2) or a goal time (FR3) before it can be submitted; submitting with neither is rejected (disabled submit control or inline validation error). This is a UI/product-level constraint only — the underlying pace-zone `calculate()` function still accepts neither input per its own contract; the flow around it now demands one.
- **FR4** — Recent-result-only: Marathon/Half goal pace stays unset until a goal time is entered; a recent result never sets or validates a goal pace. The goal zone's `label` is the goal's FR30 distance, and until FR31 is decided marathon goal pace resolves only when `label` is `marathon` and half-marathon goal pace only when it is `half`.
- **FR5** — Goal-time-only fallback: when no recent result has been entered, the other six zones (Recovery/Easy/Threshold/10K/5K/Interval) are derived from the goal time using the same VDOT/Riegel-style equivalency math as FR2, and are visibly flagged as aspirational / not based on demonstrated fitness. If a recent result exists, it remains the source for those six zones — the goal-derived values are only a fallback for when nothing else exists, never a competing source.
- **FR6** — System generates a personalized plan instance from the template, scaling daily prescriptions to the runner's derived peak-week volume (peak volume is computed from the template's own workouts, never entered manually). *Optional current weekly mileage (FR33) never changes how peak volume is computed; it can drive the stored scale-down factor (FR33).*
- **FR7** — Plan setup rejects a race date earlier than today. *Start-date handling for races less than a full plan length away is FR32.*
- **FR8** — Runner can view a personal pace-reference table (zone → concrete pace) alongside any workout's shorthand text.

> **Revision note (2026-09-28):** FR5 revised, and FR3a added, after #11 (pace-zone calculator) shipped and while #12/#14 (plan-setup flow) were mid-build. Original scoping had goal-time-only leave the six equivalency zones blocked entirely; Patrick decided a goal-derived, clearly-flagged aspirational fallback serves the product better — recent-result-derived paces still win whenever a real result exists, goal-derived is the fallback of last resort. Tracked in **#52**, which amends #11's scope on the same package without reopening #11 itself. FR3a codifies a related decision on the same in-flight flow: submitting plan setup with neither a recent result nor a goal time is now rejected outright, rather than left open by FR2/FR3's original "and/or" phrasing.

#### Plan setup refinements (from QA: Slice 1 alignment review)
*Serves: a first-time runner can set up a plan that fits their real race date, fitness, and goal without decoding the form. Sourced from the product owner's local test of Slice 1 `/setup` (milestone "QA: Slice 1 alignment review"). FR31-FR34 are decided by the product owner (tracked in #68 goal alignment, #69 start date, #70 weekly mileage, #71 pre-phase); rejected alternatives are noted in one line each. Two values remain pending and are marked.*

- **FR28 (input usability)** — The race-date control and the H/M/S time controls (recent result and goal time) are legible and usable without clipping: at a 320px-wide viewport and at 200% browser zoom, the "H", "MM" and "SS" placeholders and any entered two-digit value are fully visible (not truncated by the field width or by number-spinner chrome), and each control is operable by keyboard alone. The race-date control also shows the chosen date in long form next to the field, in the exact format "Sunday, October 18, 2026" (weekday, month, day, year), so the runner can confirm what they picked and tests can assert it. (Observed in Slice 1: the MM and SS fields clip; the race date is a bare native date input.)
- **FR29 (human-readable errors)** — Runner-facing validation copy for calculator errors is produced in `packages/pace-zones` as stable error `code`s with params plus a shared formatter, so web, iOS and Android do not each re-implement the wording. Times are h:mm:ss (or mm:ss), never a raw count of seconds. Each message names the field, the entered value, and the acceptable range, e.g. "A 5K time of 11:00 must be between 12:30 and 1:00:00." No runner-visible message contains "timeSeconds", an internal field path, or a whole-race time in raw seconds. Web-only form hygiene (H/M/S range checks) may stay in `apps/web` but follows the same wording rule. Control labels may still say Hours/Minutes/Seconds. (Observed in Slice 1: calculator messages read "timeSeconds for goal distance 'marathon' must be between 7260 and 28800 seconds (implausible goal time)".)
- **FR30 (goal distances)** — Goal time accepts 1 mile, 5K, 10K, 10 mile, half marathon and marathon (extends FR3's marathon/half). 1 mile is also added as a recent-result distance. The pace math supports 1 mile (the equivalency formula is continuous over distance); the mile is the weakest end of the range (about ±2 VDOT), so it is never a source for marathon goal pace (see FR31). Each distance has a plausibility range worded per FR29 (1 mile bounds proposed 3:40-15:00, data-scientist to confirm), and per FR5 a goal at any of these distances can seed the equivalency zones when no recent result exists. A recent result remains the preferred source for zones (FR5 precedence unchanged). *Contract:* the goal zone's `label` in the stored pace snapshot becomes the FR30 distance (today `"marathon" | "half"`); widening it is a stored-schema version bump in `packages/pace-zones` / `packages/plan-instance`. Until FR31 is decided, marathon goal pace resolves only when `label === "marathon"` (FR4 updated accordingly).
- **FR31 (goal-to-plan alignment)** — The runner can pick any FR30 goal distance regardless of the plan's race distance (e.g. a 5K goal on the marathon template). *Decided: Option C (hybrid).* Two pace tokens are affected:
  - **Marathon goal pace (MGP)** is predicted from the goal by equivalency and shown with an "Estimated" badge, plus a notice that the plan is a marathon plan and the pace is predicted. Adjustment from the goal distance: half marathon or 10 mile, no adjustment; 10K, +3%; 5K, +5%; 1 mile, never (no MGP from a mile goal; the token shows "MGP (not set)"). The badge clears only when the goal itself is a marathon goal. A recent result never sets or validates MGP (FR4 unchanged). Adjustment percentages are to be confirmed by the data-scientist.
  - **Half-marathon goal pace (HMGP)** comes from a half goal directly, or by equivalency from a 10 mile, 10K or 5K goal. It is never derived from a marathon goal or a 1 mile goal.
  - **Pace strip:** on Recovery and Easy run days whose workout text has no pace token, the day-detail pace strip falls back to the zone for the workout's tag, marked "Typical". This applies to those day types only.
  - Contract: pace snapshot and token resolution live in `packages/pace-zones`; the widened goal `label` is a stored-schema version bump (FR30).
  - *Considered and rejected:* Option A (derive MGP from any goal with no notice or badge distinction) and Option B (constrain each template to a goal at its own race distance).
- **FR32 (plan start and short runway)** — Runner can choose the plan start. Plan weeks are always whole 7-day blocks ending on the race weekday (no partial weeks, consistent with the race-weekday rotation), so start choices are valid week-start dates only. Rules:
  - The default full-length start is race date minus (template `totalWeeks` x 7 - 1) days. Week counts always come from the template's length (the marathon template and the MCR 10-mile template differ), never a hard-coded 18.
  - The runner chooses from valid week-start dates. The default is the first valid week start on or after today. The in-progress week (whose start may already be past) is also offered as an explicit choice, never a silent default. Today's behavior (early weeks rendered in the past with no warning) is removed.
  - Choosing a start that leaves fewer weeks than the template's full length means the plan starts mid-cycle. Setup shows a warning stating how many weeks are skipped and that the runner begins at week N of the template, and requires the runner to acknowledge the skipped weeks with a checkbox before "Create my plan" succeeds.
  - **Decided (tech-lead's technical call):** a mid-cycle start drops the earliest template weeks, so peak and taper stay aligned to race day (compressing would break cutback, long-run and taper ratios). The calendar keeps template numbering (e.g. "Week 8 of 18"). Dropped weeks are not part of the plan, so FR16 and FR25 backfill never covers them.
  - Two kinds of start are distinct. The **plan start** (template week N) can only move later than the full-length start, which drops more early weeks. A **calendar start earlier than the full-length start** exists only to host the FR34 pre-phase, never as extra template weeks.
  - A start after the race date, or a race date with no room for any plan week, is rejected with a plain-language message.
  - **Hard block (decided in principle):** setup blocks creating a plan when the runway is below the race distance's minimum plan length, with a plain-language message. The minimum depends on race distance: a per-distance minimum-weeks table (marathon about 8 weeks recommended), **values pending, to be set by the data-scientist and tech-lead on #69**. The mid-cycle warning and acknowledgement still fire whenever any weeks are skipped, above the block threshold too. *Considered and rejected:* a single fixed threshold for all distances; no block at all.
  - Storage: the chosen start becomes a stored field on the plan blob in `packages/plan-instance` (today the start is derived from the race date). Existing v1 blobs keep the current derivation; the field is persisted via a `schemaVersion` migration (ADR 0007, on #69).
  - Interacts with #61 (optional long-run weekday), which is on hold pending this QA triage.
- **FR33 (optional current weekly mileage and base warning; see also FR34)** — Setup has an optional field "Current weekly mileage" in miles per week (v1 is miles only). Rules:
  - Optional: leaving it blank never blocks setup and never changes the generated plan.
  - The **base** V is the run-mile volume of the first plan week the runner actually starts, derived from the template (`weeklyRunMiles`); it is not a new template field. On the club-style marathon template, week 1 is 32.5 mi (peak, week 14, is 42 mi), so V is 32.5 for a full-length start and higher for a mid-cycle start (roughly 35-40 mi at weeks 6-12).
  - If entered and below the base, setup shows a warning naming the first-week volume and the entered value, e.g. "Your first plan week is about 32.5 miles. You entered 15. Consider building your base first." The figure comes from the chosen start, not a hard-coded number in the form.
  - **Bands (pending confirmation by the data-scientist), with entered mileage m:** m >= 0.8 x V, no warning; 0.6 x V <= m < 0.8 x V, a warning; m < 0.6 x V, a strong warning the runner must acknowledge; below 10 miles per week, no automated remedy is offered (the runner is pointed to building a base first). The warning is never a block; the runner decides.
  - **Remedy (decided, MVP): warning plus scale-down.** When m is below the base, the runner may scale the plan down: a uniform factor between 0.7 and 1.0 applied to daily distances, written to the existing stored `scalar` field (today fixed at 1, widened to 0.7-1.0; not a second scaler). `peakWeekMiles` stays the unscaled template derivation (FR6). A scaled plan is visibly labeled as scaled and shows the factor. The base-building pre-phase is FR34 (fast-follow). *Considered and rejected for MVP:* warning only; offering scale-down and pre-phase together at launch.
  - The mileage value is stored on the plan blob and used only for the warning and, if chosen, the scale factor or pre-phase ramp.
- **FR34 (base-building pre-phase) — FAST-FOLLOW (decided).** If the runner's current weekly mileage (FR33) is below the base and spare time exists before the full-length start, setup can prepend a simple base-building block. Product owner's description: a front-loaded basic plan of incremental miles that ramps up each week and follows the general plan structure in terms of which days the runner runs. Not in MVP; its stored field is reserved in the same schema migration as FR32/FR33 so it needs no second migration. *Considered and rejected:* shipping it in MVP. Rules:
  - Offered only when current mileage is entered and below the base, and spare runway exists: weeks between the chosen calendar start and the full-length start (FR32). That runway is an earlier calendar start, never extra template weeks. The runner opts in; it is never added silently.
  - The pre-phase is available only with a full-length (week 1) start, so its target is template week-1 volume; a mid-cycle start has no pre-phase and does not inherit this target.
  - The block ramps from the entered current mileage toward week-1 volume, uses the run-day pattern of the instance's race-weekday-aligned weeks, and prescribes easy-effort running only (no quality workouts).
  - Ramp rate and safety bounds (maximum weekly increase, minimum/maximum block length, cutback weeks) are specified by the data-scientist before build; no number is set here.
  - Shown on the calendar as visibly distinct from the main plan weeks, and ends so that plan week 1 starts on the date computed by FR32.
  - **How the runway cases combine (FR32, FR33, FR34):** runway shorter than the template length means a mid-cycle start with a warning (FR32) and no pre-phase; runway equal to the template length means the plan only, with the FR33 warning and optional scale-down; runway longer than the template length means the extra weeks can host the pre-phase as an alternative or complement to scale-down.
  - Pre-phase days are generated in `packages/plan-instance` on the same stored blob (not a second store, not a new template). Whether it counts as part of the one stored plan or a separate block is the open technical question, resolved in ADR 0007 on #69.

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
- **NFR7 (usability of setup, QA: Slice 1)** — On `/setup`: 100% of validation messages are free of raw-seconds figures and internal field names (FR29), checked by a test over every error branch; setup controls render without clipping at 320px viewport width and 200% zoom (FR28); every new control (start date, weekly mileage) is keyboard-operable and has an associated visible label (WCAG 2.1 AA, consistent with NFR5).

No uptime/concurrency NFR is set for MVP — this is a single-user product for now; revisit once "Sign in with Strava" (FR27) is scoped for real, since that's the point multi-user load becomes possible.

## MVP cut line

**MVP (FR1–FR25, including FR3a, plus FR28–FR33 from the QA: Slice 1 review; FR33 = warning + scale-down):** the full core loop — pick a plan, get personal paces, see a personalized calendar, sync Strava, see real status, switch plans without losing history. No login; single-user by default. Nothing in this set is a coherent product with a piece removed. Within the QA additions, FR28 and FR29 are quick fixes; FR30 to FR33 need planning. The warnings stay MVP.

**Fast-follow (within v1, before beta):** FR26 (Google Calendar push), FR27 (Sign in with Strava) + NFR6; FR34 (base-building pre-phase; decided fast-follow).

**Later (not this milestone):** native iOS/Android, general plan-import/parsing to scale the template library beyond the two hand-built templates.

## Data collected

Minimal-collection pass per `CLAUDE.md`'s privacy principle:

- **Plan start date (FR32) and current weekly mileage (FR33)** — training attributes, not PII: neither identifies a person, both stored in the plan blob, keyed by the opaque plan `id` (no `user_id` exists in the on-device store). Mileage is optional and stored only in the plan blob to drive the base warning (and scaling or the pre-phase ramp if chosen). No analytics until an event store exists; then mileage is reported only as a bucketed ratio to the plan's first-week volume, never raw. No new-PII ADR (confirmed by tech-lead on PR #64); the stored-shape change gets an architecture ADR (0007).
- **Race result (distance + time) / goal race time** — not identifying; keyed by the opaque plan `id` in the on-device blob. Per FR5, the goal time is also reused (no additional field collected) to derive the six equivalency zones as an aspirational fallback when no recent result exists.
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
- **Pending (QA: Slice 1):** (1) FR32 per-distance minimum-weeks table for the hard block, set by data-scientist and tech-lead on #69 (marathon about 8 weeks recommended); (2) FR33 warning-band confirmation by the data-scientist (#70).
- Stored plan schema bump (start date, mileage, `scalar` widened to 0.7-1.0, widened goal `label`, reserved pre-phase field): architecture ADR 0007, written on #69.
