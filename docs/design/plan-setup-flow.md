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
  the other; both are optional; "and/or" is real, not a soft nudge toward one.
- The pace table teaches the zone, not just states the number — every row
  gets a one-line "what it's for" caption.
- Nothing here is saved. No "saved" copy, no unsaved-changes warning.
- Blocked/unset table rows explain *why* and *what unlocks them* — never a
  bare "N/A" or "—".

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
          (race date in the past, or          → calculate(input) runs
           an incomplete result/goal            (synchronous, local)
           section)                                    │
                    │                     ┌─────────────┴─────────────┐
                    ▼                     │                             │
        inline field error(s),      ok: false                     ok: true
        focus moves to first        (implausible time /           → §14 table
        invalid field. No           below-table VDOT)              renders/
        calculate() call made.            │                        updates below
                    │              inline error near the           the form,
                    │              offending section, focus         aria-live
                    │              moves there. Previous            "Pace zones
                    │              results (if any) are             updated."
                    │              left exactly as they were.
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
4. Client-side checks run first (race date not in the past; each touched
   result/goal section is either fully filled or fully empty — see §5.2).
   Any failure stops here: inline error(s), focus to the first invalid
   field, `calculate()` is never called.
5. If client-side checks pass, `calculate()` runs with whatever of
   `recentResult`/`goalTime` was fully filled (either, both, or neither is a
   valid call per the calculator's own contract).
6. `ok: true` → the §14 pace-zone table appears (first submit) or updates
   in place (subsequent submits) directly below the form, same page, no
   scroll-jump unless it's off-screen (smooth-scroll into view, respecting
   `prefers-reduced-motion`). A polite live region announces "Pace zones
   updated."
7. `ok: false` → an inline error renders near the section that produced it
   (§5.4 maps `errors[].path` to a location); any previously-shown table from
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
mobile-width shown, desktop noted where it differs (§6.4).

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

### 5.7 Results — recent result only (Goal row unset)

```
│ … six rows identical to 5.6 …        │
│ ├───────────────┼───────────────┤   │
│ │ Goal           │  Add a goal   │   │
│ │ Your target race pace.        │  time above to see this.       │
│ └───────────────┴───────────────┘   │
```

### 5.8 Results — goal time only (six equivalency rows blocked)

```
│ ┌───────────────┬───────────────┐   │
│ │ Recovery       │ Add a recent  │   │
│ │ Easiest effort…│ result above  │   │
│ │                │ to see this.  │   │  ← "recent result above" is a
│ ├───────────────┼───────────────┤   │    real jump-link, see §6.2
│ │ … (Easy/Threshold/10K/5K/     │   │
│ │    Interval, same treatment)  │   │
│ ├───────────────┼───────────────┤   │
│ │ Goal — Half    │     8:00 /mi  │   │
│ │ Your target race pace.        │   │
│ └───────────────┴───────────────┘   │
```

### 5.9 Results — neither entered, submitted anyway (valid but empty)

```
│ Your pace zones                      │
│ ℹ Add a recent race result or a      │  non-blocking hint, not an error
│   goal time above to see real        │  (role="status", not destructive)
│   numbers.                           │
│ ┌───────────────┬───────────────┐   │
│ │ … all 7 rows show their own     │   │
│ │   blocked/unset copy …          │   │
│ └───────────────┴───────────────┘   │
```

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
  scale). No sidebar, no multi-column form on any breakpoint (see §6.4) —
  the "one page" call in §3 extends to layout, not just navigation.
- "(optional)" is set in the section legend itself, in muted text, right next
  to the section title — not a separate line, not a tooltip. It's the first
  thing read alongside the heading, matching how the section's *actual*
  optionality should read.
- Results table: numeric pace column right-aligned, tabular figures — same
  "numbers are the hero" convention as the calendar spec, applied to a
  results table instead of a countdown.
- Blocked/unset pace cells are muted but never below 4.5:1 (§7) — they read
  as "not yet," not as disabled/greyed-out-to-illegibility.

### 6.2 Component mapping

Stack is decided (ADR 0002: React + Vite, Tailwind, shadcn/ui, Lucide) — no
"if React" framing needed, matching how `ui-toolkit.md` already presents this
as settled.

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Whole form | `Form` (react-hook-form + zod resolver) | **New adoption** — first form with real multi-field, cross-field validation in the repo. See "Form: recommendation" below for the trade-off. |
| Section container | `Card` / `CardHeader` / `CardContent` | Reused from `HomePage.tsx`. |
| Template radio-card list | `RadioGroup` + `RadioGroupItem`, each item styled as a card (custom label wrapper) | **New primitive (`RadioGroup`), custom card styling.** Container/keyboard behavior is the library; the "looks like a card, shows title + distance + weeks" layout inside each item is bespoke — same split the calendar spec used for its accordion week-block. |
| Race date | `Input type="date"` | Native date picker, not a Calendar/date-picker component — see "Race date: recommendation" below. |
| Distance select (recent result, 6 options) | `Select` | Standard. |
| Distance toggle (goal time, 2 options) | `RadioGroup` styled as a 2-segment toggle (reuses the same primitive as the template picker, different CSS) | Two options read better as a segmented toggle than a dropdown; no new primitive needed. |
| Time entry (H / M / S) | 3× `Input type="number" inputMode="numeric"` inside a `fieldset` with a visually-hidden or visible `legend` | **New custom composite**, `TimeInputGroup` — see "Time entry: recommendation" below. Not a shadcn primitive; assembled from `Input` + `Label`. |
| Field / section error text | `Form`'s `FormMessage` (field-level) or `Alert` (destructive, section-level for a `calculate()`-returned error with no single field to attach to) | New adoption: `Alert`. See §6.4 for the path→location mapping. |
| Non-blocking "add a result or goal" hint (5.9) | `Alert` (default/info variant, not destructive) | Same primitive, different variant — distinguishes "you should" from "you must." |
| Submit button | `Button` (default variant, full width on mobile) | Reused from `HomePage.tsx`. |
| Results table (#14) | `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` | **New adoption.** See §7 for the full component spec. |
| Template distance/weeks metadata on each card | `Badge` | **New adoption** — small "Marathon · 18 weeks" tag, reused later for any other short metadata tag in the app. |
| Template list loading / error | `Skeleton`, plain error block + `Button` | Reused verbatim from `HomePage.tsx`'s existing pattern — do not invent a new loading/error convention here. |
| Live-region result confirmation | inline `aria-live="polite"` region (no toast) | Matches the calendar spec's "inline is enough for v1" call. |
| Icons | Lucide: `alert-triangle` (error, reused from `HomePage.tsx`), `info` (non-blocking hint), `circle`/`circle-check` (radio states, usually supplied by the primitive itself) | One set, consistent with `ui-toolkit.md`. |

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
| Results heading | `Your pace zones` |
| Neither-entered hint | `Add a recent race result or a goal time above to see real numbers.` |
| Live-region confirmation | `Pace zones updated.` |
| Zone row purposes | see §7.3 |
| Blocked-zone copy | `Add a recent result above to see this.` (jump-link on "above") |
| Unset-goal copy | `Add a goal time above to see this.` (jump-link on "above") |
| Template list loading (SR) | `Loading plan templates` |
| Template list error | `Couldn't load plan templates` / retry `Try again` |

`calculate()`'s own `errors[].message` strings (implausible time, below-table
VDOT) are shown **verbatim** — they're already written as user-facing copy
(see `packages/pace-zones/src/calculator.ts` / `schema.ts`); this screen does
not rewrite them.

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
| Anything else / multiple simultaneous errors | A single summary `Alert` (`role="alert"`) above the form, listing each message with a jump-link to its field — standard multi-error accessible-forms pattern; kept out of scope elsewhere since one error is the common case. |

### 6.5 Responsive behavior

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column, full-width Cards, full-width submit button, full-width Table (horizontal scroll not expected at 7 short rows). |
| **Tablet 640–1024px** | Same stacked single column, `max-w-2xl` centered, more breathing room — no multi-column form. |
| **Desktop ≥ 1024px** | Same stacked single column, centered, `max-w-2xl` — **not** widened into a two-column (form-left, results-right) layout. Deliberate: this is a short one-time form, not a workspace; a side-by-side split is a plausible future enhancement but adds responsive complexity this pass doesn't need (see §9). |

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

### 7.2 Blocked / unset states — real copy, not "N/A"

- **Equivalency zone, `state: "blocked"`** (no recent result yet): pace cell
  reads **"Add a recent result above to see this."** — "above" is a real
  jump-link/button that scrolls to and focuses the Recent-result section's
  distance select. Zone name and purpose caption stay at full contrast;
  only the pace cell's content changes.
- **Goal zone, `state: "unset"`** (no goal time yet): pace cell reads **"Add
  a goal time above to see this."** — same jump-link treatment.
- Never render a bare `—`, `N/A`, or blank cell for these two states — the
  copy always names the specific action that unlocks the row, per the task
  brief's instruction that this is real microcopy, not a placeholder.

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

### 7.4 Full-page vs. future compact/inline reuse

The task brief's AC for #14 is explicit that this component needs to work
both here (a full page section) and later inline next to a workout's
freeform text (calendar day-detail, not being built now). My call on how to
split that:

**Extract the shared, format-agnostic pieces now; defer the compact
component's actual layout until the calendar day-detail spec is written.**

- `lib/pace-zone-display.ts` (new, shared module): the `ZONE_ORDER` array
  (id, label, purpose caption), `formatPace(paceSecPerMile): string` (→
  `"7:45 /mi"`), and the blocked/unset copy strings from §7.2. Both this
  screen's table *and* the future compact/inline view import from here — so
  the pace format, the zone order, and the "why is this blocked" wording
  can never drift between the two surfaces.
- `<PaceZoneTable zones={PaceZones} />` (new component, built now): renders
  the full `Table` from §7.1–7.3, using the shared module above. This is
  what #12/#14 ship.
- The **compact/inline variant is not built in this pass.** I'm deliberately
  not adding an unused `variant="compact"` prop to `PaceZoneTable` today —
  CLAUDE.md's build-when-needed principle applies to UI surface area the
  same way it applies to schema fields. When the calendar day-detail screen
  is actually specced, the choice is between (a) adding `variant="compact"`
  to this same component, or (b) a sibling `<PaceZoneInline>` that imports
  the same `pace-zone-display.ts` helpers. I'd lean toward (b) — a full
  `<Table>` and an inline "E 8:15 · T 7:05 · M 7:30" chip strip are different
  enough DOM/markup shapes that forcing them into one component's
  conditional render is more contortion than reuse — but that's a call for
  whoever specs that screen, informed by its actual space constraints, not
  pre-decided here.

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
   interactive cells — except the two jump-links in §7.2, which **are** real
   tab stops, positioned in DOM order inside their respective blocked/unset
   cells.

On submit, if validation fails, focus moves to **the first invalid field**
(not the summary) when there's exactly one error; to a summary `Alert` with
`tabindex="-1"` and `role="alert"` (per §6.4) when there are multiple. On a
successful submit, focus is **not** moved — the live region (below)
announces the update without yanking the runner out of the form they might
still want to edit.

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
  pace in a `<td>`.
- Blocked/unset jump-links: `aria-label` makes the destination explicit
  beyond "above" for screen-reader users, e.g. `aria-label="Add a recent
  result — jump to Recent race result section"`.

### Contrast

- Body text, zone labels, purpose captions: ≥ 4.5:1.
- Blocked/unset pace-cell copy: ≥ 4.5:1 — it's muted in weight/tone (e.g.
  italic, slightly lighter than body) but must not drop below normal-text
  contrast; this is explicitly the same rule the calendar spec set for
  "Rest"/muted metadata, applied here.
- Error text (destructive-variant `Alert`/`FormMessage`): ≥ 4.5:1, and never
  color-only — always paired with the `alert-triangle` icon and the word
  "error"-equivalent framing in the message text itself.
- Focus ring: visible, ≥ 3:1, never suppressed.

### Touch targets

- All `Input`s, `Select` triggers, radio cards, and the submit button: ≥
  44×44 CSS px. The three time-entry number inputs are narrow (a few
  characters wide) but kept ≥ 44px **tall**.
- Jump-links inside table cells: padded to ≥ 44px tall even though they read
  as inline text links.

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
| Goal time: distance + time | FR3 — derives the goal zone. | No — same reasoning. |

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
| Blocked/unset-with-a-reason microcopy + jump-link | — | New | Sets the house convention for "why can't I see this yet" across the app — worth reusing verbatim if a similar gated state shows up elsewhere (e.g. a locked feature before Strava is connected, FR12). |
| `errors[].path` → field/section/summary mapping (§6.4) | — | New | First screen consuming a package that returns structured validation errors rather than throwing; this mapping is the reusable playbook for any future screen calling a similarly-shaped local calculator. |

---

## 11. Open questions / judgment calls flagged back

Nothing here rises to "the field shouldn't exist" — race date's collect-
without-a-consumer status is already sanctioned by FR7, not something I'm
inventing. Two things worth a quick confirm before/soon after shipping,
though:

1. **"Submit with neither result nor goal entered" (§5.9).** The calculator
   contract says this is valid, so I designed it as a real, allowed path
   (soft non-blocking hint, not a hard error) rather than disabling the
   submit button. If the actual product intent is "you must enter at least
   one," that's a one-line change (disable submit + a different hint) — flag
   back if that's the intent, since I defaulted to what the calculator's own
   contract permits.
2. **Two-column desktop layout (form left, results right)** was considered
   and rejected for this pass (§6.5) in favor of staying single-column at
   every breakpoint, to keep this screen simple. If it feels sparse on a
   wide monitor once built, that's a cheap follow-up, not a redesign.

---

## 12. Validate with users

- **Time-entry format (§6.2's H/M/S call).** Confirm three number inputs
  read as fast/obvious rather than fussier than a single text field, with 2–3
  runners actually entering a real recent time.
- **Blocked/unset copy + jump-link (§7.2).** Confirm the "add a recent
  result above" framing reads as helpful guidance, not as a scold for having
  only filled in one section — the whole point of FR4/FR5 is that partial
  input is normal, not a mistake.
- **Neither-entered soft hint (§5.9 / §11.1)** — watch whether anyone
  actually submits with both sections empty, and if so, whether the hint is
  enough or they wanted the button disabled instead.
