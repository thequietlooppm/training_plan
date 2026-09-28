# Design spec — Plan setup flow (template, race date, race result / goal
time, pace zones)

> Owned by `@designer`. Status: **ready for implementation** — scoped against
> issues #12 and #14, FR1–FR8 in `docs/planning/web-v1-requirements.md`, and
> the shipped `@training-plan/pace-zones` calculator (#11). Companion doc:
> `docs/design/ui-toolkit.md` (updated alongside this spec with the newly
> adopted shadcn primitives).
>
> No standalone HTML wireframe this time (see §4) — the ASCII wireframes below
> plus the state table carry the nuance; this screen's craft is in field
> states and copy, not a novel layout, so a throwaway HTML mock didn't earn
> its cost the way the calendar's week-grid did.
>
> **Note on sourcing:** I read #12/#14's acceptance criteria as summarized in
> the task brief and cross-checked them against `docs/planning/
> web-v1-requirements.md` (FR1–FR8), `docs/decisions/0005-plan-template-
> schema.md`, and the shipped `packages/pace-zones` source/README — I did not
> have shell/`gh` access in this session to pull the live issue bodies
> directly. If either issue's actual AC text diverges from FR1–FR8 as
> written, flag it back to me; nothing here is set against different intent.
>
> **Revision (2026-09-28):** incorporates three changes from Patrick's review
> of the HTML mockup built against this spec — (1) replaces the mockup's
> terminal-reading visual direction (green accent, all-mono inputs, near-
> black chrome — none of which was actually specified below, which is the
> bug) with a concrete warm, consumer-app palette and a typography split that
> confines monospace/tabular figures to the §7 pace numbers only (§2,
> §6.1–6.3, and `docs/design/ui-toolkit.md`'s new Color palette + rewritten
> Font sections); (2) hard-requires at least one of recent-result/goal-time
> on submit, resolving §11's old open question #1 (§4, §5.9, §6.3, §11); (3)
> reflects the goal-time-derived equivalency-zone fallback + its warning
> banner/badge, per new issue #52 (§5.8, §7.2–7.4, §6.2, §9). I did not have
> `gh` access this session either — the exact warning copy quoted below is
> the copy relayed to me verbatim in the task brief as "already finalized by
> data-scientist" on #52; I did not rewrite it. Untouched by this revision:
> §1, §3 (still one page, no wizard), the H/M/S time-entry format, the native
> race-date input, and the template-picker RadioGroup-as-cards call.
>
> **Revision (2026-09-28, later same day) — aligned to Tempo, the named
> product-wide design system.** This screen's color/type correction (above)
> was the *seed* of what `ui-toolkit.md` now generalizes into **Tempo**, a
> single system every screen pulls from (also applied fresh to
> `docs/design/training-calendar.md` and the new `docs/design/
> strava-connect-settings.md` in the same pass). Nothing in this doc's actual
> design direction changes — it was never screen-local in practice, just
> framed that way in prose. Two things worth noting so this doc doesn't read
> stale next to the new source of truth:
> - **The accent hex is corrected in `ui-toolkit.md`, not here.** This doc
>   never hardcoded a hex (it always deferred to "exact token in
>   `ui-toolkit.md`," §2/§6.1) — good, because the placeholder that lived
>   there (`#D9730D`) turned out to fail 4.5:1 text contrast on verification.
>   The corrected token is `accent/solid: #C2410C`. Nothing to fix in this
>   file; the indirection did its job.
> - **Type roles now have names** — where this doc says "the app's chosen
>   humanist sans" or "the numeral/mono face," those map onto Tempo's named
>   type scale: page title = **H1**, "Your pace zones" = **H2**, section
>   legends/field labels = **Label**, the §7 pace-column digits = **Numeral
>   (table)**. Same typefaces (Figtree / IBM Plex Mono), same rule (numeral
>   face confined to a genuine comparison column, never an input), just named
>   now instead of described inline each time. No layout or copy change
>   follows from this — it's a vocabulary alignment, not a redesign.

---

## 1. What this screen is

The first data-entry screen in the app: a runner picks a template, gives the
race date they're training for, and enters a recent race result and/or a
goal time. Submitting runs the pace-zone calculator (#11) client-side and
shows their 7 personal pace zones (#14) right there on the page.

**In scope:** template pick, race-date entry + past-date rejection, recent
race result entry, goal time entry, calling `calculate()`, displaying the
result (success or validation error) inline, no navigation away.

**Out of scope (explicitly deferred):**
- Generating/persisting an actual plan instance (#13) — submitting this form
  computes and displays pace zones only; nothing is saved anywhere.
- Anything that reads the race date besides "reject if before today" — it's
  captured for #13, not consumed here.
- A second real template (MCR 10-mile, #10) — design for an arbitrary-length
  template list, but today it will render with exactly one option.
- Accounts/login — single-user, no persistence, no "saved" affordance.
- Where this screen mounts in the route tree (root vs. `/setup`, and what
  happens to `HomePage`'s health-check card) — routing is a tech-lead/swe
  call, not designed here.

---

## 2. Look and feel — references

Different job than the calendar screen: this is a short, one-time input form
that ends in a personal numeric result, not a longitudinal view. The closest
real-world patterns are race-time calculators and zone-settings pages, not
training calendars.

| App / tool | What it does well | Borrow | Skip |
|---|---|---|---|
| **Garmin Connect — Race Predictor / Pace Calculator** | One flat form: pick a recent result, hit calculate, see results appear on the *same* screen, no page transition. | The single-page, no-navigation shape; results rendering inline, instantly, right below the input — there's no "loading your results" step because the math is local. | The surrounding dashboard chrome (widgets, cards competing for attention) and the way Garmin scatters this feature three menus deep — ours should be the front door, not buried. |
| **VDOT-style calculators (Daniels/McMillan-derived web tools)** | The actual output shape we're building: one race result in, a table of training-pace zones out, in plain zone-name → pace rows. | The zone-name-then-pace row pattern itself — it's the direct ancestor of our #14 table. | Most of these show paces at *every* distance for *every* zone (a dense grid) — information overload for a first pass; we show one pace per zone, not a matrix. Also skip the ad-heavy, tiny-type presentation typical of these tools. |
| **TrainingPeaks — "Zones" settings page** | Frames zones as a small reference table with a short one-line purpose per zone ("Zone 2 — aerobic base"), so a runner unfamiliar with the jargon still gets it. | The one-line "what this zone is for" caption per row — we use this for Recovery/Easy/Threshold/etc. so the table teaches, not just reports. | TrainingPeaks makes zones *editable* (drag boundaries, multi-sport HR/power zones) — over-engineered for v1; ours are read-only, derived, not tunable. |
| **Runna — onboarding "recent time" / "goal time" step** | Distance-then-time input feels native on a phone; forgiving of partial entry (doesn't demand leading zeros); goal-time ask is clearly optional and separate from the fitness-benchmark ask. | The distance-first-then-time sequencing, and treating "recent result" and "goal time" as two distinct, independently-optional asks rather than one blended field. | Runna's onboarding is a multi-screen wizard with progress dots and paywall gates mid-flow — wrong shape for a one-shot, no-login utility (see §3 for why we reject the wizard here). |

### Direction (one paragraph)

This is a **calculator, not an interview** — one page, sections stacked
top-to-bottom (template → race date → recent result → goal time → submit),
answered in whatever order the runner wants, with the result appearing
inline the instant they submit, Garmin-Predictor-style, because the math is
free, local, and synchronous — there's nothing to justify a multi-step wizard
or a network spinner. The two race-result/goal-time sections are visually
equal-weight and explicitly optional (per FR4/FR5, either alone is enough);
neither is disguised as more "correct" than the other. The #14 pace table
borrows the zone-then-one-line-purpose row from TrainingPeaks' zone settings,
so a runner who's never heard "VDOT" still understands what Threshold pace is
*for*, not just what number it is.

### Principles

- One page, no wizard, no page transition between "entering data" and
  "seeing results" — see §3 for the explicit call against a wizard.
- Recent result and goal time are peers: neither section is emphasized over
  the other; both are optional; "and/or" is real, not a soft nudge toward one
  — but at least one of the two is *required* overall, enforced at submit
  (§4/§5.9), not a suggestion.
- The pace table teaches the zone, not just states the number — every row
  gets a one-line "what it's for" caption.
- Nothing here is saved. No "saved" copy, no unsaved-changes warning.
- Blocked/unset table rows explain *why* and *what unlocks them* — never a
  bare "N/A" or "—".
- Numbers earn special typographic treatment only where they're compared in
  a column (the §7 results table's pace figures — Tempo's Numeral (table)
  role); everywhere else, including every input field, is the plain body
  face — see below.

### Color & typography — steering away from "terminal"

The first HTML mockup built from this spec read as a CLI tool: a green
accent, heavy monospace set on every input field, and a near-black sticky
bar. None of that was actually specified above — that's the bug. This
section left color and type unstated, and a builder filling that gap
defaulted to developer-tool conventions. This is a consumer running
calculator, not a terminal; it should sit closer to Strava or Hevy in tone.

| App / tool | What it does well | Borrow | Skip |
|---|---|---|---|
| **Strava (web + app)** | One confident warm accent color used sparingly (CTAs, active/selected states) against an otherwise neutral, mostly-white surface; body type is a plain humanist sans, never mono, even in dense stat blocks. | The restraint — one accent color, reserved for the submit button and selected/active states only, never a background wash; a neutral surface that's neither stark white nor near-black. | Strava's marketing pages lean on big photography and gradient overlays for hero sections — irrelevant here; this screen has no imagery and no gradients anywhere. |
| **Hevy (workout logging app)** | A dense, numbers-heavy input form (sets/reps/weight) that still reads as approachable, not technical — every input field uses the plain body typeface; numerals get column alignment (tabular figures) only inside the logged-sets *output* table, never on the entry fields themselves. | The exact split this doc needs to state explicitly: **input fields use the body typeface; only the output/results table gets tabular-aligned digits.** | Hevy's rest-timer countdown treatment — not relevant, nothing here counts down. |
| **Garmin Connect / Strava — lap & split tables** | Split-time tables (mm:ss per lap) align digits column-to-column using tabular/monospaced figures, because misaligned digits in a column of comparable times are genuinely harder to scan — a real, non-decorative reason to reach for mono, confined to that one data table. | The *reason* to use tabular digits at all: a table of comparable numbers being read down a column, not an input field. Direct precedent for confining mono/tabular treatment to §7's pace-number column only. | The rest of Garmin Connect's UI chrome (dense, three-menus-deep, widget-heavy dashboard) — already flagged to skip above. |
| **Whoop (app)** | Uses a single warm accent (coral/red) against light and dark neutral surfaces, and spends that accent on exactly one job per screen — the primary metric or CTA — leaving everything else greyscale. | The "one accent, one job" discipline — here, that job is the submit button, selected/active states, and the "Estimated" badge/warning treatment (§7.2), not decoration elsewhere. | Whoop's dark-mode-first presentation and heavy data density (recovery score, strain, multiple rings) — this screen has none of that complexity and shouldn't borrow the visual weight that comes with it. |

**What this explicitly rules out:** green as the accent color (reads as a
terminal/CLI "success" hue, and this screen has no pass/fail semantic that
needs it — that semantic exists elsewhere now, on the calendar's completion
status, and it's handled there deliberately, not inherited here); a
near-black background or chrome anywhere — there is no "demo bar" or dark
shell on this screen in light mode (dark mode itself is now specced in
`ui-toolkit.md`, but it's a considered warm-neutral near-black, not a flat
terminal `#000`, and applies uniformly, not as screen-specific chrome); and
monospace on any *input* — the H/M/S time fields, the race-date input, the
distance `Select` — all of it is body typeface, normal weight, same as every
other field in the app. Monospace/tabular figures are reserved for **the
pace numbers in the §7 results table only** (and any future compact/inline
reuse, §7.4) — a legitimate alignment convention borrowed from lap/split
tables, not a stylistic accent applied everywhere. See §6.2/§6.3 for where
this lands on the actual component/copy tables.

Also steering clear of the *other* failure mode — AI-generated-demo
clichés — per the brief: no warm-cream-and-terracotta-with-serif (wrong
register: that's "editorial blog," not "calculator"); no near-black-plus-
neon-accent (that's the terminal look already being removed); no purple/blue
gradient anywhere (flat, neutral `Card` surfaces only, per §6.1); and no
reflexive Inter/Space Grotesk pick — see the concrete font choice below.

**Decided in `docs/design/ui-toolkit.md`** (the **Tempo** color system and
type scale) rather than only here, since both apply beyond this one screen —
the training-calendar and Strava-settings specs inherit them, they don't
re-litigate them. As it lands on this screen specifically:

- **Surface:** neutral off-white `Card`s (`surface/card`, Tempo) on a very
  light neutral page background (`surface/page`). No dark chrome anywhere on
  this screen in light mode.
- **Accent:** one warm color — `accent/solid`, `#C2410C` (Tempo; corrected
  from this doc's earlier placeholder, see the top-of-file revision note) —
  spent only on the submit button, selected/active states (template-card
  selection, the goal-time distance toggle's active segment), and the
  "Estimated" badge/warning treatment (§7.2) — never as a background wash.
- **Body/UI typeface:** Figtree (Tempo's Body/Label/H1/H2 roles) on every
  heading, label, helper string, and **every input field**, including the
  H/M/S time inputs and the race-date input.
- **Numeral alignment:** IBM Plex Mono, tabular figures, **only** on the §7
  pace-zone table's pace column (Tempo's Numeral (table) role) and its
  future compact reuse (§7.4) — never on an input field, per the
  Hevy/Garmin-splits reasoning above.

---

## 3. Flow decision: one page, not a wizard

**Call: single page with stacked sections, not a multi-step wizard.**

Why, given the actual goal ("something to play with fast," not maximum
polish):

- **The expensive part of a wizard — gating "next" behind per-step
  validation, tracking step position, back/forward transitions — buys
  nothing here.** There's no dependency between sections (template pick
  doesn't need race date, race date doesn't need a race result); a wizard
  would impose a false sequence on genuinely independent fields.
- **The whole point of "and/or" (FR2–FR5) is that the runner can skip a
  section.** A wizard's per-step "next" button makes skipping feel like a
  deliberate detour ("Skip this step?"); a single page with two visibly
  optional sections makes skipping the *default* reading of the screen.
- **The result needs to feel free and instant** (Garmin Predictor,
  above) — because it genuinely is: `calculate()` is synchronous and local,
  so "submit → see it right there, same screen" is both the simplest build
  and the most honest representation of what's actually happening (no
  network round-trip to hide behind a step transition).
- A wizard would earn its cost if later steps depended on earlier answers
  (e.g., a template's own weekly volume changing what's asked next) — that's
  not the case for #12/#14's scope.

One page also means "submitting" here is a plain button, not a route change:
validation errors and results both render **in place**, on the same page,
with no navigation to undo if the runner wants to tweak an input and
resubmit.

---

## 4. User flow

### Entry point

- However this screen is routed (see §1's out-of-scope note), the runner
  lands on it with every section empty except the template picker, which is
  pre-selected to its first (today: only) option — see §5.3 for why
  pre-selecting is the right call with a single template.

### States

```
                    ┌───────────────────────────────┐
  entry ───────────▶│  Plan setup (single page)     │
                    │   ├─ templates: loading         │
                    │   ├─ templates: error           │
                    │   └─ templates: loaded (form)   │
                    └───────────────────────────────┘
                                  │
                     fill any/all of: race date,
                     recent result, goal time
                                  │
                     trigger: tap "Calculate my pace zones"
                                  │
                    ┌─────────────┴─────────────┐
                    │                             │
          client-side validation fails   client-side validation passes
          (race date in the past, an          → calculate(input) runs
           incomplete result/goal              (synchronous, local)
           section, or BOTH result and              │
           goal sections left            ┌─────────────┴─────────────┐
           completely empty — §5.9)       │                             │
                    │                     │                             │
                    ▼                ok: false                     ok: true
        inline field error(s) or     (implausible time /           → §14 table
        a summary Alert (§5.9),      below-table VDOT)              renders/
        focus moves to the first           │                        updates below
        invalid field, or to the     inline error near the           the form,
        summary Alert when the       offending section, focus         aria-live
        error isn't attributable     moves there. Previous            "Pace zones
        to one field (§5.9, §8).     results (if any) are             updated."
        No calculate() call made.    left exactly as they were.
                    │                      │                             │
                    └──────────────────────┴─────────────────────────────┘
                                  edit any field → resubmit (same page, repeat)
```

### Flow — happy path

1. Runner arrives; template is pre-selected (only one exists today); race
   date, recent-result, and goal-time sections are empty.
2. Runner optionally changes the template (once #10 exists), enters a race
   date, and fills **either or both** of the recent-result / goal-time
   sections.
3. Trigger: taps **"Calculate my pace zones"**.
4. Client-side checks run first: race date not in the past; each touched
   result/goal section is either fully filled or fully empty (§5.2/§5.3);
   and **at least one of the two sections is fully filled** (§5.9 — resolves
   §11's former open question). Any failure stops here: inline error(s) or a
   summary `Alert` (whichever §5.9/§8 calls for), focus moved accordingly,
   `calculate()` is never called.
5. If client-side checks pass, `calculate()` runs with whatever of
   `recentResult`/`goalTime` was fully filled (either or both — "neither" can
   no longer reach this step, per #4 above).
6. `ok: true` → the §14 pace-zone table appears (first submit) or updates
   in place (subsequent submits) directly below the form, same page, no
   scroll-jump unless it's off-screen (smooth-scroll into view, respecting
   `prefers-reduced-motion`). A polite live region announces "Pace zones
   updated."
7. `ok: false` → an inline error renders near the section that produced it
   (§6.4 maps `errors[].path` to a location); any previously-shown table from
   an earlier successful submit is left untouched — a bad edit never erases
   a good prior result.
8. Runner can edit anything and resubmit indefinitely. No save, no exit
   state — the runner just navigates away (or on to #13, later) when done.

### Exit points

- None designed here beyond "navigate elsewhere" — there is no completion
  action beyond seeing the numbers, per the out-of-scope line in §1.

---

## 5. Wireframes

ASCII only (see the note at the top of this doc for why). All states drawn;
mobile-width shown, desktop noted where it differs (§6.5).

### 5.1 Initial state — one template, nothing entered yet

```
┌─────────────────────────────────────┐
│ Set up your plan                     │  h1
├─────────────────────────────────────┤
│ Plan                                 │  section legend
│ ┌───────────────────────────────┐   │
│ │ ◉ Club-Style Marathon          │   │  radio-card, PRE-SELECTED
│ │   Training Plan                │   │  (only option today)
│ │   Marathon · 18 weeks          │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ Race date                            │
│ The date of the race you're          │  helper text
│ training for.                        │
│ [ yyyy-mm-dd            ▾ ]          │  native date input
├─────────────────────────────────────┤
│ Recent race result   (optional)      │
│ Have a recent race time? Use it to   │
│ derive your other training paces.    │
│ Distance  [ Select a distance  ▾ ]   │
│ Time      [ H ] : [ MM ] : [ SS ]    │  3 number inputs
├─────────────────────────────────────┤
│ Goal time   (optional)               │
│ Have a target time for this race?    │
│ Distance  ( Half )  ( Marathon )     │  2-segment toggle
│ Time      [ H ] : [ MM ] : [ SS ]    │
├─────────────────────────────────────┤
│      ┌─────────────────────────┐    │
│      │  Calculate my pace zones │    │  primary button, full width
│      └─────────────────────────┘    │
└─────────────────────────────────────┘
```

### 5.2 Race-date error (submitted with a past date)

```
│ Race date                            │
│ [ 2024-01-01            ▾ ]          │  aria-invalid="true"
│ ⚠ Race date can't be in the past.    │  inline error, focus moved here
```

### 5.3 Incomplete-section error (distance picked, time left blank)

```
│ Recent race result   (optional)      │
│ Distance  [ 10K               ▾ ]   │
│ Time      [   ] : [   ] : [   ]     │
│ ⚠ Enter a time for your recent       │
│   result, or clear the distance.     │  inline error, focus → Hours field
```

### 5.4 Implausible-time error (`calculate()` returns `ok: false`)

```
│ Recent race result   (optional)      │
│ Distance  [ 5K                ▾ ]   │
│ Time      [ 0 ] : [ 05 ] : [ 00 ]   │  5:00 5K
│ ┌───────────────────────────────┐   │
│ │ ⚠ timeSeconds for '5k' must   │   │  Alert, destructive variant,
│ │   be between 750 and 3600     │   │  tied to path "recentResult.
│ │   seconds (implausible race   │   │  timeSeconds" — message is
│ │   time)                       │   │  calculate()'s own text, verbatim
│ └───────────────────────────────┘   │
```

### 5.5 Below-table-VDOT error (a real message the calculator already ships)

```
│ ┌───────────────────────────────┐   │
│ │ ⚠ This result derives a VDOT  │   │  Alert, path "recentResult"
│ │   of 24.3, below the          │   │  (section-level, not one field —
│ │   supported table range       │   │  see §6.4)
│ │   (VDOT 30+). Try a faster    │   │
│ │   recent result, or a         │   │
│ │   longer/more standard race   │   │
│ │   distance.                   │   │
│ └───────────────────────────────┘   │
```

### 5.6 Results — both recent result and goal time provided (all 7 rows live)

```
│ Your pace zones                      │  h2, results section
│ ┌───────────────┬───────────────┐   │
│ │ Recovery       │      9:10 /mi │   │
│ │ Easiest effort — recovery days│   │
│ │ and warm-up/cooldown.         │   │
│ ├───────────────┼───────────────┤   │
│ │ Easy           │      8:15 /mi │   │
│ │ Comfortable, conversational — │   │
│ │ most of your weekly mileage.  │   │
│ ├───────────────┼───────────────┤   │
│ │ Threshold      │      7:05 /mi │   │
│ │ Sustained "comfortably hard"  │   │
│ │ — tempo runs.                 │   │
│ ├───────────────┼───────────────┤   │
│ │ 10K            │      6:48 /mi │   │
│ │ Hard, sustained race effort.  │   │
│ ├───────────────┼───────────────┤   │
│ │ 5K             │      6:30 /mi │   │
│ │ Faster than 10K — short, hard │   │
│ │ repeats.                      │   │
│ ├───────────────┼───────────────┤   │
│ │ Interval       │      6:10 /mi │   │
│ │ Fastest repeatable pace, with │   │
│ │ recovery between reps.        │   │
│ ├───────────────┼───────────────┤   │
│ │ Goal — Marathon│      7:30 /mi │   │
│ │ Your target race pace.        │   │
│ └───────────────┴───────────────┘   │
```

(All six equivalency zones here have `source: "recentResult"` — recentResult
takes priority over the goalTime fallback whenever both are provided, per
#52. No warning banner, no "Estimated" badges — see §7.2.)

### 5.7 Results — recent result only (Goal row unset)

```
│ … six rows identical to 5.6 …        │
│ ├───────────────┼───────────────┤   │
│ │ Goal           │  Add a goal   │   │
│ │ Your target race pace.        │  time above to see this.       │
│ └───────────────┴───────────────┘   │
```

(Same as 5.6: all six equivalency zones have `source: "recentResult"`; no
warning banner, no badges. Only the Goal row is `unset` here — see §7.2.)

### 5.8 Results — goal time only (six equivalency zones goal-derived, with warning)

```
│ Your pace zones                      │
│ ┌───────────────────────────────┐   │
│ │ ⓘ These paces are estimated   │   │  Alert, info/warning variant
│ │   from your goal time, not a  │   │  (not destructive) — section-
│ │   race you've run. If that    │   │  level, once, above all seven
│ │   goal is ambitious, expect   │   │  rows (equivalently: above the
│ │   all of them — especially    │   │  six equivalency rows, since
│ │   Interval and 5K — to run    │   │  Goal is the 7th/last row —
│ │   faster than your current    │   │  §7.1's fixed order)
│ │   fitness supports. Add a     │   │
│ │   recent result above for     │   │  "above" is a real jump-link,
│ │   paces based on what you've  │   │  same target/behavior as
│ │   actually run.                │   │  §7.2's goal-unset jump-link
│ └───────────────────────────────┘   │
│ ┌───────────────┬───────────────┐   │
│ │ Recovery [Estimated]│  9:10/mi│   │  real number + Badge, source:
│ │ Easiest effort…│              │   │  "goalTime" — NOT blocked
│ ├───────────────┼───────────────┤   │
│ │ Easy     [Estimated]│  8:15/mi│   │
│ ├───────────────┼───────────────┤   │
│ │ Threshold[Estimated]│  7:05/mi│   │
│ ├───────────────┼───────────────┤   │
│ │ 10K      [Estimated]│  6:48/mi│   │
│ ├───────────────┼───────────────┤   │
│ │ 5K       [Estimated]│  6:30/mi│   │
│ ├───────────────┼───────────────┤   │
│ │ Interval [Estimated]│  6:10/mi│   │
│ ├───────────────┼───────────────┤   │
│ │ Goal — Half    │     8:00 /mi │   │  direct division of the
│ │ Your target race pace.        │   │  entered goal — no badge,
│ └───────────────┴───────────────┘   │  goal is never a "fallback"
```

This replaces the old (pre-#52) "six equivalency rows blocked" wireframe —
that state can no longer occur: a goal time alone now computes real numbers
for all six equivalency zones (`source: "goalTime"`), flagged with the
warning banner + per-row "Estimated" badge rather than withheld. See §7.2
for the full state breakdown and the exact (data-scientist-authored) copy.

### 5.9 Submit blocked — neither recent result nor goal time entered

```
│ ┌───────────────────────────────┐   │
│ │ ⚠ Enter a recent race result  │   │  Alert, destructive variant,
│ │   or a goal time to calculate │   │  tabindex="-1" role="alert" —
│ │   your pace zones.            │   │  same summary-Alert mechanism
│ └───────────────────────────────┘   │  as §6.4's multi-error case
├─────────────────────────────────────┤
│ Recent race result   (optional)      │  ← focus moves here
│ Distance  [ Select a distance  ▾ ]   │
│ Time      [   ] : [   ] : [   ]     │
├─────────────────────────────────────┤
│ Goal time   (optional)               │
│ Distance  ( Half )  ( Marathon )     │
│ Time      [   ] : [   ] : [   ]     │
└─────────────────────────────────────┘
```

No results table renders — `calculate()` is never called, same as §5.2/
§5.3. Both sections' legends still read "(optional)" and don't change: each
is still individually optional (either alone is enough, per FR4/FR5); the
constraint this Alert enforces is that they can't *both* be empty at once.
This replaces the old "neither entered, submitted anyway (valid but empty)"
success-path wireframe — Patrick's review resolved §11's open question:
submitting with both empty is now **rejected**, not a soft, non-blocking
hint. See §4 for where this check sits relative to the other client-side
checks, and §8 for the focus-management rule this reuses.

### 5.10 Future state — two templates (once #10 ships)

```
│ Plan                                 │
│ ┌───────────────────────────────┐   │
│ │ ◉ Club-Style Marathon          │   │
│ │   Training Plan                │   │
│ │   Marathon · 18 weeks          │   │
│ ├───────────────────────────────┤   │
│ │ ○ MCR 10-Mile Training Plan   │   │  same card component, no
│ │   10 Mile · N weeks            │   │  layout change needed —
│ └───────────────────────────────┘   │  confirms the "design for
│                                       │  arbitrary length" requirement
```

### 5.11 Template list — loading / error (fetch mechanism is not this doc's call)

```
loading:                              error:
│ Plan                          │     │ Plan                          │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            │     │ ⚠ Couldn't load plan templates │
│ ▓▓▓▓▓▓▓▓▓▓▓▓                    │     │   [ Try again ]               │
```
(Skeleton/error pattern reused verbatim from `HomePage.tsx`'s existing
loading/error convention — see §6.2.)

---

## 6. Look-and-feel + interface detail

### 6.1 Layout & spacing intent

- Single scrolling column, centered, `max-w-2xl` (wider than `HomePage`'s
  `max-w-sm` status card — this screen has real form density) — matches the
  existing Card-based visual language rather than introducing a new shell.
- Each section (Plan / Race date / Recent race result / Goal time / Results)
  is its own `Card`, stacked with consistent vertical gap — same rhythm
  `HomePage.tsx` already establishes (`CardContent` padding, `gap-3`/`gap-6`
  scale). No sidebar, no multi-column form on any breakpoint (see §6.5) —
  the "one page" call in §3 extends to layout, not just navigation.
- "(optional)" is set in the section legend itself (Tempo's Label role),
  muted, right next to the section title — not a separate line, not a
  tooltip. It's the first thing read alongside the heading, matching how the
  section's *actual* optionality should read.
- Results table: numeric pace column right-aligned, **tabular figures**
  (Tempo's Numeral (table) role) — the one place on this screen where
  numerals get a distinct numeral typeface from the rest of the UI (see the
  Color & typography subsection of §2, and `ui-toolkit.md`'s Type scale
  section). Same "numbers earn it only in a comparison column" convention
  the calendar spec now states explicitly too.
- Every `Input` — race date, the three H/M/S time fields, anything else — is
  set in Tempo's Body role, **not** the Numeral role used in the results
  table. This is the one thing the first mockup got backwards (mono on every
  input); see §2 for the full reasoning.
- Blocked/unset pace cells are muted but never below 4.5:1 (§7) — they read
  as "not yet," not as disabled/greyed-out-to-illegibility. Goal-derived
  ("Estimated") pace cells are **not** muted — they're a real, fully-legible
  number, just badged (§7.2).

### 6.2 Component mapping

Stack is decided (ADR 0002: React + Vite, Tailwind, shadcn/ui, Lucide) — no
"if React" framing needed, matching how `ui-toolkit.md` already presents this
as settled.

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Whole form | `Form` (react-hook-form + zod resolver) | **New adoption** — first form with real multi-field, cross-field validation in the repo. See "Form: recommendation" below for the trade-off. |
| Section container | `Card` / `CardHeader` / `CardContent` | Reused from `HomePage.tsx`. |
| Template radio-card list | `RadioGroup` + `RadioGroupItem`, each item styled as a card (custom label wrapper) | **New primitive (`RadioGroup`), custom card styling.** Container/keyboard behavior is the library; the "looks like a card, shows title + distance + weeks" layout inside each item is bespoke — same split the calendar spec used for its accordion week-block. |
| Race date | `Input type="date"` | Native date picker, not a Calendar/date-picker component — see "Race date: recommendation" below. Body typeface — not the results table's numeral face (§2). |
| Distance select (recent result, 6 options) | `Select` | Standard. |
| Distance toggle (goal time, 2 options) | `RadioGroup` styled as a 2-segment toggle (reuses the same primitive as the template picker, different CSS) | Two options read better as a segmented toggle than a dropdown; no new primitive needed. |
| Time entry (H / M / S) | 3× `Input type="number" inputMode="numeric"` inside a `fieldset` with a visually-hidden or visible `legend` | **New custom composite**, `TimeInputGroup` — see "Time entry: recommendation" below. Not a shadcn primitive; assembled from `Input` + `Label`. Body typeface on all three fields — this is exactly the input the first mockup incorrectly set in mono; see §2. |
| Field / section error text | `Form`'s `FormMessage` (field-level) or `Alert` (destructive, section-level for a `calculate()`-returned error with no single field to attach to, **or for the pre-`calculate()` "at least one section required" check, §5.9**) | New adoption: `Alert`. See §6.4 for the path→location mapping. |
| Goal-derived pace warning banner (§7.2) | `Alert` (info/warning variant, **not** destructive) | New use of the already-adopted primitive — renders once, above the results table, whenever any equivalency zone's `source` is `"goalTime"`. Not an error: this is a real, usable number, just flagged as an estimate. |
| "Estimated" badge on goal-derived equivalency rows (§7.2) | `Badge` (already adopted for template metadata) | New usage of the same primitive — plain visible text "Estimated"; a native `title` attribute plus a visually-hidden (`sr-only`) span carry the fuller explanation. No new tab stop — see "Badge tooltip: recommendation" in §7.2. |
| Submit button | `Button` (default variant, full width on mobile) | Reused from `HomePage.tsx`. Accent color (§2, Tempo `accent/solid`) applies here. |
| Results table (#14) | `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` | **New adoption.** See §7 for the full component spec. |
| Template distance/weeks metadata on each card | `Badge` | **New adoption** — small "Marathon · 18 weeks" tag, reused later for any other short metadata tag in the app (and now also reused for "Estimated", above). |
| Template list loading / error | `Skeleton`, plain error block + `Button` | Reused verbatim from `HomePage.tsx`'s existing pattern — do not invent a new loading/error convention here. |
| Live-region result confirmation | inline `aria-live="polite"` region (no toast) | Matches the calendar spec's "inline is enough for v1" call. |
| Icons | Lucide: `alert-triangle` (error, reused from `HomePage.tsx`), `info` (non-blocking/warning `Alert`s, including the goal-derived warning banner), `circle`/`circle-check` (radio states, usually supplied by the primitive itself) | One set, consistent with `ui-toolkit.md`. |

**Form: recommendation.** shadcn's `Form` wraps `react-hook-form` +
`zod` (neither is in `apps/web/package.json` yet — this adds two
dependencies). It buys: per-field `register`/`Controller` wiring,
`FormMessage`/`FormDescription` components already styled and already
`aria-describedby`-wired to their field, and a `zodResolver` that composes
cleanly with `calculate()`'s own Zod schemas for the parts that overlap
(distance enums, `timeSeconds` bounds can be mirrored client-side for instant
feedback before ever calling `calculate()`). Cost: two new deps, and
`react-hook-form`'s uncontrolled-by-default model to learn if this repo
hasn't used it. **Alternative:** hand-rolled `useState` per field + manual
validation functions — zero new deps, more boilerplate, and every
field/error-association has to be wired to ARIA by hand instead of getting it
from `FormMessage`/`FormControl` for free. Given this form has real
multi-field, cross-field, and server-shaped (`errors[].path`) validation to
reconcile, `Form` is the better trade here — but it's a real dependency
add, so flagging it explicitly rather than silently assuming it's free.

**Race date: recommendation.** Native `<input type="date">` (via `Input`),
not `react-day-picker`/`Calendar`. This is one date, no range, no need to see
a month grid to pick it — a native date input already gives an OS-tuned
picker on every mobile platform for free. **Alternative:** shadcn
`Popover` + `Calendar` — heavier (a full month-grid component) for a job a
native input already does; that combination is *earned* on the training-
calendar screen (which needs a real calendar view anyway per its own spec)
but not here. Cost of the native input: inconsistent chrome across browsers
(Firefox/Safari/Chrome render the picker differently) — accepted for v1;
revisit only if that inconsistency becomes a real complaint.

**Time entry: recommendation.** Three separate `Input type="number"` fields
(Hours / Minutes / Seconds) over a single free-text `"H:MM:SS"` field.
Reasoning: a single text field is ambiguous on entry ("1:23" — is that
1:23 or 0:01:23?) and needs a regex parser with its own edge cases; three
number inputs map directly to `hours*3600 + minutes*60 + seconds` with no
parsing step, each field individually range-checked (`0–59` for
minutes/seconds), and each gets the mobile numeric keypad via
`inputMode="numeric"`. Cost: three tab stops instead of one, and every
distance (even ones that are realistically always sub-hour, like 5K) shows
an Hours field — accepted as a small, consistent cost rather than
special-casing the input shape per distance. **Alternative considered:** a
single `"H:MM:SS"` text `Input` with a documented format hint — less
markup, more parsing/validation code and a real ambiguity risk; not chosen.

### 6.3 Copy

| Context | Text |
|---|---|
| Page title | `Set up your plan` |
| Plan section legend | `Plan` |
| Template card metadata | `Marathon · 18 weeks` (from `raceDistanceType` + `totalWeeks`) |
| Race date legend | `Race date` |
| Race date helper | `The date of the race you're training for.` |
| Race date error | `Race date can't be in the past.` |
| Recent-result legend | `Recent race result` + muted `(optional)` |
| Recent-result helper | `Have a recent race time? Use it to derive your other training paces.` |
| Recent-result distance label | `Distance` |
| Recent-result distance placeholder | `Select a distance` |
| Recent-result distance options | `5K` · `10K` · `15K` · `10 Mile` · `Half` · `Marathon` |
| Recent-result time legend | `Time` |
| Incomplete recent-result error | `Enter a time for your recent result, or clear the distance.` (distance filled, time blank) / `Select a distance for your recent race result.` (time filled, distance blank) |
| Goal-time legend | `Goal time` + muted `(optional)` |
| Goal-time helper | `Have a target time for this race?` |
| Goal-time distance options | `Half` · `Marathon` |
| Incomplete goal-time error | same pattern as recent-result, "goal time" substituted |
| Submit button | `Calculate my pace zones` |
| Neither-section-filled error (§5.9) | `Enter a recent race result or a goal time to calculate your pace zones.` |
| Results heading | `Your pace zones` |
| Goal-derived warning banner (§7.2) | `These paces are estimated from your goal time, not a race you've run. If that goal is ambitious, expect all of them — especially Interval and 5K — to run faster than your current fitness supports. Add a recent result above for paces based on what you've actually run.` (verbatim, data-scientist copy, issue #52 — do not rewrite) |
| "Estimated" badge label (§7.2) | `Estimated` (verbatim, issue #52) |
| "Estimated" badge tooltip / `aria-label`-equivalent text (§7.2) | `Estimated from your goal time — not a demonstrated result. Add a recent result above for more accurate paces.` (verbatim, issue #52) |
| Live-region confirmation | `Pace zones updated.` |
| Zone row purposes | see §7.3 |
| Blocked-zone copy (equivalency zone, `state: "blocked"` — see §7.2 for why this no longer renders from any valid submission) | `Add a recent result above to see this.` (jump-link on "above") |
| Unset-goal copy | `Add a goal time above to see this.` (jump-link on "above") |
| Template list loading (SR) | `Loading plan templates` |
| Template list error | `Couldn't load plan templates` / retry `Try again` |

`calculate()`'s own `errors[].message` strings (implausible time, below-table
VDOT) are shown **verbatim** — they're already written as user-facing copy
(see `packages/pace-zones/src/calculator.ts` / `schema.ts`); this screen does
not rewrite them. The two #52 strings above get the same treatment: shown
verbatim, not paraphrased.

Tone: plain, second person, matches the calendar spec's house voice — no
exclamation marks, no coaching jargon beyond the zone names themselves.

### 6.4 Error-path → location mapping

`calculate()`'s `errors[].path` values map to a display location as follows
(this is the one piece of real "engineering-adjacent" detail worth pinning
down precisely, since it's the seam between the calculator's contract and
the form):

| `path` | Location |
|---|---|
| `recentResult.timeSeconds` | Field-level message under the Recent-result **Time** field group. |
| `recentResult.distance` | Field-level message under the Recent-result **Distance** select (defensive only — the `Select` already constrains to valid enum values, so this shouldn't fire in practice). |
| `recentResult` (no further segment — e.g. the below-table-VDOT case) | Section-level `Alert` directly under the Recent-result section, above its fields — it's not about one field, it's about the derived VDOT from the combination. |
| `goalTime.timeSeconds` / `goalTime.distance` / `goalTime` | Same three rules, Goal-time section. |
| Anything else / multiple simultaneous errors | A single summary `Alert` (`role="alert"`) above the form, listing each message with a jump-link to its field — standard multi-error accessible-forms pattern; kept out of scope elsewhere since one error is the common case. This same mechanism also covers the single "at least one of recent result / goal time is required" check (§5.9) — that error isn't attributable to one field either, even though it's the only error present. |

### 6.5 Responsive behavior

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column, full-width Cards, full-width submit button, full-width Table (horizontal scroll not expected at 7 short rows). |
| **Tablet 640–1024px** | Same stacked single column, `max-w-2xl` centered, more breathing room — no multi-column form. |
| **Desktop ≥ 1024px** | Same stacked single column, centered, `max-w-2xl` — **not** widened into a two-column (form-left, results-right) layout. Deliberate: this is a short one-time form, not a workspace; a side-by-side split is a plausible future enhancement but adds responsive complexity this pass doesn't need (see §11). |

No layout depends on hover; template cards, toggles, and selects all work on
tap/click identically across breakpoints.

---

## 7. The #14 pace-reference table

### 7.1 Row order — fixed, matches the calculator's own field order

`recovery → easy → threshold → tenK → fiveK → interval → goal`. This is
exactly `PaceZones`'s declared field order in `packages/pace-zones/src/
calculator.ts` — reusing it rather than inventing a second ordering (e.g.
fastest-to-slowest) means there's one source of truth for "what order do the
7 zones go in," not two that can drift.

### 7.2 Equivalency-zone states — normal, goal-derived (with warning), and the now-unreachable "blocked" case

Per issue #52, `packages/pace-zones`'s `EquivalencyZone` type gains a
`source: "recentResult" | "goalTime"` field alongside `state`/
`paceSecPerMile` (the amendment lands separately, in parallel). Whenever
`state: "computed"`, `source` says whether that number came from an actual
recent result or was derived as a fallback from the goal time. This changes
the states this table actually renders:

- **`source: "recentResult"`** (a recent result was provided — regardless of
  whether a goal time was *also* provided, since recentResult takes priority
  over the goalTime fallback per #52): render the pace normally. No badge,
  no banner. This is §5.6's and §5.7's case.
- **`source: "goalTime"`** (a goal time was provided, no recent result):
  render the pace **normally** — a real, usable number, not blocked — plus:
  - A section-level warning `Alert` (info/warning variant, **not**
    destructive), rendered once, positioned above all seven rows
    (equivalently: above the six equivalency rows, since Goal is the fixed
    7th/last row per §7.1). Exact copy, verbatim from data-scientist (#52):
    > These paces are estimated from your goal time, not a race you've run.
    > If that goal is ambitious, expect all of them — especially Interval
    > and 5K — to run faster than your current fitness supports. Add a
    > recent result above for paces based on what you've actually run.

    "above" is a real jump-link (same target/behavior as the goal-unset
    jump-link below) — one banner, one CTA, per data-scientist's explicit
    placement call (no per-row jump-link needed).
  - A small `Badge` reading **"Estimated"** on each of the six equivalency
    rows — not on the Goal row, whose number is a direct division of the
    entered goal time, never a fallback derivation of anything. Tooltip/
    accessible-name text, verbatim from #52:
    > Estimated from your goal time — not a demonstrated result. Add a
    > recent result above for more accurate paces.

    See "Badge tooltip: recommendation" below for how this reaches
    screen-reader and mouse users without adding new tab stops.
  - This is §5.8's case, rewritten this revision — see that wireframe.
- **`state: "blocked"`** (neither a recent result nor a goal time provided
  at all): the copy below ("Add a recent result above to see this.") still
  exists in the type/UI contract, defensively, but **cannot actually render
  from any submission on this screen** as of this revision — §4's flow now
  rejects a submit with both sections empty before `calculate()` is ever
  called (§5.9), so `blocked` has no reachable path here. Documented plainly
  so it isn't mistaken for live copy: this is dead code from *this screen's*
  UI perspective, not a state worth designing fresh treatment for. If
  `PaceZoneTable`/`pace-zone-display.ts` (§7.4) is ever reused by a future
  caller that doesn't share this screen's required-input gate, whoever specs
  that reuse should re-check whether `blocked` needs live copy there.
- **Goal zone `unset`** (no goal time at all — recent result only):
  unchanged. Pace cell reads **"Add a goal time above to see this."**
  ("above" is a real jump-link/button that scrolls to and focuses the
  Goal-time section's distance toggle.) §5.7's case. The Goal zone has no
  `source` concept — it's never a fallback derivation of anything else, so
  `unset`/`computed` is its only vocabulary, same as before #52.

Never render a bare `—`, `N/A`, or blank cell for the (now effectively
theoretical) blocked state or the goal-unset state — the copy always names
the specific action that unlocks the row.

**Badge tooltip: recommendation.** The "Estimated" badge needs its fuller
explanation available to screen-reader users, and ideally to sighted mouse
users on hover. Chosen: a plain, **non-interactive** `Badge` (visible text
"Estimated") holding a visually-hidden (`sr-only`) span with the full
sentence immediately after it, plus a native `title` attribute mirroring the
same text for a free mouse-hover tooltip — zero new dependencies, and it
keeps the results `Table` exactly as non-interactive as §8 already describes
it (no new tab stops per row). **Alternative considered:** wrap the badge in
shadcn's `Tooltip` (Radix-based, not yet adopted anywhere in this repo) for a
richer, keyboard-focusable hover/focus tooltip — more polished, but adds a
new primitive dependency and six new tab stops to a table §8 currently
describes as interactive only via its jump-link(s); not worth it for
information the section-level banner already states in full. Revisit if
user testing (§12) shows the banner alone isn't landing and people need the
per-row reminder to be more discoverable/interactive.

### 7.3 Zone metadata (label, one-line purpose)

| Zone id | Label | Purpose caption |
|---|---|---|
| `recovery` | Recovery | Easiest effort — recovery days and warm-up/cooldown. |
| `easy` | Easy | Comfortable, conversational — most of your weekly mileage. |
| `threshold` | Threshold | Sustained "comfortably hard" — tempo runs. |
| `tenK` | 10K | Hard, sustained race effort. |
| `fiveK` | 5K | Faster than 10K — short, hard repeats. |
| `interval` | Interval | Fastest repeatable pace, with recovery between reps. |
| `goal` | Goal — Marathon / Goal — Half / Goal (when unset) | Your target race pace. |

This table is purely zone-level metadata (id, label, purpose) — it does not
change per submission, so it has no `source` column. `source` is a
per-computation, per-submission value (§7.2), not zone metadata; whatever
renders a zone row (this table today, any compact/inline variant per §7.4)
needs to read it from the computed `PaceZones` result and decide whether to
show the "Estimated" badge, independently of this static table.

### 7.4 Full-page vs. future compact/inline reuse

The task brief's AC for #14 is explicit that this component needs to work
both here (a full page section) and later inline next to a workout's
freeform text (calendar day-detail). My call on how to split that:

**Extract the shared, format-agnostic pieces now; defer the compact
component's actual layout until it's actually built.**

- `lib/pace-zone-display.ts` (new, shared module): the `ZONE_ORDER` array
  (id, label, purpose caption), `formatPace(paceSecPerMile): string` (→
  `"7:45 /mi"`), and the blocked/unset copy strings from §7.2 — **plus, per
  #52, the "Estimated" badge label and tooltip/accessible-name copy from
  §6.3, and the warning-banner copy itself.** Both this screen's table *and*
  the future compact/inline view import from here — so the pace format, the
  zone order, the blocked/unset wording, *and* the goal-derived-fallback
  warning treatment can never drift between the two surfaces. Data-scientist
  (#52) explicitly flagged that the `source`/warning-badge concept needs to
  travel with a zone row wherever it's rendered, not just on this page —
  this module is where that travels from.
- `<PaceZoneTable zones={PaceZones} />` (new component, built now): renders
  the full `Table` from §7.1–7.3, using the shared module above, including
  the warning `Alert` and per-row `Badge` from §7.2. This is what #12/#14
  ship.
- The **compact/inline variant is not built in this pass.** I'm deliberately
  not adding an unused `variant="compact"` prop to `PaceZoneTable` today —
  CLAUDE.md's build-when-needed principle applies to UI surface area the
  same way it applies to schema fields. Now that `training-calendar.md`'s
  day-detail sheet is fully specced (this same design pass), the future
  caller is concrete: a compact pace-zone reference sitting inside the
  day-detail sheet next to a workout's freeform prescription text. When
  that's actually built, the choice is between (a) adding
  `variant="compact"` to this same component, or (b) a sibling
  `<PaceZoneInline>` that imports the same `pace-zone-display.ts` helpers.
  I'd lean toward (b) — a full `<Table>` and an inline "E 8:15 · T 7:05 · M
  7:30" chip strip are different enough DOM/markup shapes that forcing them
  into one component's conditional render is more contortion than reuse —
  but that's a call for whoever builds that reuse, informed by the
  day-detail sheet's actual space constraints, not pre-decided here.
  Whichever shape it takes, it needs its own call on how (or whether) to
  surface the "Estimated" badge/warning in a compact chip strip — a badge
  reads fine in a table row, less obviously in a dense inline chip;
  flagging this now so it isn't lost, not resolving it here.

---

## 8. Accessibility

Target: WCAG 2.2 AA, matching the calendar spec's bar.

### Keyboard path & focus order

1. Page `<h1>` (not focusable).
2. Template radio-card group — `RadioGroup`'s native roving-tabindex + arrow-
   key behavior (one tab stop into the group, arrows move the selection).
3. Race date `<input type="date">`.
4. Recent-result distance `Select` trigger.
5. Recent-result time: Hours → Minutes → Seconds (`fieldset` groups the
   three, one `legend`, but each `Input` is its own tab stop).
6. Goal-time distance toggle (`RadioGroup`, same roving pattern as #2).
7. Goal-time time: Hours → Minutes → Seconds.
8. Submit button.
9. (After a successful submit) the results `Table` is reachable by scroll,
   not inserted into the tab order beyond its own content having no
   interactive cells — except: the goal-unset jump-link (§7.2, when a
   recent result was given but no goal time), and — when any equivalency
   zone's `source` is `"goalTime"` — the jump-link inside the goal-derived
   warning banner directly above the table (§7.2). Both use the same
   jump-link component and land on the Recent-result section. The
   blocked-equivalency-zone jump-link described in earlier drafts of this
   doc no longer has a reachable state to attach to (§7.2). The "Estimated"
   badges themselves are **not** tab stops (§7.2's "Badge tooltip:
   recommendation").

On submit, if validation fails, focus moves to **the first invalid field**
when there's exactly one error attributable to a single field; to a summary
`Alert` with `tabindex="-1"` and `role="alert"` (per §6.4) when there are
multiple errors, **or when a single error spans more than one section and
isn't attributable to any one field** — this is the case for the "enter a
recent race result or a goal time" check (§5.9): there's exactly one error,
but no single invalid field to send focus to instead, so it goes to the
summary `Alert`, focused on Recent-result's Distance field per §5.9's
wireframe note. On a successful submit, focus is **not** moved — the live
region (below) announces the update without yanking the runner out of the
form they might still want to edit.

### Semantics / roles / labels

- Each section is a `<fieldset>` with a `<legend>` matching its heading text
  (Plan / Race date / Recent race result / Goal time) — screen-reader users
  get section context on every field inside, not just sighted users reading
  the heading above.
- Time entry: one `<fieldset>` per section with `<legend>Time</legend>`;
  each of the three `Input`s has its own `<Label>` ("Hours"/"Minutes"/
  "Seconds") — visually condensed (small width, `:` separators as decorative
  text between them, `aria-hidden="true"`) but each input keeps a real,
  individually-announced label.
- Field errors: `aria-invalid="true"` on the offending input(s),
  `aria-describedby` pointing at the error text's `id` — standard
  `FormMessage` wiring if `Form` is adopted (§6.2).
- Results live region: `aria-live="polite"` announcing "Pace zones updated."
  on every successful (re)compute — not on every keystroke, only on submit.
- Results table: `<caption>` "Your personal pace zones" (visually the h2
  above it, but a real `<caption>` too so table semantics are self-
  contained); each row a `<tr>` with zone name + purpose in one `<th
  scope="row">` cell (or a `<td>` with the purpose as a `<p>` underneath) and
  pace in a `<td>`. When a row's `source` is `"goalTime"`, its zone-name cell
  additionally contains the `Badge` described in §7.2 (visible "Estimated"
  text + `sr-only` full explanation + `title` attribute).
- Jump-links (goal-unset row, and the goal-derived warning banner):
  `aria-label` makes the destination explicit beyond "above" for
  screen-reader users, e.g. `aria-label="Add a recent result — jump to
  Recent race result section"` / `aria-label="Add a goal time — jump to Goal
  time section"`.

### Contrast

- Body text, zone labels, purpose captions: ≥ 4.5:1.
- Blocked/unset pace-cell copy: ≥ 4.5:1 — it's muted in weight/tone (e.g.
  italic, slightly lighter than body) but must not drop below normal-text
  contrast; this is explicitly the same rule the calendar spec set for
  "Rest"/muted metadata, applied here. (In practice this now only governs
  the goal-unset cell — §7.2.)
- Goal-derived ("Estimated") pace-cell copy: full body contrast, same as any
  other computed pace — it's a real number, not a muted/placeholder state;
  only the accompanying `Badge` gets the accent-family warning treatment
  (§2).
- Error text (destructive-variant `Alert`/`FormMessage`): ≥ 4.5:1, and never
  color-only — always paired with the `alert-triangle` icon and the word
  "error"-equivalent framing in the message text itself.
- Warning/info-variant `Alert` (goal-derived banner): ≥ 4.5:1, paired with
  the `info` icon, never color-only, and visually distinct from the
  destructive-variant `Alert` so it doesn't read as an error (§2/§6.2).
- Focus ring: visible, ≥ 3:1, never suppressed.

### Touch targets

- All `Input`s, `Select` triggers, radio cards, and the submit button: ≥
  44×44 CSS px. The three time-entry number inputs are narrow (a few
  characters wide) but kept ≥ 44px **tall**.
- Jump-links (goal-unset row, warning-banner CTA): padded to ≥ 44px tall
  even though they read as inline text links.

### Motion

- `prefers-reduced-motion`: the scroll-into-view on a successful submit
  becomes an instant jump, not a smooth scroll. No other motion on this
  screen.

---

## 9. Data asked of the user

Per CLAUDE.md's privacy/data-minimization principle — every field mapped to
why it's needed, checked against "genuinely needs it," not "might be
useful":

| Field | Why it's collected | PII? |
|---|---|---|
| Template selection | FR1 — which plan to personalize. | No — an enum choice, not identifying. |
| Race date | FR7 — validated now (reject past dates), consumed by #13 later to place the plan on real dates. | No — it's the *race's* date, not any personal date (not a birthdate); not stored yet at all (no persistence in this pass). |
| Recent result: distance + time | FR2 — derives the six equivalency zones. | No — a performance number, not identifying; not tied to any account (there is none). |
| Goal time: distance + time | FR3 — derives the goal zone directly, and, per issue #52, now also serves as the fallback input for the six equivalency zones when no recent result is provided (tagged `source: "goalTime"` in the UI, §7.2). This is not a new field or a new ask of the user — the same value the runner already enters for the goal zone is reused for a second derivation; nothing new is collected. | No — same reasoning as recent result. |

Nothing else is asked. No name, email, device ID, or account of any kind —
consistent with the product being single-user/no-login right now. When #13
eventually persists a plan instance, whatever opaque identifier it's keyed to
is that feature's decision, not introduced here.

---

## 10. New vs. reused patterns

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Card-based section layout, loading skeleton, error-with-retry | `HomePage.tsx` | Reused | Establishes this screen is visually the same app, not a new visual system. |
| `RadioGroup`-as-card-list (template picker) | — | New | No existing pattern for "pick one of a short list of named things" in this repo yet; built on the library `RadioGroup`, card styling is bespoke — same split as the calendar spec's week-block. |
| `TimeInputGroup` (3× number input, H/M/S) | — | New | No existing time-entry pattern in this repo; see §6.2 for the format decision. |
| `PaceZoneTable` / `pace-zone-display.ts` | — | New | The product's other core object besides the (future) calendar week-block — the direct realization of #14's AC. |
| Blocked/unset-with-a-reason microcopy + jump-link | — | New | Sets the house convention for "why can't I see this yet" across the app — worth reusing verbatim if a similar gated state shows up elsewhere (e.g. a locked feature before Strava is connected, FR12/`strava-connect-settings.md`). |
| `errors[].path` → field/section/summary mapping (§6.4) | — | New | First screen consuming a package that returns structured validation errors rather than throwing; this mapping is the reusable playbook for any future screen calling a similarly-shaped local calculator. |
| Goal-derived-fallback warning (section `Alert` + per-row "Estimated" `Badge`, §7.2) | — | New | First surface where a computed value is flagged as an estimate/fallback rather than a directly-measured input — the "one banner + a badge per affected row" split (data-scientist's call, #52) is the house convention to reuse if a similar "we inferred this, here's the caveat" state shows up elsewhere. |

---

## 11. Open questions / judgment calls flagged back

Nothing here rises to "the field shouldn't exist" — race date's collect-
without-a-consumer status is already sanctioned by FR7, not something I'm
inventing.

*(Resolved since the first draft: "submit with neither result nor goal
entered" — Patrick's review of the mockup decided this must be rejected, not
allowed. See §4/§5.9/§8 for the enforced validation and its focus-management
rule. No longer an open question.)*

One thing still worth a quick confirm before/soon after shipping:

1. **Two-column desktop layout (form left, results right)** was considered
   and rejected for this pass (§6.5) in favor of staying single-column at
   every breakpoint, to keep this screen simple. If it feels sparse on a
   wide monitor once built, that's a cheap follow-up, not a redesign.

---

## 12. Validate with users

- **Time-entry format (§6.2's H/M/S call).** Confirm three number inputs
  read as fast/obvious rather than fussier than a single text field, with 2–3
  runners actually entering a real recent time.
- **Goal-unset jump-link + goal-derived warning (§7.2).** Confirm the
  "add a goal time above" framing still reads as helpful guidance, not a
  scold for having only filled in one section — the whole point of FR4/FR5
  is that partial input is normal, not a mistake. Separately, confirm the
  new goal-derived warning banner + "Estimated" badges (§7.2) are actually
  noticed, not skimmed past, since they're the one place this screen tells
  someone their numbers might be optimistic — if people miss it, the
  section-level banner + per-row badge combo (vs. a per-row jump-link, which
  data-scientist explicitly considered and passed on) may need revisiting.
- **Required-input validation copy (§5.9).** Confirm "Enter a recent race
  result or a goal time to calculate your pace zones." reads as a normal
  form requirement, not punitive, now that it's a hard block instead of the
  soft, non-blocking hint originally designed here — and watch whether
  anyone is surprised by the block itself, since the calculator package's
  own contract still technically permits "neither" (§7.2's now-dead
  `blocked` state) even though this screen's UI no longer allows a runner to
  reach it.
