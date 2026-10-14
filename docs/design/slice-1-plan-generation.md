# Design spec — Slice 1: create a plan, see it on real dates, open a day

> Owned by `@designer`. "PR 0" (docs only) for issues #13 "Generate personalized
> plan instance from template + derived paces", #16 "Render plan calendar on real
> calendar dates", #17 "Build day-detail display: workout text + distance/duration
> or Rest".
>
> **How this file relates to the other specs.** This is the single source of truth
> for Slice 1. It is written as four self-contained parts so each can be lifted
> verbatim into its parent spec when someone has an editor for those large files:
>
> | Part | Belongs in | Heading to use there |
> |---|---|---|
> | A. Calendar Slice 1 scope | `training-calendar.md`, directly after "Revision history", before "## 1." | `## Slice 1 — what is in, what is deferred` |
> | B. Plan setup: Create my plan | `plan-setup-flow.md`, new section after §12 | `## 13. Slice 1 — "Create my plan"` |
> | C. Day detail + `/paces` | referenced by A; supersedes the Drawer wording in `training-calendar.md` §3 Flow 2 and §4.2 for Slice 1 | — |
> | D. `formatPace` home | `plan-setup-flow.md` §7.4 and `ui-toolkit.md` (toolkit already updated) | — |
>
> **Where this wins.** For Slice 1 behaviour, this file overrides
> `training-calendar.md` and `plan-setup-flow.md` wherever they disagree. The
> deferred material in those specs stays valid and is not rewritten.
>
> **Sourcing caveat.** I had no shell/`gh` access in this session, so I did not
> read the tech-lead plan on #13/#16/#17. This spec is built from the
> product-owner defaults in the task brief plus the existing specs and code.
> Anything the tech-lead plan contradicts, the plan wins on engineering and this
> spec wins on UI; flag differences back.
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
| 8 | `Today` pill in the top bar | Scrolls to and expands the current week. Shown only when the current week is off-screen. |
| 9 | Day detail at `/day/:date` as a `Sheet` | Part C. |
| 10 | `/paces` page | Part C. |
| 11 | Empty / loading / error states for calendar | Reuse §4.3–4.5 of `training-calendar.md` unchanged. |
| 12 | Header nav: `Plan`, `Pace zones`, `New plan` | `New plan` goes to `/setup`. |

### Deferred (not built in Slice 1)

| Deferred | Why |
|---|---|
| All five completion-status chips (Planned/Achieved/Partial/Missed/Rest) and `StatusBadge` | Product-owner default 3. Status is computed from confirmed Strava matches; with no Strava in this slice every elapsed day would read "Missed", which is wrong and discouraging. |
| `ActivityMatchCard`, confirm/dismiss/undo, multi-match, bonus entries, `Suggestion` and `Swap` row tags | Need Strava sync (#18, #24). |
| Connection / reconnect / backfill banners | No Strava. |
| Weekly **completed** totals (`18 / 32 mi`) | Needs confirmed activity. Slice 1 shows planned miles only. |
| Plan progress bar (`Progress`) | Pure polish; the text `Week 9 of 18` carries the same information. Avoids adopting one more primitive. |
| `• • •` ellipsis for distant weeks | An 18-header accordion is short enough. The race-week-always-visible rule is satisfied trivially. Revisit if the template list grows. |
| Desktop 7-column week grid (`training-calendar.md` §4.6) | Slice 1 uses the same stacked week list at every width (`max-w-2xl`, centered), as plan setup does. Cheap follow-up, not a redesign. |
| Drag-down-to-dismiss on the day sheet | `Sheet`, not `Drawer` (Part C). Close button, scrim, Esc. |
| Short-runway warning | Product-owner default 5. See B.6 for how short runways render. |
| Mileage inputs / scaling | Product-owner default 1. |
| Post-race state (#56), day-swap detection (#57), plan switching (#32/#33) | Unchanged from the calendar spec. |

### Why this cut

The slice is "I made a plan and I can see what to do on Tuesday." Everything
deferred is either a function of Strava data (which does not exist yet) or polish
that does not change whether that sentence is true.

### Slice 1 calendar wireframe (mobile, populated)

```
┌─────────────────────────────────────┐
│ [≡] Plan  Pace zones  New plan (Today)│  Header nav. Today pill only when current week is off-screen
├─────────────────────────────────────┤
│  9 weeks to race day                │  Display (Figtree), not mono
│  Week 9 of 18 · build               │  Body-sm, text/secondary
├─────────────────────────────────────┤
│ ▸ Week 8   Mar 2–8          28 mi   │  collapsed, planned miles only (no ✓, no x/y)
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
`distanceMiles` formatted as `5 mi` (drop `.0`, keep `.5`, `26.2`). Distances are
numbers in a comparison column only on a future desktop grid; in the stacked list
they are Body, not Numeral.

Countdown copy: `N weeks to race day` -> `1 week to race day` -> `Race week` ->
`Race day is today` -> after race day: `Race day was {Sun, May 17}` (nothing else;
#56 owns the aftermath).

### A. Calendar states

| State | What shows |
|---|---|
| Loading | Skeleton mirroring header + week rows, `aria-busy="true"` on `<main>`. |
| No plan | Empty state, one CTA `Set up plan` -> `/setup`. |
| Error | `Couldn't load your plan` + `Try again`. |
| Populated | Wireframe above. |
| Just created | Same as populated; focus lands on the `<h1>`/countdown heading (see B.4). |

### A. Accessibility (calendar, Slice 1)

- Order: header nav, Today pill (if shown), week headers and day rows in DOM order.
- Week header is the `Accordion` trigger (button, `aria-expanded`). Day rows are
  anchors, so middle-click and deep links work.
- Today is `Today` text plus accent border; add `aria-current="date"` to that row.
- Row accessible name: `Friday, March 13: Easy run, 4 miles` / `Wednesday, March 11: Rest`
  (via `aria-label` on the link; visible text may abbreviate).
- Rows and headers >= 44px tall. Text >= 4.5:1 using Tempo tokens; Rest uses
  `text/secondary`, never `text/disabled`.
- On sheet close, focus returns to the row for that date (swe: route-driven sheets
  do not get Radix's trigger-restore for free; focus `[data-date="…"]` manually).

---

## B. Plan setup — "Create my plan" (for `plan-setup-flow.md`, new §13)

Plan setup stays **one page, no wizard** (§3). Slice 1 adds one action after the
results, one validation rule, and one confirm dialog. The existing "Calculate my
pace zones" button and everything it does are unchanged.

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
   Sunday rule (B.2) is checked here, with the existing past-date check, so a bad
   date is caught before the runner sees paces they cannot use.
2. On `ok: true` the pace table appears (unchanged) and a **Create my plan**
   action appears directly beneath it, in the same results `Card`.
3. Tap **Create my plan**. If there is no existing plan, create it. If there is
   one, show the replace dialog (B.3).
4. Success: navigate to `/`; focus the page heading; no toast. The calendar is the
   confirmation.

If the runner edits any input after calculating, the results table stays (existing
rule: a bad edit never erases a good result) but the **Create my plan** button is
disabled with helper text `Calculate again to use your changes.` Otherwise a plan
could silently be built from inputs different from the paces on screen.

### B.2 Race-date validation (Sunday only)

Checks run in this order on **Calculate**; the first failing message is shown on
the Race date field (`aria-invalid`, focus moves to the field):

| Order | Condition | Message |
|---|---|---|
| 1 | Date in the past (existing) | `Race date can't be in the past.` |
| 2 | Not a Sunday | `Race date must be a Sunday. Plan weeks run Monday to Sunday and finish on race day.` |
| 3 | Empty, at **Create my plan** only | `Enter your race date to create a plan.` |

Helper text under the field changes from `The date of the race you're training
for.` to `The date of the race you're training for. Must be a Sunday.` so the rule
is visible **before** the error. Empty date on Calculate stays allowed (existing
behaviour: the form is also a pace calculator); it blocks only at Create.

Compute weekday from the `yyyy-mm-dd` string as a calendar date, not via a
timezone-shifted `Date`, so the Sunday check cannot be off by one west of UTC
(swe: test a Saturday-night-UTC case).

**Usability flag for tech-lead (needs product-owner validation).** Many marathons
and most road races are on Saturdays. Sunday-only will reject a real share of
runners at the first form. I am implementing the product-owner default, but
recommend (a) tracking how often this error fires and (b) a follow-up to accept
any day and anchor weeks to it. Not done here.

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

- Copy is exact: title `Replace your current plan?`; body `This replaces your plan
  for the race on {old date} with a new plan for {new date}. This can't be undone.`;
  buttons `Cancel`, `Replace plan`. Dates formatted `Sun, May 17` (add year only
  if different from the current year).
- Destructive button uses `destructive/text` fill tokens with white label (already
  verified in Tempo). Initial focus on `Cancel` (Radix `AlertDialogCancel` does
  this) because the action is not reversible.
- Esc and scrim click = Cancel. Focus returns to **Create my plan**.
- While replacing: `Replace plan` shows `Replacing…` and both buttons are disabled;
  the dialog stays open until the response arrives.
- Failure inside the dialog: close it and show the B.5 error `Alert` on the page,
  not inside the dialog, so it is not lost.

### B.4 Create states

| State | Presentation |
|---|---|
| Not yet calculated | No Create action rendered. |
| Ready | `Create my plan` primary button, full width on mobile, below the results table. |
| Stale (inputs edited after Calculate) | Button `disabled` + helper `Calculate again to use your changes.` |
| Checking for existing plan | Button disabled, label unchanged. Resolve before the runner can plausibly act; if the lookup fails, treat as "no existing plan" is **wrong** (it would skip the confirm), so show the B.5 error and keep the button disabled until retry. |
| Creating | Label `Creating your plan…`, `aria-busy="true"`, button disabled. |
| Error | B.5. |
| Success | Navigate to `/`, focus heading. |

### B.5 Copy

| Context | Text |
|---|---|
| Action button | `Create my plan` |
| Creating | `Creating your plan…` |
| Stale helper | `Calculate again to use your changes.` |
| Race date empty at create | `Enter your race date to create a plan.` |
| Not a Sunday | `Race date must be a Sunday. Plan weeks run Monday to Sunday and finish on race day.` |
| Create failed (destructive `Alert`, `role="alert"`, above the button) | `Couldn't create your plan. Your entries are still here — try again.` |
| Existing-plan lookup failed | `Couldn't check for an existing plan. Try again.` + `Try again` button |
| Dialog | see B.3 |

### B.6 Short runway (no warning)

If the race date is closer than the template length (e.g. 12 weeks out for an
18-week template), **no warning is shown**. The plan is laid on real dates anchored
to race day; the earliest weeks fall before today and render as ordinary past
weeks (collapsed, no status, no distinction). The runner starts at the current week.
Tech-lead: confirm plan generation does not reject or clamp this case.

### B.7 Accessibility (plan setup additions)

- Keyboard order: unchanged through Submit, then (after results) the
  `Create my plan` button.
- Race date error: `aria-invalid="true"`, `aria-describedby` to the message,
  focus to the field (existing mechanism).
- Create error `Alert`: `role="alert"`; focus stays on the button.
- Dialog: `role="alertdialog"`, labelled by title, described by body; focus trap;
  buttons >= 44px; destructive label is text, not color alone.
- Creating: `aria-busy` on the button, polite live region `Creating your plan.` On
  success the destination page heading receives focus, which announces arrival.

### B.8 Data asked of the user

Nothing new. Race date and pace inputs were already collected; Create persists
them against an opaque plan id (tech-lead's call, no email/name/device id). No new
PII, no ADR from this spec.

---

## C. Day detail (`Sheet` at `/day/:date`) and `/paces`

### C.1 Routing

| Route | Renders |
|---|---|
| `/` | Calendar. |
| `/day/:date` | The **same calendar page** with the day sheet open over it. `:date` is ISO `yyyy-mm-dd`. |
| `/paces` | Pace-zones page. |
| `/setup` | Plan setup (exists). |

- Sheet open state is derived from the URL. Opening a row = navigating to its link.
  The calendar stays mounted behind the scrim (scroll position preserved).
- Close (X, Esc, scrim) -> `navigate(-1)` if the previous entry is in-app, else
  `navigate("/")`.
- Prev / Next -> `navigate(…, { replace: true })`, so Back returns to the calendar,
  not through every day stepped past.
- Behind the sheet, the week containing `:date` is expanded and the row scrolled
  into view.
- `:date` outside the plan or malformed -> sheet state C.5 (not found). No plan at
  all -> redirect to `/setup`.

### C.2 Why `Sheet`, not `Drawer`

shadcn `Sheet` is a Radix `Dialog` with a `side` prop: no extra dependency, route
-driven open state is trivial, and it gives bottom sheet on mobile and right-hand
panel on desktop from one component. `Drawer` pulls in Vaul and its drag-gesture
state for a swipe-to-dismiss we do not need. The earlier spec's drag handle and
"swipe down" exit are dropped for Slice 1.

- `side="bottom"` below 768px (`max-h-[85svh]`, content scrolls), `side="right"` at
  >= 768px (`w-[420px]`). Swe picks `side` with a media-query hook.
- The scrim is modal; the calendar is visible but not interactive while open. The
  earlier "calendar stays usable beside the panel" idea is not a Slice 1 goal.

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
│  at marathon goal pace (MGP) (9:09/mi)│  resolved inline via the package helper (see D)
│                                      │
│  Planned     14 mi                   │  distance, or duration if the template gives one
│  Easy 10:30 /mi · MGP 9:09 /mi       │  pace strip: only tokens used by this day's text
│  All pace zones →                    │  link to /paces
└─────────────────────────────────────┘
```

**Rest day:**

```
│  Rest                                │
│  Week 9 of 18 · build                │
│  Nothing scheduled today.            │
```

**Strength / cross-training:** title, `Week N of M · {phase}`, `description` verbatim.
No distance row, no pace strip, no `/paces` link (FR11).

**Race day:** same as a running day, title `Race day`, plus one line
`Marathon · 26.2 mi`.

**C.5 Not found** (bad or out-of-plan date):

```
│  Not in your plan                    │
│  There's no workout on that date.    │
│  [ Back to calendar ]                │  closes sheet
```

**Loading:** skeleton for title + two lines; sheet has `aria-busy`.
**Error:** `Couldn't load this day.` + `Try again`.

There are **no status chips, no activity section, no future/past distinction** in
the sheet. A past day looks identical to a future one.

### C.4 Components

| Element | Library | Notes |
|---|---|---|
| Container | `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` | New adoption. `SheetTitle` is required for an accessible name. |
| Prev / Next / Close | `Button` (ghost/icon) | Lucide `chevron-left`, `chevron-right`, `x`. |
| Pace strip | custom `PaceStrip`, built from `Badge`-like inline text | Uses `formatPace` from `@training-plan/pace-zones`. Numeral (inline) role is allowed here (a compared-values strip), Body for labels. |
| Loading | `Skeleton` | Existing. |

### C.6 Day-sheet accessibility

- Radix handles focus trap, `role="dialog"`, `aria-modal`, Esc.
- Initial focus: the `SheetTitle` (`onOpenAutoFocus` -> focus it), so a screen reader
  hears the workout first, not "Close".
- Prev/Next change content in place: a polite live region announces `Showing
  Saturday, March 14` and focus stays on the pressed button. Prev is
  `aria-disabled` on the first plan day, Next on race day.
- Close returns focus to the originating day row (A: Accessibility).
- Targets >= 44px; the stepper buttons carry text or `aria-label` (`Previous day`,
  `Next day`). Text >= 4.5:1.
- `prefers-reduced-motion`: disable the sheet slide animation (fade only).

### C.7 `/paces` page

Full `PaceZoneTable` (plan-setup §7) for the active plan, so a runner can look up
their paces without re-entering anything. Paces come from the **stored plan**, not
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
| Error | `Couldn't load your pace zones` + `Try again`. |
| Populated | As above. |

**One adaptation, needs sign-off.** On `/setup` the table's copy says "Add a recent
result **above**" with a jump-link to the form. There is no form above on `/paces`.
Give `PaceZoneTable` a `variant="reference"` (or equivalent prop; swe's naming)
that swaps only the trailing sentence and keeps the rest verbatim:

- Warning banner end: `Create a new plan with a recent result for paces based on
  what you've actually run.` where `Create a new plan` links to `/setup`.
- Goal-unset row: `Create a new plan with a goal time to see this.` (same link).

This edits data-scientist-authored copy (#52); tech-lead to confirm the wording
before it ships. No other table change.

---

## D. `formatPace` — one home

- **`formatPace` lives in `packages/pace-zones`** (exported from `src/index.ts`).
  Output unchanged: `"7:45 /mi"`.
- `apps/web/src/lib/pace-zone-display.ts` **stops defining it** and imports it from
  `@training-plan/pace-zones`; web code (`PaceZoneTable`, calendar, day sheet,
  `PaceStrip`) imports from the package only. No second copy anywhere.
- `pace-zone-display.ts` keeps what is display-only for the full table: zone order,
  captions, `goalZoneLabel`, blocked/unset copy, Estimated copy.
- Reason: the day-detail resolved description, the pace strip, and the future iOS
  and Android clients all need identical pace text, and CLAUDE.md puts shared
  logic in `packages/`, not `apps/web/`. The description token-substitution helper
  also lives in the package (per `training-calendar.md` §5.3).
- Test move: `formatPace` cases move from `pace-zone-display.test.ts` to the package.
- Open edge for swe: `Math.floor(sec/60)` with a non-integer `paceSecPerMile` can
  produce `7:5.3`; round to whole seconds inside `formatPace` before splitting.

---

## Look and feel — references

| App | Surface | Borrow | Skip |
|---|---|---|---|
| **TrainingPeaks** | Calendar week row | Week as the unit, planned total beside it. | TSS/IF jargon, completed/planned overlays (deferred). |
| **Runna** | Plan home | Opens on this week, countdown to race. | Chatty rewritten workout copy; paywall gating. |
| **Notion Calendar** | Today marker | One unmistakable `Today` idiom. | Hour grid. |
| **Linear** | Issue peek panel | Route-driven side panel: URL is the state, Esc closes, Prev/Next steps through items. | Dense multi-field chrome. |
| **Things 3** | Task detail | Quiet detail view, title first, nothing decorative. | Checkbox/complete affordances (no status yet). |

**Direction.** The calendar is the home screen and opens on this week; each day is
one line with the template's own workout name and number; tapping it opens a
URL-addressable panel (Linear's peek) showing the template's words with the
runner's pace resolved inline. With statuses and Strava deferred, the surface is
deliberately plain: Tempo neutrals, Figtree, one orange `Today`. Principles:
calendar is home; one tap into a day, one tap back; the template's text is shown
verbatim; no status the product cannot yet compute.

## New vs. reused patterns

| Pattern | New? | Why |
|---|---|---|
| `Sheet` for day detail | New primitive | `Dialog` has no side/bottom layout; `Drawer` rejected (C.2). |
| `AlertDialog` for replace-plan | Reused (adopted for Strava disconnect) | Same "confirm a consequential action" job. |
| Route-driven overlay (`/day/:date`) | New | First screen where URL equals overlay state. |
| `PaceStrip` | New, custom | The compact variant `plan-setup-flow.md` §7.4 deferred; built now because day detail is in this slice. |
| `Accordion` week block | First build | Already adopted in the toolkit, not yet built. |

## Validate with users

- Sunday-only race date (B.2): watch how many people hit the error; ask what day
  their target race is.
- Whether a plain calendar with no done/not-done marks feels empty to someone who
  has already started training; this is the main risk of deferring status.
