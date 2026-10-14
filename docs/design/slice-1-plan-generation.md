# Design spec — Slice 1: create a plan, see it on real dates, open a day

> Owned by `@designer`. "PR 0" (docs only) for issues #13 "Generate personalized
> plan instance from template + derived paces", #16 "Render plan calendar on real
> calendar dates", #17 "Build day-detail display: workout text + distance/duration
> or Rest". Revised after tech-lead review of PR #60.
>
> **Plan of record.** Engineering plan: tech-lead comment on #13
> (https://github.com/thequietlooppm/training_plan/issues/13#issuecomment-6178478049)
> and its amendment
> (https://github.com/thequietlooppm/training_plan/issues/13#issuecomment-6178605248).
> The plan wins on engineering; this spec wins on UI. Flag differences back.
>
> **How this file relates to the other specs.** Single source of truth for Slice 1,
> in four parts the coordinator splices into the parent specs:
>
> | Part | Belongs in | Heading there |
> |---|---|---|
> | A. Calendar Slice 1 scope | `training-calendar.md`, after "Revision history" | `## Slice 1 — what is in, what is deferred` |
> | B. Plan setup: Create my plan | `plan-setup-flow.md`, new section after §12 | `## 13. Slice 1 — "Create my plan"` |
> | C. Day detail, `/paces`, routes | supersedes the Drawer wording in `training-calendar.md` §3 Flow 2 and §4.2 for Slice 1 | — |
> | D. `formatPace` home | `plan-setup-flow.md` §7.4, `ui-toolkit.md` (already updated) | — |
>
> For Slice 1 behaviour this file overrides `training-calendar.md` and
> `plan-setup-flow.md` where they disagree. Deferred material in those specs stays
> valid.
>
> Stack is settled (ADR 0002): React + Vite + React Router, Tailwind, shadcn/ui,
> Lucide, Tempo tokens (`ui-toolkit.md`). No new tokens or icon set.

---

## Product-owner defaults this slice is built on

1. Template distances are used **as written** — no mileage inputs, no scaling.
2. Race date **must be a Sunday** (template weeks are Monday-start; race day is the
   final Sunday, ADR 0005).
3. **No completion-status chips** anywhere.
4. Creating a new plan **replaces** the old one, after a confirm dialog.
5. **No short-runway warning.**

## Accepted divergences from the earlier calendar spec (recorded, not open)

- The day sheet switches from bottom sheet to **right-hand panel at >= 768px**.
- After **Create my plan**, focus goes to the **page heading** on the calendar.
- The **progress bar**, the **`• • •` collapse** and the **desktop 7-column grid**
  are deferred (Part A).

---

## A. Calendar — Slice 1 (what is in, what is deferred)

### In this slice

| # | Item | Notes |
|---|---|---|
| 1 | Calendar at `/` for the one active plan | Opens on the current week expanded; every other week collapsed. |
| 2 | Plan header | `N weeks to race day` (Display role), `Week N of M · {phase}` (template `phase`). Text only. |
| 3 | Week list as `Accordion` (multiple open) | Header: `Week 9 · Mar 9–15 · 32 mi` (planned miles, template as written). |
| 4 | Day rows | `Mon 9 · Easy run · 5 mi` or `Wed 11 · Rest`. Every row, including Rest, is a link to `/day/:date`. |
| 5 | Today marker | Accent left border + the word `Today`. The only loud element. |
| 6 | `Long` tag | On the week's long run, text label. |
| 7 | Race week as a real 7-day week + pinned race-day block after it | Block links to `/day/<race date>`. |
| 8 | `Today` pill in the top bar | Scrolls to and expands the current week. Shown only when the current week is off-screen **and** the plan has started. |
| 9 | Day detail at `/day/:date` as a `Sheet` | Part C. |
| 10 | `/paces` page | Part C. |
| 11 | Empty / loading / error / corrupt-plan / not-started states | A.1 below. |
| 12 | Header nav: `Plan`, `Pace zones`, `New plan` | `New plan` goes to `/setup`. |

### Deferred (not built in Slice 1)

| Deferred | Why |
|---|---|
| All five completion-status chips (Planned/Achieved/Partial/Missed/Rest) and `StatusBadge` | Product-owner default 3. Status is computed from confirmed Strava matches; with no Strava every elapsed day would read "Missed", which is wrong and discouraging. |
| `ActivityMatchCard`, confirm/dismiss/undo, multi-match, bonus entries, `Suggestion` and `Swap` row tags | Need Strava sync (#18, #24). |
| Connection / reconnect / backfill banners | No Strava. |
| Weekly **completed** totals (`18 / 32 mi`) | Needs confirmed activity. Slice 1 shows planned miles only. |
| Plan progress bar (`Progress`) | Polish; `Week N of M` carries the same information. One fewer primitive. |
| `• • •` ellipsis for distant weeks | An 18-header accordion is short enough; race week is always visible trivially. Revisit if templates get longer. |
| Desktop 7-column week grid (`training-calendar.md` §4.6) | Slice 1 uses the stacked week list at every width (`max-w-2xl`, centered), as plan setup does. Cheap follow-up. |
| Drag-down-to-dismiss on the day sheet | `Sheet`, not `Drawer` (C.2). Close button, scrim, Esc. |
| Short-runway warning | Product-owner default 5. See B.6. |
| Mileage inputs / scaling | Product-owner default 1. |
| Post-race state (#56), day-swap detection (#57), plan switching (#32/#33) | Unchanged from the calendar spec. |

### Why this cut

The slice is "I made a plan and I can see what to do on Tuesday." Everything
deferred is either a function of Strava data (which does not exist yet) or polish
that does not change whether that sentence is true.

### Slice 1 calendar wireframe (mobile, populated, plan in progress)

```
┌─────────────────────────────────────┐
│ [≡] Plan  Pace zones  New plan (Today)│  Header nav. Today pill only when current week is off-screen
├─────────────────────────────────────┤
│  9 weeks to race day                │  Display (Figtree), not mono
│  Week 9 of 18 · build               │  Body-sm, text/secondary
├─────────────────────────────────────┤
│ ▸ Week 8   Mar 2–8          28 mi   │  collapsed, planned miles only
├─────────────────────────────────────┤
│ ▾ Week 9   Mar 9–15         32 mi   │  expanded current week; header = button, aria-expanded
│  ┌───────────────────────────────┐  │
│  │ Mon  9  Easy run        5 mi ›│  │  each row is a <Link to=/day/2026-03-09>
│  │ Tue 10  Intervals       6 mi ›│  │
│  │ Wed 11  Rest                 ›│  │  Rest rows muted (text/secondary), still tappable
│  │ Thu 12  Tempo           7 mi ›│  │
│  │▎Fri 13  Easy run · Today 4 mi›│  │  TODAY: accent left border + "Today" label
│  │ Sat 14  Rest                 ›│  │
│  │ Sun 15  Long run [LONG] 14 mi›│  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ ▸ Week 10  Mar 16–22        34 mi   │
│ …  (all weeks listed, collapsed)    │
│ ▸ Week 18  May 11–17 · Race week 22 mi│
├─────────────────────────────────────┤
│ ╔═════════════════════════════════╗ │
│ ║ [⚑] RACE DAY                    ║ │  links to /day/2026-05-17
│ ║ Sun, May 17 · Marathon · 9 wks  ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

Row copy comes from the template: title = leading label / `workoutTag`, distance =
`distanceMiles` formatted `5 mi` (drop `.0`, keep `.5`, `26.2`). In the stacked
list distances are Body, not Numeral (no comparison column yet).

Countdown copy: `N weeks to race day` -> `1 week to race day` -> `Race week` ->
`Race day is today` -> after race day: `Race day was {Sun, May 17}` (nothing else;
#56 owns the aftermath).

### A.1 Calendar states

| State | What shows |
|---|---|
| Loading | Skeleton mirroring header + week rows, `aria-busy="true"` on `<main>`. |
| No plan | Empty state, one CTA `Set up plan` -> `/setup`. **Rendered at `/`; no redirect.** |
| Corrupt stored plan | Empty state **plus** a note (below). |
| Plan not started yet | Variant of populated (below). |
| Error | `Couldn't load your plan` + `Try again`. |
| Populated | Wireframe above. |
| Just created | Populated; focus lands on the page heading (the countdown `<h1>`), see B.1. |

**Corrupt stored plan.** The stored value failed to parse or validate. Engineering
behaviour: the bad value is **moved aside, never deleted**, so nothing the runner
made is destroyed silently. UI: the normal empty state (`No plan yet`, body, `Set up
plan`) with a non-destructive info/warning `Alert` above it (`info` icon,
`role="status"`):

```
┌───────────────────────────────┐
│ ⓘ We couldn't read your saved │
│   plan, so it isn't shown. It │
│   was set aside, not deleted. │
│   Create a new plan to        │
│   continue.                   │
└───────────────────────────────┘
```

Exact copy: `We couldn't read your saved plan, so it isn't shown. It was set aside, not
deleted. Create a new plan to continue.` Not dismissible. Once the runner creates a
new plan the note disappears. Because the bad value is set aside, `/setup` treats
this as "no existing plan" (no replace dialog). `/paces` shows its no-plan state with
the same note.

**Plan not started yet** (race more than the template length away, e.g. 26 weeks out
for an 18-week plan). Week 1 starts in the future.

```
┌─────────────────────────────────────┐
│ [≡] Plan  Pace zones  New plan       │  no Today pill
├─────────────────────────────────────┤
│  26 weeks to race day               │  Display
│  Starts Mon, Jan 12 · 18-week plan  │  replaces "Week N of M · phase"
├─────────────────────────────────────┤
│ ▾ Week 1   Jan 12–18        20 mi   │  week 1 EXPANDED (nothing is "current")
│  │ Mon 12  Easy run        4 mi  ›│  │  all rows ordinary; no Today marker
│  │ …                              │  │
│ ▸ Week 2   Jan 19–25        22 mi   │
│ …                                   │
└─────────────────────────────────────┘
```

Copy: header line `Starts Mon, Jan 12 · 18-week plan` (year appended only if not
the current year). Rule: no week contains today and today is before week 1 -> expand
week 1, hide the Today pill, show no Today marker. (Today after race day is the
post-race case, deferred to #56.)

### A.2 Accessibility (calendar, Slice 1)

- Order: header nav, Today pill (if shown), week headers and day rows in DOM order.
- Week header is the `Accordion` trigger (button, `aria-expanded`). Day rows are
  anchors, so middle-click and deep links work.
- Today row: `Today` text plus accent border, and `aria-current="date"`.
- **Day-row accessible name = its visible text. No `aria-label` on the link**, so
  the visible label is always contained in the name (WCAG 2.5.3 Label in Name).
  Visible text carries enough on its own: weekday, date number, title, distance
  (`Fri 13 · Easy run · 4 mi`, `Wed 11 · Rest`, `Today` when applicable). If a longer
  weekday is wanted for screen readers, add it as `sr-only` text inside the link, not
  as an `aria-label`.
- Rows and headers >= 44px tall. Text >= 4.5:1 using Tempo tokens; Rest uses
  `text/secondary`, never `text/disabled`.
- On sheet close, focus returns to the row for that date (route-driven sheets do not
  get Radix's trigger-restore; focus `[data-date="…"]` manually). If no row exists
  (deep link), focus the page heading.

---

## B. Plan setup — "Create my plan" (for `plan-setup-flow.md`, new §13)

Plan setup stays **one page, no wizard** (§3). Slice 1 adds one action after the
results, one validation rule, and one confirm dialog. "Calculate my pace zones" and
everything it does are unchanged.

### B.1 Flow

```
/setup (form) --Calculate my pace zones--> results table shown
      │                                          │
      │ (validation: past date, NOT Sunday)      │ trigger: "Create my plan"
      ▼                                          ▼
 inline errors, no calculate()        ┌── existing plan? ──┐
                                      │ no                 │ yes
                                      ▼                    ▼
                               create plan           AlertDialog "Replace…"
                                      │                 │Cancel      │Replace plan
                                      │                 ▼            ▼
                                      │         back to /setup    create plan
                                      ▼                                │
                         success: navigate to "/" (calendar) <─────────┘
                         failure: Alert on /setup, inputs and results kept
```

1. Runner fills the form and taps **Calculate my pace zones** (unchanged). The
   Sunday rule (B.2) is checked here with the past-date check, so a bad date is
   caught before the runner sees paces they cannot use.
2. On `ok: true` the pace table appears and **Create my plan** appears directly
   beneath it, in the same results `Card`.
3. Tap **Create my plan**. No existing plan: create. Existing plan: replace dialog (B.3).
4. Success: navigate to `/`; focus the page heading; no toast. The calendar is the
   confirmation.

**Frozen paces.** The pace zones saved with the plan are the ones from the
`calculate()` run the runner was looking at when they tapped Create. They are stored
as a snapshot with the plan. `calculate()` runs **only on `/setup`**; nowhere else in
the app recomputes paces (see C.8).

If the runner edits any input after calculating, the results table stays (existing
rule: a bad edit never erases a good result) but **Create my plan** is disabled with
helper text `Calculate again to use your changes.` Otherwise a plan could be built
from inputs different from the paces on screen.

### B.2 Race-date validation (Sunday only)

Checks run in this order on **Calculate**; the first failing message shows on the Race
date field (`aria-invalid`, focus moves to the field):

| Order | Condition | Message |
|---|---|---|
| 1 | Date in the past (existing) | `Race date can't be in the past.` |
| 2 | Not a Sunday | `Race date must be a Sunday. Plan weeks run Monday to Sunday and finish on race day.` |
| 3 | Empty, at **Create my plan** only | `Enter your race date to create a plan.` |

Helper text changes from `The date of the race you're training for.` to `The date of
the race you're training for. Must be a Sunday.` so the rule is visible **before** the
error. Empty date on Calculate stays allowed (the form is also a pace calculator); it
blocks only at Create.

Compute the weekday from the `yyyy-mm-dd` string as a calendar date, not via a
timezone-shifted `Date`, so the check cannot be off by one west of UTC (swe: test a
Saturday-night-UTC case).

**Usability flag for tech-lead (needs product-owner validation).** Many marathons and
most road races are on Saturdays, so Sunday-only will reject some runners at the first
form. Implemented as the product-owner default. There is no event store, so this
cannot be measured; instead ask each tester what day their target race falls on and
whether the error felt arbitrary. If it is a recurring complaint, follow up by
accepting any day and anchoring weeks to it.

### B.3 Replace-confirm dialog

`AlertDialog` (modal, Radix). Opens on Create when a plan already exists.

```
┌───────────────────────────────────────┐
│ Replace your current plan?            │  AlertDialogTitle (H2)
│                                       │
│ This replaces your plan for the race  │  AlertDialogDescription
│ on Sun, May 17 with a new plan for    │  old race date from the stored plan
│ Sun, Jun 14. This can't be undone.    │  new race date from the form
│                                       │
│            [ Cancel ] [ Replace plan ]│  Cancel = default focus; Replace = destructive variant
└───────────────────────────────────────┘
```

- Exact copy: title `Replace your current plan?`; body `This replaces your plan for the
  race on {old date} with a new plan for {new date}. This can't be undone.`; buttons
  `Cancel`, `Replace plan`. Dates `Sun, May 17` (add year only if not the current year).
- Destructive button uses `destructive/text` fill with white label (verified in Tempo).
  Initial focus on `Cancel` because the action is not reversible.
- Esc and scrim click = Cancel. Focus returns to **Create my plan**.
- While replacing: `Replace plan` shows `Replacing…`, both buttons disabled; dialog
  stays open until the response arrives.
- Failure: close the dialog and show the B.5 error `Alert` on the page, so it is not
  lost.

### B.4 Create states

| State | Presentation |
|---|---|
| Not yet calculated | No Create action rendered. |
| Ready | `Create my plan` primary button, full width on mobile, below the results table, with the "Saved on this device" note (B.5). |
| Stale (inputs edited after Calculate) | Button `disabled` + helper `Calculate again to use your changes.` |
| Checking for existing plan | Button disabled, label unchanged. If the lookup **fails**, do not assume "no plan" (that would skip the confirm): show the B.5 error and keep the button disabled until retry. A **corrupt** stored plan counts as no plan (A.1). |
| Creating | Label `Creating your plan…`, `aria-busy="true"`, button disabled. |
| Error | B.5. |
| Success | Navigate to `/`, focus page heading. |

### B.5 Copy

| Context | Text |
|---|---|
| Action button | `Create my plan` |
| Creating | `Creating your plan…` |
| Stale helper | `Calculate again to use your changes.` |
| **Saved on this device** (Body-sm, `text/secondary`, under the button) | `Your plan is saved on this device only. Clearing your browser data removes it, and it won't appear on other devices.` |
| Race date empty at create | `Enter your race date to create a plan.` |
| Not a Sunday | `Race date must be a Sunday. Plan weeks run Monday to Sunday and finish on race day.` |
| Create failed (destructive `Alert`, `role="alert"`, above the button) | `Couldn't create your plan. Your entries are still here — try again.` |
| Existing-plan lookup failed | `Couldn't check for an existing plan. Try again.` + `Try again` button |
| Dialog | B.3 |

### B.6 Short runway (no warning) and long runway

Race closer than the template length (e.g. 12 weeks out for 18): **no warning**. The
plan is laid on real dates anchored to race day; the earliest weeks fall before today
and render as ordinary past weeks (collapsed, no status). The runner starts at the
current week. Tech-lead: confirm generation does not reject or clamp this.

Race further out than the template length: the plan starts in the future; the
calendar shows the **not-started** state (A.1). No warning, nothing blocked.

### B.7 Accessibility (plan setup additions)

- Keyboard order unchanged through Submit, then (after results) `Create my plan`.
- Race date error: `aria-invalid="true"`, `aria-describedby` to the message, focus to
  the field (existing mechanism).
- Create error `Alert`: `role="alert"`; focus stays on the button.
- Dialog: `role="alertdialog"`, labelled by title, described by body; focus trap;
  buttons >= 44px; destructive label is text, not color alone.
- Creating: `aria-busy` on the button and a polite live region `Creating your plan.`
  On success the calendar heading receives focus, which announces arrival.

### B.8 Data asked of the user

Nothing new. Race date and pace inputs were already collected; Create stores them
and the pace snapshot against an opaque plan id on this device (storage is
tech-lead's call, no email/name/device id). No new PII, no ADR from this spec.

---

## C. Routes, day detail (`Sheet`), `/paces`

### C.1 Routes

| Route | Renders | Edge cases |
|---|---|---|
| `/` | Calendar (all A.1 states). | **No plan: render the empty state here. Do not redirect to `/setup`.** |
| `/day/:date` | The **same calendar page** with the day sheet open. `:date` is ISO `yyyy-mm-dd`. | See below. |
| `/paces` | Pace-zones page (C.7). | No plan -> its empty state. |
| `/setup` | Plan setup (exists). | — |
| `/health` | The hello-world health page, moved here from `/`. | Not in header nav. |

`/day/:date` handling:

| Input | Behaviour |
|---|---|
| **Malformed** (not a real `yyyy-mm-dd` calendar date, e.g. `2026-13-40`, `abc`) | **Redirect to `/`** (`replace`). |
| **Valid date outside the plan** | Calendar behind, sheet shows **Not in your plan** (C.3). Tech-lead accepted this. |
| Valid date in the plan | Sheet shows the day. |
| No plan | Calendar empty state at `/day/:date` behind no sheet; same as `/` (no redirect to `/setup`). |
| Corrupt plan | As no plan, with the A.1 note. |

- Sheet open state is derived from the URL. Opening a row = navigating to its link.
  The calendar stays mounted behind the scrim (scroll position preserved).
- Close (X, Esc, scrim) -> `navigate(-1)` if the previous entry is in-app, else
  `navigate("/")`.
- Prev / Next -> `navigate(…, { replace: true })`, so Back returns to the calendar,
  not through every day stepped past.
- Behind the sheet, the week containing `:date` is expanded and the row scrolled into
  view.

### C.2 Why `Sheet`, not `Drawer`

shadcn `Sheet` is a Radix `Dialog` with a `side` prop: no extra dependency,
route-driven open state is trivial, and one component gives bottom sheet on mobile and
right-hand panel on wider screens. `Drawer` pulls in Vaul and its drag-gesture state
for a swipe-to-dismiss we do not need. The earlier spec's drag handle and "swipe down"
exit are dropped for Slice 1.

- `side="bottom"` below 768px (`max-h-[85svh]`, content scrolls), `side="right"` at
  >= 768px (`w-[420px]`). Swe picks `side` with a media-query hook.
- The scrim is modal; the calendar is visible but not interactive while open.

### C.3 Wireframes

**Running day (also race day):**

```
┌─────────────────────────────────────┐
│ ‹ Prev      Sun, Mar 15       Next › │  stepper; [✕] close at top-right, 44px
├─────────────────────────────────────┤
│  Long run                            │  SheetTitle, H2 — initial focus target (tabindex -1)
│  Week 9 of 18 · build                │  SheetDescription
│                                      │
│  10–12 mile long run, last 4 miles   │  template `description` verbatim, pace tokens
│  at marathon goal pace (MGP) (9:09/mi)│  resolved from the STORED snapshot (C.8)
│                                      │
│  Planned     14 mi                   │  distance, or duration if the template gives one
│  Easy 10:30 /mi · MGP 9:09 /mi       │  PaceStrip: only tokens used by this day's text
│  All pace zones →                    │  link to /paces
└─────────────────────────────────────┘
```

**Rest day:** title `Rest`, `Week 9 of 18 · build`, body `Nothing scheduled today.`

**Strength / cross-training:** title, `Week N of M · {phase}`, `description` verbatim.
No distance row, no pace strip, no `/paces` link (FR11).

**Race day:** as a running day, title `Race day`, plus one line `Marathon · 26.2 mi`.

**Not in your plan** (valid date, outside the plan):

```
│  Not in your plan                    │  title
│  There's no workout on that date.    │
│  [ Back to calendar ]                │  closes sheet
```

**Loading:** skeleton for title + two lines; sheet `aria-busy`.
**Error:** `Couldn't load this day.` + `Try again`.

No status chips, no activity section, no future/past distinction in the sheet.

### C.4 Components

| Element | Library | Notes |
|---|---|---|
| Container | `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` | New adoption. `SheetTitle` required for an accessible name. |
| Prev / Next / Close | `Button` (ghost/icon) | Lucide `chevron-left`, `chevron-right`, `x`. |
| Pace strip | custom `PaceStrip` | Uses `formatPace` from `@training-plan/pace-zones`. Numeral (inline) role for the pace figures, Body for labels. |
| Loading | `Skeleton` | Existing. |

### C.5 Day-sheet accessibility

- Radix handles focus trap, `role="dialog"`, `aria-modal`, Esc.
- Initial focus: the `SheetTitle` (`onOpenAutoFocus` -> focus it), so a screen reader
  hears the workout first, not "Close".
- Prev/Next change content in place: a polite live region announces `Showing Saturday,
  March 14`; focus stays on the pressed button. Prev is `aria-disabled` on the first
  plan day, Next on race day.
- Close returns focus to the originating day row (A.2).
- Targets >= 44px; stepper buttons use `aria-label` `Previous day` / `Next day` (icon
  only, so there is no visible label to conflict). Text >= 4.5:1.
- `prefers-reduced-motion`: sheet slide becomes a fade.

### C.6 (reserved)

No content; numbering kept so references from the first draft still resolve.

### C.7 `/paces` page

Full `PaceZoneTable` (plan-setup §7) for the active plan, so a runner can look up their
paces without re-entering anything. Paces come from the **stored snapshot**, never
recomputed.

```
┌─────────────────────────────────────┐
│ Your pace zones                      │  H1
│ For your race on Sun, May 17.        │  Body-sm
│ ┌───────────────┬───────────────┐   │
│ │ Recovery       │      9:10 /mi │   │  same PaceZoneTable as /setup
│ │ …              │               │   │  incl. Estimated badges + warning banner when source = goalTime
│ └───────────────┴───────────────┘   │
└─────────────────────────────────────┘
```

| State | What shows |
|---|---|
| Loading | `Skeleton` rows. |
| No plan | `No plan yet` + `Set up plan` -> `/setup`. |
| Corrupt plan | No-plan state plus the A.1 note. |
| Error | `Couldn't load your pace zones` + `Try again`. |
| Populated | As above. |

**Reference copy variant (approved by tech-lead with conditions).** On `/setup` the
table's strings say "above" and jump to the form. `/paces` has no form. Rule: **keep
all safety wording verbatim; change only the call to action** (the part that says
"Add … above" / the "above" link). Give `PaceZoneTable` a reference variant that uses
the strings below. They are named `*_REFERENCE_COPY` and live in
`apps/web/src/lib/pace-zone-display.ts` **next to the originals**. They cover **every**
string in that file containing "above":

| New constant | Original | Reference text (link text in **bold**) |
|---|---|---|
| `BLOCKED_EQUIVALENCY_ZONE_REFERENCE_COPY` | `BLOCKED_EQUIVALENCY_ZONE_COPY` ("Add a recent result above to see this.") | **Create a new plan** with a recent result to see this. |
| `GOAL_VDOT_BELOW_TABLE_ZONE_REFERENCE_COPY` | `GOAL_VDOT_BELOW_TABLE_ZONE_COPY` | Your goal time doesn't support estimating this pace. **Create a new plan** with a recent result to see it. |
| `UNSET_GOAL_ZONE_REFERENCE_COPY` | `UNSET_GOAL_ZONE_COPY` ("Add a goal time above to see this.") | **Create a new plan** with a goal time to see this. |
| `GOAL_DERIVED_WARNING_REFERENCE_COPY` | `GOAL_DERIVED_WARNING_COPY` | These paces are estimated from your goal time, not a race you've run. If that goal is ambitious, expect all of them — especially Interval and 5K — to run faster than your current fitness supports. **Create a new plan** with a recent result for paces based on what you've actually run. |
| `ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY` | `ESTIMATED_BADGE_TOOLTIP` | Estimated from your goal time — not a demonstrated result. Create a new plan with a recent result for more accurate paces. |

`ESTIMATED_BADGE_LABEL` ("Estimated") contains no "above" and is reused unchanged.
Each "Create a new plan" link goes to `/setup`; all other words are as the original.
The `{before, jumpLinkText, after}` shape is kept so the table renders both variants
the same way.

**Jump-link `ariaLabel`s** (currently "Add a recent result — jump to Recent race result
section" and "Add a goal time — jump to Goal time section") are reworded in the
reference variant, because the link now navigates away:

- `Create a new plan with a recent result — go to plan setup`
- `Create a new plan with a goal time — go to plan setup`

In both, the visible link text ("Create a new plan") is contained in the accessible
name (label-in-name). The `/setup` originals are unchanged.

Because the jump-links now leave the page, they are real links (`<a>`/`Link` to
`/setup`), not scroll buttons.

### C.8 Frozen paces — where pace text comes from

- Every pace figure outside `/setup` — the resolved workout text in the day sheet, the
  `PaceStrip`, the `/paces` table — is rendered from the **pace snapshot stored with
  the plan** at creation time.
- **`calculate()` is called only on `/setup`.** No calendar, day-sheet, or `/paces`
  code path calls it or recomputes paces. A runner's paces therefore never shift under
  an existing plan; the only way to change them is to create a new plan (replace flow).
- The snapshot's `paceSecPerMile` values are integers (the stored-snapshot schema
  uses `.int()`), plus each zone's `state`/`source`, so the Estimated treatment
  survives to `/paces`.

---

## D. `formatPace` — one home

- **`formatPace` lives in `packages/pace-zones`** (exported from `src/index.ts`).
  Output: `"7:45 /mi"`.
- `apps/web/src/lib/pace-zone-display.ts` **stops defining it** and imports it from
  `@training-plan/pace-zones`; all web code (`PaceZoneTable`, calendar, day sheet,
  `PaceStrip`) imports from the package only. No second copy.
- `pace-zone-display.ts` keeps what is display-only for the full table: zone order,
  captions, `goalZoneLabel`, blocked/unset copy, Estimated copy, and the new
  `*_REFERENCE_COPY` strings.
- Reason: day-detail text, the pace strip, and the future iOS/Android clients need
  identical pace text; CLAUDE.md puts shared logic in `packages/`. The description
  token-substitution helper lives there too (`training-calendar.md` §5.3).
- Test move: `formatPace` cases move from `pace-zone-display.test.ts` to the package.
- **Rounding rule: round the total first, then split.**
  `total = Math.round(sec)`, `m = Math.floor(total / 60)`, `s = total % 60`; seconds
  zero-padded to two digits. Examples: `479.6` -> `"8:00 /mi"` (not `7:60`),
  `479.4` -> `"7:59 /mi"`. Rounding after splitting produces `7:60`, so do not.
  The stored snapshot schema validates `paceSecPerMile` with `.int()`, so stored
  values are already whole; the rounding stays as a defensive guard for fresh
  `calculate()` output on `/setup`.

---

## Look and feel — references

| App | Surface | Borrow | Skip |
|---|---|---|---|
| **TrainingPeaks** | Calendar week row | Week as the unit, planned total beside it. | TSS/IF jargon, completed/planned overlays (deferred). |
| **Runna** | Plan home | Opens on this week, countdown to race. | Chatty rewritten workout copy; paywall gating. |
| **Notion Calendar** | Today marker | One unmistakable `Today` idiom. | Hour grid. |
| **Linear** | Issue peek panel | Route-driven side panel: URL is the state, Esc closes, Prev/Next steps through items. | Dense multi-field chrome. |
| **Things 3** | Task detail | Quiet detail view, title first, nothing decorative. | Checkbox/complete affordances (no status yet). |

**Direction.** The calendar is the home screen and opens on this week; each day is one
line with the template's own workout name and number; tapping it opens a
URL-addressable panel (Linear's peek) showing the template's words with the runner's
frozen paces resolved inline. With statuses and Strava deferred, the surface is
deliberately plain: Tempo neutrals, Figtree, one orange `Today`. Principles: calendar
is home; one tap into a day, one tap back; the template's text is shown verbatim; no
status the product cannot yet compute; paces never change under an existing plan.

## New vs. reused patterns

| Pattern | New? | Why |
|---|---|---|
| `Sheet` for day detail | New primitive | `Dialog` has no side/bottom layout; `Drawer` rejected (C.2). |
| `AlertDialog` for replace-plan | Reused (adopted for Strava disconnect) | Same "confirm a consequential action" job. |
| Route-driven overlay (`/day/:date`) | New | First screen where URL equals overlay state. |
| `PaceStrip` | New, custom | The compact variant `plan-setup-flow.md` §7.4 deferred; built now because day detail is in this slice. |
| `*_REFERENCE_COPY` variant on `PaceZoneTable` | New | Same table, no form to jump to. |
| `Accordion` week block | First build | Already adopted in the toolkit, not yet built. |

## Validate with users

- Sunday-only race date (B.2): qualitative only. Ask what day their target race is
  and whether the error felt arbitrary.
- Whether a plain calendar with no done/not-done marks feels empty to someone who has
  already started training; the main risk of deferring status.
- "Saved on this device" (B.5): whether runners notice it and understand that
  clearing browser data loses the plan.
