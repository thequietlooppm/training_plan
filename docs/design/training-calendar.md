# Design spec — Training calendar + day detail (view, Strava match, completion status)

> Owned by `@designer`. Status: **ready for implementation once PR #58
> (`docs/completion-status-fr-update`) is merged to `main`** (see "Dependencies"
> below). PR #53 is already on `main`. Scoped against issues #16/#17/#18
> (calendar + day-detail) and #24 (Strava activity-match UI in the day-detail
> sheet), FR8–FR22 in `docs/planning/web-v1-requirements.md` (as updated by
> **PR #58**, "docs: update completion-status FRs (Planned, any run = Achieved,
> activity swap)"), and ADR 0005
> (`docs/decisions/0005-plan-template-schema.md`) for the template's `dayType` /
> `description` / `distanceMiles` / `phase` fields.
> Companion spec: `docs/design/strava-connect-settings.md` (issue #20 — the
> connect/disconnect flow this screen assumes already exists). Old throwaway
> wireframe `docs/design/wireframes/training-calendar-marathon.html` is stale
> against this revision (built against the pre-FR "mark complete/skip" flow) —
> do not build from it; it is not being regenerated in this pass.
>
> ### Dependencies — where the things this spec names are defined
>
> **This PR (#55) touches only this file and `strava-connect-settings.md`. It
> does not modify `docs/design/ui-toolkit.md`.** The following are already on
> `main` (landed with **PR #53**, "plan-setup flow + pace-reference table"):
>
> | Referenced here | Defined in | Status |
> |---|---|---|
> | **Tempo** color/type system (tokens `text/secondary`, `accent/solid`, `border/subtle`, `destructive/text`, Display / Numeral / H2 / Body roles) | `docs/design/ui-toolkit.md` | ✓ on `main` (#53) |
> | **Completion-status decision** (Achieved / Partial / Missed / Rest: icon + label + hex + verified contrast ratios). **Planned is not in #53's table** — it is a fifth value added by PR #58; its chip is specified in §5.7 and must be added to the toolkit with verified contrast (§10). | `docs/design/ui-toolkit.md` | ✓ on `main` (#53, + §10 addition pending #58) |
> | `plan-setup-flow.md` §7.4 (compact pace-reference chip strip, deferred to this day-detail sheet; `PaceZoneTable` helpers, `lib/pace-zone-display.ts`) | `docs/design/plan-setup-flow.md` | ✓ on `main` (#53) |
> | Already-adopted primitives cited here (`Alert`, `RadioGroup`, `Skeleton`) | `plan-setup-flow.md` / `ui-toolkit.md` | ✓ on `main` (#53) |
> | **Completion-status FRs** (Planned / any run = Achieved / activity swap) | `docs/planning/web-v1-requirements.md` | **Pending PR #58** |
>
> The rows this spec **adds** to the toolkit (the Planned chip and
> activity-swap tag) are listed in §10 (a delta-only list now that #53 is on
> `main`). `StatusBadge`, `AlertDialog`, `ActivityMatchCard`, the Lucide glyph
> set, and the Tempo tokens all arrived with #53 and are already in
> `ui-toolkit.md`.
>
> **Revision history**
>
> - **2026-09-28, pass 1 — full rewrite of the flow, plus review fixes.**
>   The previous version designed a manual binary **"Mark complete / Skip"**
>   button. That no longer matches the product: per FR13–FR14, activities sync
>   **automatically** from Strava and the runner **confirms or dismisses a
>   suggested match**. Status is **computed**, not toggled. Review round 1
>   (PR #55) then corrected: template pace-zone shorthand + compact pace
>   reference on every running day (FR8/FR10); no blank/undetermined status
>   (FR19); strength/cross-training going through `ActivityMatchCard` (FR14); an
>   explicit FR22 mapping; race week kept as a real 7-day block; the
>   auth-expired banner drawn here (§4.1c); and an API-shape requirement (§5.6).
> - **2026-09-28, pass 2 — follows PR #58 (completion-status FRs).** Status is
>   now **five** values: **Planned** / Achieved / Partial / Missed / Rest.
>   Changes: (1) new **Planned** status for today until an activity is
>   confirmed — replaces the earlier "today shows Missed" treatment; Planned
>   becomes Missed at the runner's local midnight (FR19); (2) **any confirmed
>   run of any Strava run type is Achieved** on a running day — no distance
>   threshold, the old "short run = Partial" state is removed (FR20); (3) a
>   confirmed **non-run on a run day** (Walk, Hike, Ride…) stays **Missed** but
>   shows an **"activity swap"** indicator (FR20); (4) a **Rest day with an
>   activity stays Rest**, shown as a bonus entry (FR17); (5) **Partial** is
>   reachable in v1 only by a run on a strength day (FR21); (6) unconfirmed or
>   dismissed suggestions never change status, elapsed Missed days carry a
>   quiet **"Suggestion"** cue, and late-synced suggestions on old days are
>   drawn (§4.2j); (7) race day is a normal running day; freeform days (FR22)
>   remain deferred; (8) run classification comes from Strava sport type
>   (§5.7); (9) weekly totals are informational (§5.7, §8).

---

## 1. What this screen is

The home screen of the app: a runner opens it and sees their personalized
training plan laid out on real calendar dates, from today back to the plan
start and forward to race day. It answers three questions at a glance:

1. **What am I doing today?**
2. **What's the long run this week, and how big?**
3. **How many weeks until the race?**

**Scope for this pass:**
- View the personalized plan on real dates (FR9): each day shows the
  template's **freeform pace-zone description** plus the hand-set distance/
  duration, or "Rest" (FR10); strength/cross-training days show as scheduled
  entries with no computed pace/distance target (FR11).
- See each elapsed/current day's **computed** status — Planned (today only) /
  Achieved / Partial / Missed / Rest (FR19–FR22) — never manually toggled and
  **never blank**. Future days show no status.
- Open a single day for detail: prescription, the **compact pace reference**,
  any Strava-matched activity/activities, and the status that follows.
- **Confirm or dismiss** a suggested Strava match (FR14) on **every day type**
  (running, strength/cross-training), **undo** a confirmed match, and **pick
  one** from multiple plausible same-day matches (FR18, "none of these"
  always an option).
- See a confirmed **non-run on a run day** as an **activity swap** (Missed,
  with the activity shown), and unscheduled or extra activities as
  **unlinked/bonus entries** — never dropped, never silently applied (FR17).
- See race day as a milestone (and a normal running day for scoring), with
  **race week kept as a full 7-day block**.

**Explicitly not in this pass:**
- **No manual "Mark complete" / "Skip" button** — superseded by FR13/FR14.
- Editing/moving workouts, generating the plan itself (#12/#13). The **full**
  pace-zone table is not redesigned here — it belongs to plan setup
  (`plan-setup-flow.md` §7 / §7.4, arriving with #53). What **is** specced
  here is the compact reference strip inside the day-detail sheet (§4.2),
  because #53's §7.4 defers that variant to this sheet.
- Plan switching (#32/#33) and Google Calendar sync (#34–36). This screen
  assumes **exactly one active plan** (FR24).
- Strava connect/disconnect itself (`strava-connect-settings.md`); this doc
  covers only what the calendar looks like once a connection state exists (or
  doesn't), including the two connection banners (§4.1b, §4.1c).
- **Detecting day swaps after the fact** (e.g. the runner did Thursday's
  workout on Wednesday) — Backlog issue #57, "Detect day swaps after the
  fact". The "activity swap" here is only the FR20 case: a non-run confirmed
  on a run day.
- **Race-day aftermath** (what a runner does after race day) — Backlog issue
  #56, "Define what a runner does after race day (post-race
  baseline/maintenance plan)".

### Assumptions carried forward

- A typical 16–20 week block, weekly structure, one long run per week.
- The plan already exists by the time this screen renders (#12/#13).
- **Settled by the brief + ADR 0005 (no longer open):** distances are **miles
  only** in v1 (`distanceMiles`, product brief "Units. Miles only for v1"),
  weeks are **Monday-start** (ADR 0005: `days` "exactly 7, Monday-start, race
  day = Sunday of the final week"), and each week carries a template `phase`
  (`base | build | peak | taper`) that supplies the phase label.

---

## 2. Look and feel — references

Same "longitudinal view, not a one-shot form" job as the prior pass, plus two
categories added on Patrick's request: **calendar apps** (dense dated-grid
conventions) and **todo/checklist apps** (done/pending/skipped visual language
— relevant because status is now a computed, rendered state).

### Layout references (kept from the prior pass)

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **TrainingPeaks** (web/app, "Calendar") | The canonical dated marathon plan. Week is a horizontal unit with a **weekly summary** pinned beside it. Planned workout shows as a faint outline, completed as a filled version of the same shape. | Week-as-a-unit layout; the planned-outline → completed-fill pairing (now paired with the status chip, not a bare fill); per-week volume total (`18 / 32 mi`). | Coach-facing density; TSS/IF/CTL jargon; cramped desktop-first grid; sluggish, busy mobile view. |
| **Runna** (iOS/Android, marathon plans) | Purpose-built for this. Lands on **"this week"**, plan organised around one key long run, race day is a visual finish-line milestone with a countdown. | Default to the current week; race day as a distinct milestone card with "N weeks to go". | Heavy paywall gating mid-flow; saturated gradient styling; over-coached daily tips and modals; rewriting the plan's own workout text into chatty copy (see principles). |
| **Strava** (web, "Training Log" / mobile calendar) | Past vs. future reads instantly: completed runs are solid cards with a satisfying "done" state; each week has a small mileage bar. | The clear done/not-done contrast; a lightweight weekly volume indicator; calm, content-first list density. | Social feed, kudos, comments; blending all activity types together; clutter around each entry. |
| **Notion Calendar** (formerly Cron) | Calendar craft: an unmistakable **today** marker, restrained type hierarchy, muted weekends, smooth keyboard movement between days/weeks. | The single high-contrast "today" treatment; muted rest/weekend cells; keyboard navigation between days. | The hour-grid time-blocking model; dense multi-calendar overlays. |

### Calendar-app density references

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **Google Calendar** (month/week grid) | A dense grid of dated entries without clutter — each cell shows just enough (a dot or a one-line chip); full detail is one tap away. | "One compact chip per day, full detail on open": day row (mobile) and day cell (desktop) show workout name + one number + status icon, nothing more. | Month grid as default (wrong unit — see §1); multi-event stacking per cell. |
| **Fantastical** | Restrained micro-typography for dense info; text hierarchy (weight, size) carries scan-ability, not color. | Type-hierarchy-over-color-density: label + icon + weight per day; color reserved for the status chip, not the row. | Natural-language entry and multi-calendar switcher. |
| **Apple Calendar** | Today's date gets one unmistakable, consistent treatment used identically everywhere. | Today gets exactly one visual idiom, reused everywhere (week list, desktop grid, "Today" pill). | Multi-calendar color-coding — we have one plan, one accent. |

### Todo/checklist done-state references

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **Things 3** | A completed item gets a small, solid, **muted** check circle plus a fade — color does almost no work; icon shape and text-muting carry "done". Today's items sit **open** (hollow circle) until checked. | Icon + label do the primary work, color is supporting, never the only signal. **Fade-not-delete** for a Missed day: fully legible, just quieter than Achieved. The hollow circle as the "not yet, but still possible" state — the model for **Planned**. | Strikethrough on the title — the prescription is a historical record, not a to-do to cross out. Use muting/weight instead. |
| **Todoist** | Done tasks go grey + a light checkmark, not green — de-emphasis more than bright color. | The case for a muted, low-saturation Achieved green. | Priority-flag color dots (different semantic). |
| **Apple Reminders** | The unfilled-circle → filled-circle transition is the clearest part, more than the fill color. | Unfilled-outline → filled-shape as the *primary* signal, color secondary; matches TrainingPeaks' outline-to-fill. Planned = outline, Achieved = filled. | Smart-list chrome (Today/Scheduled/Flagged). |

### Direction (one paragraph)

The calendar **is** the home screen and opens on **this week**, never a month
grid — a marathon build is read week by week, with the long run as each
week's anchor. Borrowing TrainingPeaks' planned-outline → completed-fill
pairing and Strava's calm done/not-done contrast, each elapsed **or current**
day carries a small, **muted** status chip — icon + label + restrained color
(Things/Todoist's lesson) — while exactly one element per screen is visually
loud: **today**, using Notion Calendar's and Apple Calendar's single-idiom
"today" treatment. Today's chip reads **Planned** (a hollow, dashed-outline
chip — "still possible") until something is confirmed or the runner's local day
ends. Every day states its workout in the **template's own
words** (the template's verbatim `description`, e.g. `3–4x1K at 10K pace (8:10/mi)`)
and the day-detail sheet resolves each token against the runner's personal pace
reference (`Easy 10:30 /mi · MGP 9:09 /mi · 10K pace 8:10 /mi · 5K pace 7:55 /mi`) — the
plan's authoring vocabulary is the product, not jargon to hide. Numbers are the hero where genuinely compared — per-day
mileage, planned-vs-completed volume — set in tabular figures (Tempo's
Numeral role); the countdown is a standalone hero stat, so it is large
Figtree (Display role), **not** mono. Race week is a real week with seven
tappable days; race day is an additional pinned "finish line" block after it.
Getting into a day is one tap; a suggested Strava match is confirmed or
dismissed in one tap too.

### Principles

- **Calendar is the home screen. Open on this week.**
- One glance answers: today's session, this week's long run, weeks to go.
- The week is the unit; the long run is its anchor.
- Planned is quiet; an elapsed/current day's status is a small, muted
  icon+label+color chip, never a loud wash; **today is loud** — one thing
  pops per screen.
- **Status is never blank for an elapsed or current day (FR19).** Today reads
  **Planned** until a match is confirmed; an elapsed day reads **Missed** (or
  **Rest**) until one is. Confirm then recomputes. Only **future** days show no
  status. Never say "Missed" about a day that is still in progress.
- **A suggestion never changes status** (FR14/FR19) — pending or dismissed, on
  today or on a day from months ago. Only a confirmed activity does.
- **Any run counts.** On a running day, a confirmed run of any distance is
  Achieved. The Logged-vs-Planned comparison is information, not a grade.
- Numbers are the hero **only where they're a comparison column**; a
  standalone hero stat (the countdown) is large body type, not mono.
- Never rely on colour alone: status, today, rest, planned, swap, and long run
  each carry a text label (and, for status, a distinct icon shape).
- A suggested match is a **suggestion**, never silently applied (FR14), for
  **every** day type — confirm/dismiss must feel as fast as the old "mark
  complete" tap.
- Into a day's detail in one tap, back in one tap; confirming/dismissing is
  one tap from inside that sheet.
- **No coach jargon in v1 (no TSS/IF/CTL).** The template's `description`
  text **is** the workout text: show it verbatim (e.g.
  `3–4x1K at 10K pace (8:10 /mi)`) and render the pace reference strip beneath
  — never rewrite into conversational copy, never strip the pace tokens.

---

## 3. User flow

### Entry points

- App launch / root URL → **Training calendar**, rendering the runner's one
  active plan (FR24).
- Deep link to a specific week or day (e.g., a future notification) →
  calendar scrolled to that week, or the day sheet open.
- Returning from `strava-connect-settings.md` after connecting → calendar
  reflects the new connection state; a mid-cycle join or plan switch runs a
  bounded backfill (FR16/FR25) — see the backfill note.

### States and transitions

```
                         ┌─────────────────────────────┐
   app launch  ─────────▶│  A. Calendar                │
                         │     ├─ loading (skeleton)   │
                         │     ├─ empty / first-run    │
                         │     ├─ error                │
                         │     └─ populated (default)  │
                         └─────────────────────────────┘
                            │            │            │
       tap "Set up plan"    │            │ tap a day  │ scroll to end /
       (empty state)        │            │ (incl. race│ tap race block
                            │            │  week days)│
                            ▼            ▼            ▼
                 ┌──────────────┐  ┌──────────┐  ┌──────────────┐
                 │ Plan setup   │  │ B. Day   │  │ C. Race day  │
                 │ (OUT OF      │  │  detail  │  │  detail      │
                 │  SCOPE stub) │  │  sheet   │  │  sheet       │
                 └──────────────┘  └──────────┘  └──────────────┘
                        │             │   │            │
              on finish │  confirm/   │   │ prev/next  │ close
              returns   │  dismiss/   │   │ day        │
              to A      │  undo a     │   │ (in sheet) │
              populated │  match →    │   │            │
                        │  status     │   │            │
                        │  recomputes │   │            │
                        ▼    (A's day ▼   ▼            ▼
                     A (populated, row reflects it / returns to A)
```

### Status lifecycle (one running/strength day, FR14/FR19–FR21)

Rest days are always **Rest** (a bonus activity does not change that) and
future days have no status, so this lifecycle covers the day types that can
change. "Confirmed" always means the runner tapped Confirm (or Confirm
selection); a pending or dismissed suggestion never moves the day.

```
   (future: no status)
          │  the day arrives (runner's local midnight → today)
          ▼
   ┌────────────┐  Confirm a run (running day)          ┌────────────┐
   │  PLANNED   │──────────────────────────────────────▶│  ACHIEVED  │
   │ (today     │  Confirm any non-run (strength day)   └────────────┘
   │  only)     │──────────────────────────────────────▶ ACHIEVED
   │            │  Confirm a run on a strength day      ┌────────────┐
   │            │──────────────────────────────────────▶│  PARTIAL   │
   │            │                                        └────────────┘
   │            │  Confirm a non-run on a RUN day       ┌────────────┐
   │            │──────────────────────────────────────▶│  MISSED +  │
   └────────────┘                                        │ activity   │
          │  runner's local midnight,                    │ swap       │
          │  nothing confirmed                           └────────────┘
          ▼
   ┌────────────┐  Confirm (any time later, incl. late-synced suggestions,
   │  MISSED    │  no time limit) → ACHIEVED / PARTIAL / MISSED + swap,
   │ (elapsed)  │  by the same rules as above
   └────────────┘

   UNDO a confirmed match:  today → back to PLANNED · elapsed day → back to MISSED
   DISMISS / "None of these": status unchanged (PLANNED today, MISSED elapsed)
```

Note: a swap is drawn as "Missed + indicator", not as a sixth status —
FR19's stored enum is Planned / Achieved / Partial / Missed / Rest.

### Flow 1 — viewing a week

1. Screen opens on the current week (expanded); past weeks collapsed above,
   future weeks collapsed below.
2. Runner **scrolls** vertically. Trigger to see another week's detail:
   **tap its collapsed header** → expands (accordion, multiple can be open).
3. When the current week scrolls out of view, a **"Today" pill** in the top
   bar remains; tapping it scrolls back and ensures the current week is
   expanded.
4. Distant future weeks collapse into a `• • •` range control (§4.1) — see
   the race-week rule in Flow 3.
5. Exit: tap a day (→ Flow 2), tap the race block (→ Flow 3), or leave.

### Flow 2 — tapping a day, and everything that can be inside

1. Trigger: **tap a day row**. Every day is interactive, including Rest days
   (a Rest day can carry an unlinked bonus activity, FR17) and every day of
   race week.
2. **B. Day detail** opens — bottom sheet on mobile/tablet, right-hand side
   panel on desktop (calendar stays visible).
3. Contents, always: weekday + date and the day's **prescription**:
   - **Running day (`dayType: 'run'`, includes race day):** workout title, the
     template's **`description` verbatim** (with pace tokens resolved inline,
     e.g. `10–12 mile long run, last 4 miles at MGP (9:09 /mi)`), the `Planned`
     row (distance/duration), and — directly beneath — the **compact pace
     reference** strip (full token names + pace with `/mi` unit, e.g.
     `Easy 10:30 /mi · MGP 9:09 /mi · 10K pace 8:10 /mi · 5K pace 7:55 /mi`;
     `HMGP` only if the runner has a half-marathon goal pace set). The token-
     substitution helper and `formatPace` function that produce both the resolved
     description and the pace strip live in `packages/pace-zones/src/` (§5.3);
     they are **not** `apps/web/src/lib/pace-zone-display.ts`, which handles
     zone-table-row display formatting — a different concern. The full pace-zone
     table stays in plan setup.
   - **Strength / cross-training (`strength`, `cross_training`):**
     `description` verbatim, no distance/pace figure (FR11), **no pace
     strip** (nothing to resolve).
   - **Rest (`rest`):** "Rest".
   - For an **elapsed or current** day (FR19): the computed **status chip**
     (Planned [today only] / Achieved / Partial / Missed / Rest) — **always
     present**. Future days: no chip, no activity section.
4. Contents, conditionally, depending on what Strava has synced — **exactly
   one** of these renders in the activity section. The rule for all of them:
   **nothing is applied until Confirm (FR14)**, so before Confirm a
   running/strength day's status is **Planned** (today) or **Missed**
   (elapsed), and a Rest day's is **Rest**.
   - **a. No connection / nothing synced:** quiet note, no card. Status
     **Planned** (today) / **Missed** (elapsed) / **Rest**.
   - **b. One plausible match, unconfirmed (FR14):** an `ActivityMatchCard`
     (type, distance/duration, start time, **Confirm** and **Dismiss**) **on
     running and strength/cross-training days alike**. Status chip is
     unchanged while it is pending (**Planned** today, **Missed** elapsed).
     **Confirm** → the match applies and the status recomputes by day type:
     **running day → FR20** (any confirmed run type → **Achieved**, whatever
     the distance; a confirmed non-run → stays **Missed** with the **activity
     swap** indicator); **strength/cross-training → FR21** (any non-running
     activity → **Achieved**; a running-only activity → **Partial**); the card
     becomes state (c) with **Undo**. **Dismiss** → suggestion cleared, status
     unchanged; the activity is **not** deleted (see §8 on re-offering).
   - **c. Confirmed match:** logged activity's real detail against the
     Planned row (informational — see §4.2d-2), status chip shows the computed
     result, secondary **Undo** returns to (b) — status returns to **Planned**
     (today) or **Missed** (elapsed); nothing is un-synced or deleted (FR14).
   - **d. Multiple plausible matches (FR18):** single-select list plus
     **"None of these"** and **Confirm selection**. Chip unchanged until
     Confirm. Confirm behaves like (b)'s Confirm; "None of these" behaves
     like (b)'s Dismiss for all candidates.
   - **e. Late-synced suggestion on an elapsed day:** same as (b)/(d) — an
     activity that arrives days or months late creates a suggestion on its
     day (FR19: re-evaluated with no time limit) and still needs Confirm. See
     §4.2j and the row cue in §4.1.
5. **Unlinked/bonus entries (FR17)** render as read-only cards **below** the
   prescription/match section: an unscheduled activity on a Rest day, or an
   extra activity on an already-matched day. Type, distance/duration, start
   time, "Extra activity" outline chip. A Rest day with a bonus entry stays
   **Rest**; a bonus run entry counts toward the run-miles total; a bonus
   non-run entry does not (§5.7). Nothing to do with it in this pass.
6. In-sheet nav: **‹ / ›** step to the previous/next day; the calendar behind
   updates its scroll/expansion.
7. Every state change (confirm / dismiss / undo / pick) triggers a polite
   live-region announcement (§6) and updates the day row behind the sheet —
   no separate "save."
8. Exit: swipe down / tap scrim / Esc / close → back to A, focus on the
   originating day row.

### Flow 3 — race week and race day

1. **Race week is a real week block.** The final week (week 18 in the 18-week
   template) renders exactly like any other week: a header plus **7 day rows**
   (mobile) or a 7-column row (desktop), Mon–Sun, each a tap target opening
   Flow 2. Race day is the Sunday of that week (ADR 0005) and its row is
   tagged `Race day`.
2. **The `• • •` control may collapse only distant future weeks.** It must
   never contain: the current week, at least one adjacent week on each side
   that exists, or the race week. Race week's header is always visible (never
   inside the ellipsis), collapsed by default until it is within 2 weeks of
   today, and expandable to all 7 days at any time.
3. **The pinned race-day block is an additional scroll target after race
   week, not a substitute for it.** It shows **Race day**, the date,
   "Marathon · 26.2 mi", and **"N weeks to go"** (→ "Race week" → "Race day
   is today").
4. Trigger: **tap the race block, or the Sunday row of race week** → **C.
   Race day detail** — same sheet pattern as a running day. **Race day is a
   normal running day (FR20)**: on race day itself the chip reads **Planned**;
   it becomes **Achieved** when a confirmed run is applied (any distance) and
   **Missed** at the runner's local midnight if nothing is. The sheet shows
   the race (date, distance, countdown, a note that the week before is a
   taper), the same status chip, and the same `ActivityMatchCard` as any
   running day. What follows race day (recap, archive, next plan) is
   Backlog issue #56.

### Backfill note (FR16/FR25 — kept lightweight)

Joining a plan after its start date, or switching plans, triggers a bounded
backfill (≤5 min per NFR4). While it runs, affected days simply render per
state (a) — **Missed/Rest (Planned for today), as if nothing has synced** —
rather than a spinner per day; a single dismissible `Alert` at the top reads
**"Filling in your recent history — this can take a few minutes."** and
disappears when the job completes (poll vs. push is a swe/deploy-engineer
call). It sits in its own slot **below** any connection banner
(§4.1b/c). Backfilled activities arrive as **suggestions** that need Confirm
like any other (§4.2j) — they don't retroactively flip days to Achieved. Not a
full backfill-status spec; see §8.

---

## 4. Wireframes

ASCII only. All states drawn.

### 4.1 Calendar — populated, mid-plan, this-week emphasis (mobile)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │  top bar: menu · title · jump-to-today pill · settings
├─────────────────────────────────────┤
│  9 weeks to race day                │  countdown — Display role (Figtree, NOT mono)
│  Week 9 of 18 · build               │  sub: position + template `phase` (ADR 0005)
│  ▓▓▓▓▓▓▓▓░░░░░░░░                    │  plan progress bar (role=progressbar)
├─────────────────────────────────────┤
│ ▸  Week 8   Mar 2–Mar 8    28/28mi ✓│  COLLAPSED past week (all Achieved). tap header = expand
├─────────────────────────────────────┤
│ ▾  Week 9   Mar 9–Mar 15  18/32 mi │  EXPANDED current week. header is a button (aria-expanded).
│  ┌───────────────────────────────┐  │  Completed total = confirmed run miles only (§5.7)
│  │ Mon  9 Easy run    5 mi ●Achvd│  │  Achieved — green chip, check-circle-2 icon (any confirmed run)
│  │ Tue 10 Intervals    6 mi ✕Msd │  │  Missed + ACTIVITY SWAP: red x-circle chip, plus a second
│  │        ⇄ Swap · Walk 2.1 mi  ›│  │  line tag with arrow-left-right icon + text (§4.2d-3)
│  │ Wed 11 Rest             ☾Rest │  │  Rest — grey chip, moon icon, STILL a tap target (FR17)
│  │ Thu 12 Tempo        7 mi ✕Msd │  │  Missed (elapsed) with a pending/late suggestion:
│  │        ◇ Suggestion          ›│  │  quiet outline "Suggestion" tag — status unchanged (§4.2j)
│  │▎Fri 13 Easy · Today  4 mi ○Plan›│  │  TODAY — accent left border + "Today" label; chip = Planned
│  │                               │  │  (dashed-outline circle, NOT red, NOT filled grey)
│  │ Sat 14 Rest                   │  │  future Rest day: no chip (future)
│  │ Sun 15 Long run [LONG] 14 mi ›│  │  UPCOMING long run — "Long" tag, no status (future)
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ ▸  Week 10  Mar 16–Mar 22  34 mi    │  COLLAPSED future week (adjacent, always shown)
├─────────────────────────────────────┤
│        • • •  Show weeks 11–16      │  ellipsis: ONLY distant future weeks (never race week)
├─────────────────────────────────────┤
│ ▸  Week 17  May 4–May 10   30 mi    │  adjacent-to-race-week, always shown
│ ▸  Week 18  May 11–May 17 · Race week│  RACE WEEK — real week block, header always visible.
│                            22 mi    │  Expands to 7 day rows (see 4.1d)
├─────────────────────────────────────┤
│ ╔═════════════════════════════════╗ │
│ ║ [⚑]  RACE DAY                   ║ │  pinned finish-line block: ADDITIONAL scroll target,
│ ║      Sun, May 17 · Marathon 26.2║ │  after race week — not a replacement for it
│ ║      9 weeks to go            › ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

(Week 9's figures are illustrative; the point is which chip/tag each
situation gets.)

Each running-day row shows the template's workout name (from `description`'s
leading label / `workoutTag`) — the full `description` text appears in the
day-detail sheet, not in the row (row stays one line, plus at most one
secondary tag line for **Swap** or **Suggestion**).

**Row cues — decisions:**

- **"Suggestion" cue on elapsed Missed days: yes.** A late-synced activity
  (FR19: no time limit) would otherwise be invisible on an old, collapsed-past
  day that still says Missed — the runner would never learn a match is
  waiting. The cue is a quiet **outline text tag `Suggestion`** with the
  neutral `link-2` glyph (wireframes draw it as ◇) — no fill, no status color, so it
  can never be mistaken for a status. It appears on any day (today or elapsed)
  with at least one pending suggestion, and disappears on Confirm or Dismiss.
  It never changes the chip. Cost: one extra tag line on affected rows only.
- **Not on the collapsed week header in v1.** A per-week "N suggestions"
  count would need the summary payload (§5.6) to carry it; cheap to add later
  if runners miss late suggestions (§9).
- **"Swap" tag** (text `Swap`, `arrow-left-right` icon) sits beside the
  Missed chip on any day whose confirmed activity is a non-run on a run day.

Interactive: menu, Today pill, settings, each week header, **every** day row
including Rest and every race-week day, the `• • •` control, the race block.
Only the progress bar is non-interactive.

### 4.1b "Not connected" banner (above the countdown block when Strava isn't connected)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ ⓘ Connect Strava to see your  │   │  Alert, info variant, dismissible
│ │   completed workouts here      │   │  "Connect" → strava-connect-settings.md
│ │   automatically.  [ Connect ]  │   │  (Connect pre-focused there)
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│  9 weeks to race day                │
│  …                                   │
```

Without a connection, every elapsed/current day still computes a status —
**Missed** (elapsed running/strength days), **Planned** (today), or **Rest**
— correct per FR19–22 (nothing can sync). Not an error state; the banner
nudges without blocking.

**Confirmed statuses persist after disconnect.** Disconnecting Strava does
not blank or reset any day's status. If a day was Achieved before disconnect,
it stays Achieved; the calendar shows confirmed statuses as they were. Only
*new* activities stop arriving after the disconnect.

**Post-purge "Logged" row (NFR3).** Raw Strava activity data is purged within
24 hours of disconnect. After purge, the day-detail sheet's `Logged` row shows
only what the match record retains: activity type + distance (e.g.
`Run · 6.2 mi`). Fields sourced from the raw payload — average heart rate,
Strava activity link, split data — are unavailable and are not shown.
Confirmed status (Achieved/Partial/Rest) and the match record (type +
distance) survive the purge.

### 4.1c "Reconnect needed" banner (Strava auth expired) — new, drawn here

Same slot as 4.1b, **replaces** it (never both at once). This is the
calendar-side surface for `strava-connect-settings.md`'s auth-expired state
(FR12).

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ ⚠ Your Strava connection needs │   │  Alert, warning (amber) variant, dismissible
│ │   to be renewed to keep syncing│   │  alert-triangle icon + text; role="status" (not alert:
│ │   activities.   [ Reconnect ]  │   │  not an emergency)
│ └───────────────────────────────┘   │  "Reconnect" → strava-connect-settings.md, its
├─────────────────────────────────────┤  "Reconnect Strava" button pre-focused
│  9 weeks to race day                │
```

Behavior: shown whenever the connection is in the auth-expired state;
dismissal is session-local (reappears next visit while still expired, same
rule as 4.1b). Already-synced activities and confirmed matches stay as they
are; only *new* activities stop arriving, so a day whose activity never
synced reads **Missed** (or **Planned** today) — the banner is the
explanation. Precedence when several banners apply: connection banner (4.1b
**or** 4.1c) first, backfill banner (§3) below it.

### 4.1d Race week expanded (mobile) — a full 7-day block

```
│ ▾  Week 18  May 11–May 17 · Race week│
│  ┌───────────────────────────────┐  │
│  │ Mon 11 Easy run      4 mi     ›│  │  future days: no chip
│  │ Tue 12 Easy run      3 mi     ›│  │
│  │ Wed 13 Rest                   ›│  │
│  │ Thu 14 Shakeout      2 mi     ›│  │
│  │ Fri 15 Rest                   ›│  │
│  │ Sat 16 Easy run      2 mi     ›│  │
│  │ Sun 17 [⚑] Race day  26.2 mi  ›│  │  race-day row → opens C. Race day detail. A normal running
│  └───────────────────────────────┘  │  day: chip = Planned on the day, then Achieved / Missed
```

(Day names/distances illustrative; the real rows come from the template.)

### 4.2 Day detail sheet

**4.2a — Running day, FUTURE (no status, no activity section)**

```
┌─────────────────────────────────────┐
│               ────                   │  drag handle (mobile). [✕] close (44px) also present
│ ‹ Prev     Sun, Mar 15     Next ›    │  in-sheet day stepper. center = focus target on open
├─────────────────────────────────────┤
│  Long run                            │  h2 — sheet's accessible name
│  Week 9 · build                      │
│                                      │
│  10-12 mile long run, last 4 miles   │  template `description`, verbatim with pace tokens resolved
│  at marathon goal pace (MGP)         │  inline by the token-substitution helper (§5.3);
│  (9:09 /mi)                          │  MGP token resolved to its computed pace
│  Planned      14 mi · long run       │
│  Easy 10:30 /mi · MGP 9:09 /mi       │  compact pace reference strip: full token name + pace /mi.
│                                      │  HMGP omitted (runner has no half-marathon goal set here)
│  ── future day: nothing below here — no status chip, no activity section ──
```

**4.2b — Running day, ELAPSED, Strava connected, nothing synced**

```
│  Threshold intervals                 │
│  3–4x1K at threshold pace (7:05 /mi) │  description verbatim with pace tokens resolved inline
│  with 400m jog recoveries            │
│  Planned      6 mi · threshold       │
│  Threshold 7:05 /mi                  │  compact pace reference strip
│                                      │
│  Missed  ✕                           │  status chip (red, x-circle) — FR20: nothing confirmed
│  No activity logged for this day.    │  once the local day ended; plain note, no card
```

**4.2b-2 — Running day, TODAY, nothing confirmed yet — status is Planned**

```
│  Easy run                            │
│  4 miles easy (10:30 /mi)            │  description verbatim with pace token resolved inline
│  Planned      4 mi · easy            │  the prescription row keeps its label "Planned" (it is the
│  Easy 10:30 /mi                      │  plan); the status chip below is a separate element
│                                      │
│  ○ Planned  (dashed outline)         │  status chip: dashed-outline circle icon (circle-dashed) +
│  No activity logged yet today.       │  label. Not red, not filled — see §5.7 for the identity rules
```

Planned is the only status that can still move to Achieved/Partial "for
free" by the day ending well; it becomes **Missed** at the runner's local
midnight (FR19). Because the prescription row is also labeled `Planned`, the
status chip carries a leading icon and sits on its own line below the pace
strip, and the prescription label is set in `text/secondary` while the chip
is the status element (accessible names disambiguate, §6).

**4.2c — One plausible match, unconfirmed (FR14) — status does not change**

Elapsed day shown (chip Missed). On **today** the same card sits under a
**Planned** chip.

```
│  4 miles easy (10:30 /mi)            │  template `description`, verbatim with pace token resolved
│  Planned      4 mi · easy            │
│  Easy 10:30 /mi                      │  compact pace reference strip
│                                      │
│  Missed  ✕                           │  nothing is applied until Confirm (FR14); on today this
│  ┌───────────────────────────────┐   │  chip reads "○ Planned"; recomputes on Confirm
│  │ Is this it?                   │   │  ActivityMatchCard
│  │ Run · 4.1 mi · 34:12           │   │
│  │ Fri, Mar 13 · 6:42 AM          │   │
│  │  ┌───────────┐ ┌─────────────┐ │   │
│  │  │  Confirm  │ │   Dismiss   │ │   │  primary / secondary buttons, ≥44px
│  │  └───────────┘ └─────────────┘ │   │
│  └───────────────────────────────┘   │
```

**4.2d — Confirmed run, Achieved (FR20: any confirmed run type)**

```
│  4 miles easy (10:30 /mi)            │  template `description`, verbatim with pace token resolved
│  Planned      4 mi · easy            │
│  Easy 10:30 /mi                      │  compact pace reference strip
│  Logged       4.1 mi · 34:12 · Run   │
│                                      │
│  Achieved  ✓                         │  status chip (green, check-circle-2)
│  ┌───────────────────────────────┐   │
│  │           Undo                │   │  returns to 4.2c (status back to Planned if today,
│  └───────────────────────────────┘   │  Missed if elapsed)
```

**4.2d-2 — Confirmed run, any distance — still Achieved (logged vs. planned is informational)**

```
│  3–4x1K at threshold pace (7:05 /mi) │  template `description`, verbatim with pace token resolved
│  with 400m jog recoveries            │
│  Planned      6 mi · threshold       │
│  Threshold 7:05 /mi                  │  compact pace reference strip
│  Logged       3.2 mi · 27:40 · Trail run │  Strava sport type TrailRun (any run variant counts)
│                                      │
│  Achieved  ✓                         │  same chip as 4.2d — FR20 has no distance/duration threshold
│  ┌───────────────────────────────┐   │
│  │           Undo                │   │
│  └───────────────────────────────┘   │
```

The `Planned` and `Logged` rows sit side by side purely so the runner can see
what they did against what was prescribed. **No "short of it" wording, no
"Ran 3.2 of 6 mi." line, no progress bar, no threshold, no muted or warning
treatment on the Logged row.** The earlier "Partial short run" state
(pass 1's 4.2d-2) is **removed**: FR20 in v1 never computes Partial on a
running day. **Reserved for later:** `Partial` stays in the enum and in the
`StatusBadge` module (its amber styling is unchanged and is still used on
strength days, 4.2h). If a future FR adds a short-of-prescription rule for run
days, a Partial-run wireframe would be redrawn then, with a one-line plain
reason under the chip; not built now.

**4.2d-3 — Confirmed NON-run on a run day: Missed + activity swap (FR20)**

```
│  5 miles easy (10:30 /mi)            │  template `description`, verbatim with pace token resolved
│  Planned      5 mi · easy            │
│  Easy 10:30 /mi                      │  compact pace reference strip
│  Logged       2.1 mi · 41:00 · Walk  │  the activity is shown on the day
│                                      │
│  Missed  ✕   ⇄ Activity swap         │  chip stays Missed (red, x-circle); indicator is a separate
│  You did a walk instead of the       │  outline tag: arrow-left-right icon + "Activity swap"
│  planned run.                        │  plain, neutral line. No blame, no "only".
│  ┌───────────────────────────────┐   │  Walk miles do NOT count toward the run-miles fraction
│  │           Undo                │   │  returns to 4.2c (Planned today / Missed elapsed)
│  └───────────────────────────────┘   │
```

The status does **not** change to Achieved or Partial; the swap indicator
exists so the runner sees their effort was recorded and counted (FR20), not
that the day was empty. Applies to any confirmed non-run sport type on a run
day (Walk, Hike, Ride, Swim, Yoga…), per §5.7's classification. The
"Activity swap" tag is never shown without the Missed chip, and never on rest,
strength or cross-training days.

**4.2e — Multiple plausible matches (FR18) — status does not change until Confirm**

```
│  4 miles easy (10:30 /mi)            │  template `description`, verbatim with pace token resolved
│  Planned      4 mi · easy            │
│  Easy 10:30 /mi                      │  compact pace reference strip
│                                      │
│  Missed  ✕                           │  unchanged until a choice is confirmed (today: ○ Planned)
│  Which one is this?                  │  h3, group legend
│  ○ Run · 4.0 mi · 33:50 · 6:41 AM    │  RadioGroupItem
│  ○ Run · 4.3 mi · 36:02 · 7:15 AM    │  RadioGroupItem
│  ○ None of these                     │  RadioGroupItem — always present, FR18
│  ┌───────────────────────────────┐   │
│  │      Confirm selection        │   │  disabled until one option is chosen
│  └───────────────────────────────┘   │
```

A run + Confirm selection behaves like 4.2c's Confirm; "None of these" +
Confirm selection behaves like Dismiss (status unchanged; not re-offered
automatically, §8).

**4.2f — Rest day, no bonus activity**

```
│  Rest                                │  h2
│  Week 9                              │
│  Rest  ☾                             │  status chip (grey, moon) — always Rest
│  Nothing scheduled today.            │
```

(A **future** Rest day shows no chip, like any future day. A Rest day that is
**today** shows **Rest**, never Planned — there is nothing to plan.)

**4.2g — Rest day WITH an unlinked bonus activity (FR17)**

```
│  Rest                                │
│  Rest  ☾                             │  still Rest — no penalty, no credit (FR17)
│  Nothing scheduled today.            │
│  ┌───────────────────────────────┐   │
│  │ ＋ Extra activity              │   │  outline chip, no fill — the "bonus entry"
│  │ Run · 3.2 mi · 28:40           │   │  read-only — nothing to confirm/dismiss
│  │ Wed, Mar 11 · 5:30 PM          │   │  a Rest-day bonus RUN counts toward run-miles total (§5.7);
│  └───────────────────────────────┘   │  a non-run bonus does not count toward the run fraction
```

**4.2h — Strength / cross-training day (FR11, FR14, FR21) — goes through `ActivityMatchCard` like every other day**

Elapsed, activity suggested, **not yet confirmed** — status is Missed (on
today it would read **○ Planned**):

```
│  Strength                            │  h2
│  Week 9 · lower body                 │
│  30–40 min. Focus on hips and        │  `description` verbatim; no distance/pace figure (FR11);
│  glutes.                             │  no pace strip
│                                      │
│  Missed  ✕                           │  nothing applied yet (FR14)
│  ┌───────────────────────────────┐   │
│  │ Is this it?                   │   │  the SAME ActivityMatchCard as 4.2c
│  │ Weight training · 38 min       │   │
│  │ Thu, Mar 12 · 6:10 PM          │   │
│  │  [ Confirm ]   [ Dismiss ]     │   │
│  └───────────────────────────────┘   │
```

After **Confirm**, FR21 scores it:

- non-running activity (weight training, ride, yoga, walk, hike…) →
  **Achieved ✓** + `Logged` row + `Undo`;
- a confirmed **running** activity on a strength day → **Partial ◐** + `Logged`
  row + `Undo`, with a one-line reason: "Logged a run, not a strength
  session." **This is the only path to Partial in v1.** Styling is the
  original Partial chip (amber, `circle-dot`).
- If nothing synced (or Dismissed) → **Planned** on today, **Missed**
  once elapsed, same copy as 4.2b/4.2b-2.

FR21 is a *scoring* rule that applies after Confirm; a synced activity never
sets Achieved/Partial by itself. Multi-match (FR18) and undo behave exactly
as on running days. There is **no swap indicator** on strength days (a
non-run there is the expected outcome).

**4.2i — Freeform-described day (FR22) — mapping and explicit deferral**

Mapping from ADR 0005's `dayType` to the scoring rule the UI renders:

| Template `dayType` | Has numeric target? | Rule | Possible confirmed results |
|---|---|---|---|
| `run` (includes race day) | Yes — `distanceMiles` is **required** on run days (ADR 0005 rule 1) | FR20 | Achieved (any confirmed run) / Missed, with the **activity swap** indicator if a non-run was confirmed. Never Partial in v1. |
| `strength`, `cross_training` | No | FR21 | Achieved / Partial (run only) / Missed |
| `rest` | — | FR19 | Rest (bonus entries don't change it) |
| *(freeform, description-only, no numeric target, not one of the above)* | No | FR22 (**deferred**) | Achieved / Missed (**no Partial**); Planned today |

**Deferral, stated explicitly:** PR #58 marks FR22 *deferred — no v1 template
has a description-only day; not built until one does.* Under ADR 0005 every v1
template day is one of the four `dayType`s, so there is **no FR22 wireframe
and nothing to build** for it in this pass. (The old FR21/FR22 overlap
question is resolved — strength/cross-training is FR21, FR22 is reserved for
a future day kind.) If a future template adds a description-only day kind, it
renders as **4.2h with the Partial outcome suppressed** (running-only match →
treated as a normal confirmed activity → Achieved; nothing confirmed →
Planned today / Missed elapsed). swe: switch on `dayType`, not on "is there a
numeric target"; do not infer FR22 from a missing `distanceMiles`.

**4.2j — Late-synced suggestion on an old elapsed day (FR19, no time limit)**

Scenario: it is a month later; a Strava activity for Mar 6 arrives (a delayed
sync, or a backfill). The day was already Missed.

```
Row (in the week list, once its week is expanded):
│ Fri, Mar 6  Easy run  4 mi   ✕Missed │
│             ◇ Suggestion            ›│  quiet outline tag; chip unchanged

Sheet:
│  4 miles easy (10:30 /mi)            │  template `description`, verbatim with pace token resolved
│  Planned      4 mi · easy            │
│  Easy 10:30 /mi                      │  compact pace reference strip
│                                      │
│  Missed  ✕                           │  unchanged — a suggestion never changes status
│  ┌───────────────────────────────┐   │
│  │ Is this it?                   │   │  the same ActivityMatchCard
│  │ Run · 4.1 mi · 34:12           │   │
│  │ Fri, Mar 6 · 6:42 AM           │   │
│  │ Synced later — confirming will │   │  one neutral line, shown only for a suggestion whose
│  │ update this day.               │   │  activity synced after its day ended
│  │  [ Confirm ]   [ Dismiss ]     │   │
│  └───────────────────────────────┘   │
```

- **Confirm** → status recomputes by the ordinary rules (here → Achieved);
  the row, the week's completed total, and the collapsed week header all
  update; the "Suggestion" tag goes away. No time limit applies.
- **Dismiss** → tag goes away, status stays Missed; activity not deleted.
- **Undo** after Confirm → back to Missed (elapsed day).
- The calendar does **not** interrupt the runner about it (no toast, no
  banner); the row tag is the only discovery surface in v1. A dismiss-review
  surface is not designed (§8).

### 4.3 Empty / first-run

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan            [⚙]   │
├─────────────────────────────────────┤
│            ┌─────────┐               │  simple line illustration (unDraw), decorative
│            │ calendar│               │
│            └─────────┘               │
│           No plan yet                │  h2
│    Add your race date and we'll     │  body — one sentence
│    lay out the training weeks       │
│    leading up to it.                │
│  ┌───────────────────────────────┐  │
│  │        Set up plan            │  │  single primary CTA → setup (OUT OF SCOPE stub)
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 4.4 Loading

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan            [⚙]   │
├─────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓                        │  skeleton of the countdown block
│  ▓▓▓▓▓▓                              │
│  ░░░░░░░░░░░░░░░░                    │
├─────────────────────────────────────┤
│ ▾ ▓▓▓▓▓▓▓▓▓▓▓                        │  skeleton week header + rows
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
└─────────────────────────────────────┘
```
No spinner. Skeleton mirrors the real layout. SR: `aria-busy="true"` on
`<main>`, polite "Loading your plan".

### 4.5 Error

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan            [⚙]   │
├─────────────────────────────────────┤
│               (!)                    │
│      Couldn't load your plan         │  h2
│   Check your connection and try     │  body
│   again.                            │
│  ┌───────────────────────────────┐  │
│  │         Try again            │  │  retry button
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 4.6 Calendar — desktop (≥1024px): week as a 7-column row, status chips in each cell

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Marathon plan          9 weeks to race day · Week 9 of 18              [⚙]   │  slim top bar
├──────────────────────────────────────────────────────────────────────────────┤
│  Week 8 · Mar 2–Mar 8                                         28 / 28 mi  ✓   │  week sub-header (sticky), Numeral role
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 2  │Tue 3  │Wed 4  │Thu 5  │Fri 6    │Sat 7  │Sun 8  [LONG]│  wk 8   │  │
│  │Easy   │Hills  │Rest   │Tempo  │Easy     │Rest   │Long run     │  28 mi  │  │  ← weekly-summary rail
│  │5mi●Ach│6mi●Ach│ ☾Rest │6mi●Ach│4mi●Ach  │ ☾Rest │12mi●Achieved│ all Ach │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 9 · Mar 9–Mar 15                                       18 / 32 mi      │
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 9  │Tue 10 │Wed 11 │Thu 12 │▏Fri 13  │Sat 14 │Sun 15 [LONG]│  wk 9   │  │
│  │Easy   │Interv │Rest   │Tempo  │▏Today   │Rest   │Long run     │  32 mi  │  │
│  │5mi●Ach│6mi✕Msd│ ☾Rest │7mi✕Msd│▏4mi○Plan│       │14 mi        │ 18 done │  │  today: Planned (dashed), never Missed
│  │       │⇄Swap  │       │◇Sugg. │▏        │       │             │         │  │  swap tag / suggestion tag on their own line
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 10 · Mar 16–Mar 22                                      34 mi planned   │
│  ...                                                                          │
│                     • • •  Show weeks 11–16                                   │  distant weeks only
│  Week 17 · May 4–May 10                                       30 mi planned   │
│  Week 18 · May 11–May 17 · Race week                           22 mi planned   │  RACE WEEK = full 7-column row
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 11 │Tue 12 │Wed 13 │Thu 14 │Fri 15   │Sat 16 │Sun 17 [⚑]   │  wk 18  │  │
│  │Easy   │Easy   │Rest   │Shake  │Rest     │Easy   │Race day     │  22 mi  │  │
│  │4 mi   │3 mi   │       │2 mi   │         │2 mi   │26.2 mi      │         │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  ╔════════════════════════════════════════════════════════════════════════╗   │
│  ║ [⚑]  RACE DAY       Sun, May 17 · Marathon 26.2 mi · 9 weeks to go      ║   │  additional target after race week
│  ╚════════════════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────────────────┘
     Day detail opens as a right-hand SIDE PANEL — calendar stays visible.
```

Per-day mileage and the weekly `28 / 28 mi` fraction use the Numeral role
(tabular IBM Plex Mono). Status abbreviations (`●Ach`/`◐Prt`/`✕Msd`/`☾Rest`/
`○Plan`) are compact renderings of the same status chip — same icon, color
and label semantics, abbreviated for width, never color-only. The `⇄Swap` and
`◇Sugg.` tags are the same tags as on mobile, abbreviated; their full text is
the accessible name and appears in the side panel.

---

## 5. Interface detail

### 5.1 Layout & spacing intent

- **Vertical rhythm.** Week blocks separated by a hairline rule
  (`border/subtle`, Tempo). Day rows separated by lighter hairlines. Row
  height ~52–56px on mobile; a row with a Swap/Suggestion tag line grows to
  ~72px.
- **Number alignment.** Only genuine comparison columns use the Numeral role,
  right-aligned. The countdown is Display-role Figtree, not mono.
- **Hierarchy.** Countdown largest (Display). Week numbers/volumes next
  (H2/Numeral). Workout names Body. Dates, "Rest", metadata Body-sm/
  `text/secondary`, never below 4.5:1 (§6).
- **Day-detail vertical order (running day):** title → `description`
  (verbatim, Body) → `Planned` row → compact pace strip (Body-sm, Numeral
  role for the times) → `Logged` row (when confirmed) → status chip (+ swap
  tag) → activity section → extra-activity cards.
- **Status chip.** Small, muted, icon + label + color — never a row wash.
- **One accent, spent on today.** `accent/solid` only on the **today**
  indicator; status colors are their own palette. Planned uses the neutral
  palette (not the accent) so it never competes with the today marker.
- **Race block.** 2px border, slightly inset, reads as a destination. Race
  week's day rows are ordinary rows; the Sunday row just carries the `Race
  day` tag and flag icon.

### 5.2 Component mapping

Stack is decided (ADR 0002: React + Vite, Tailwind, shadcn/ui, Lucide).

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Top bar | plain markup | Custom, trivial. |
| "Today" pill / buttons | `Button` | Standard. |
| Settings / menu icon buttons | `Button` icon variant | 44px target. |
| Not-connected banner (4.1b) | `Alert` (info) + `Button` | Dismissal session-local. |
| Reconnect-needed banner (4.1c) | `Alert` (warning/amber variant) + `Button` | If `ui-toolkit.md` (#53) has no amber `Alert` variant, add one (§10). `role="status"`. |
| Backfill-in-progress banner | `Alert` (info) | See §3 backfill note. |
| Plan progress bar | `Progress` | `role=progressbar`, plus visible "Week 9 of 18". |
| Week block (collapsible) | `Accordion`, `type="multiple"` | Container is library; the day-row/grid layout is custom. |
| Day row / day cell | **custom** | Core object; `<button>` per day. |
| `StatusBadge` (Planned/Achieved/Partial/Missed/Rest) | `Badge` (custom color/icon) | Shared module used by day row, desktop cell (compact), and day-detail sheet. Definition lands with #53 (four values); **Planned** is added by this spec (§5.7); toolkit row in §10. |
| Activity-swap tag / "Suggestion" tag | `Badge` (outline variant) + Lucide icon | Neutral outline, never a status color. Same primitive as the "Extra activity" chip. |
| Compact pace reference strip | plain markup over the token-substitution helper in `packages/pace-zones/src/` (§5.3) | Token substitution and `formatPace` (emits `/mi` unit) live in `packages/`, not `apps/web/src/lib/pace-zone-display.ts`. |
| "Long" tag, "Today" label, "Race day" tag | **custom** (span) | Text badges; never colour-only. |
| Day detail — mobile sheet | `Drawer` (Vaul) or `Dialog` styled as sheet | Focus trap, Esc, focus return. |
| Day detail — desktop side panel | `Dialog` with side styling, or aside in layout | Non-modal acceptable; don't trap focus, do move focus in. |
| In-sheet prev/next day | `Button` icon | "Previous day" / "Next day". |
| `ActivityMatchCard` | `Card` + `Button` × 2 | **New, custom.** Used on **all** non-rest day types. |
| Multi-match single-select (FR18) | `RadioGroup` + `RadioGroupItem` | "None of these" is a normal item. |
| Confirmed-match "Undo" | `Button` (outline) | Plain button, not a toggle. |
| Unlinked/bonus-activity card | `Card` (outline) + outline `Badge` | **New, custom**, read-only. |
| `• • •` distant-weeks control | `Button` (ghost) | "Show weeks 11–16". |
| Status-change announcement | inline `aria-live="polite"` region (no toast) | House convention. |
| Race-day block / race detail | **custom** block, reuse the sheet pattern | No library primitive for a milestone. |
| Empty-state illustration | `<img>` from unDraw | Decorative, `alt=""`. |
| Skeleton | `Skeleton` | Mirrors layout. |
| Icons | **Lucide** | Glyph set in §10. |

### 5.3 Copy

| Context | Text |
|---|---|
| Screen title | `Marathon plan` |
| Countdown, normal | `9 weeks to race day` |
| Countdown, < 2 weeks | `6 days to race day` |
| Countdown, final week | `Race week` |
| Countdown, race day | `Race day is today` |
| Plan position sub-line | `Week 9 of 18 · build` (phase = template `phase`, ADR 0005) |
| Jump-to-today control | `Today` |
| Week header | `Week 9` · `Mar 9 – Mar 15`; race week: `Week 18` · `May 11 – May 17 · Race week` |
| Weekly volume, before activity | `32 mi planned` |
| Weekly volume, in progress | `18 / 32 mi` |
| Weekly volume, week complete | `28 / 28 mi` + check |
| Not-connected banner | `Connect Strava to see your completed workouts here automatically.` + button `Connect` |
| Reconnect-needed banner | `Your Strava connection needs to be renewed to keep syncing activities.` + button `Reconnect` |
| Backfill banner | `Filling in your recent history — this can take a few minutes.` |
| Rest day | `Rest` |
| Long-run tag | `Long` |
| Today label (on the row) | `Today` |
| Race-day row tag | `Race day` |
| Status chip labels | `Planned` · `Achieved` · `Partial` · `Missed` · `Rest` (verbatim) |
| Planned-today note (no activity) | `No activity logged yet today.` |
| Activity-swap tag | `Activity swap` (sheet) · `Swap` (mobile row, desktop cell) |
| Activity-swap explanation | `You did a {walk\|hike\|ride…} instead of the planned run.` (activity type from Strava sport type, lower-cased; non-run miles do not count toward the run-miles total per §5.7) |
| Partial reason, run on strength day | `Logged a run, not a strength session.` |
| Unlinked/bonus chip | `Extra activity` |
| Suggestion row tag | `Suggestion` (mobile row) · `Sugg.` (desktop cell, accessible name always `Suggestion waiting`) |
| Late-synced suggestion line | `Synced later — confirming will update this day.` |
| Distant-weeks control | `• • •` (tap: `Show weeks 11–16`) |
| Race block title | `Race day` |
| Race block detail line | `Sun, May 17 · Marathon 26.2 mi` |
| Race block countdown | `9 weeks to go` → `Race week` → `Race day is today` |
| Day detail — workout text | template `description`, verbatim |
| Day detail — planned row | `Planned` → e.g. `4 mi · easy` |
| Day detail — pace reference | `Easy 10:30 /mi · MGP 9:09 /mi · 10K pace 8:10 /mi · 5K pace 7:55 /mi` (full token names + pace with `/mi` unit; `HMGP` entry only appears if the runner has a half-marathon goal pace set; `Estimated` badge on any pace with `source: "goalTime"` — see §5.3; formatting from the token-substitution helper in `packages/pace-zones/src/`) |
| Day detail — logged row | `Logged` → e.g. `4.1 mi · 34:12 · Run` |
| Day detail — no activity (elapsed) | `No activity logged for this day.` |
| Suggested-match card heading | `Is this it?` |
| Suggested-match Confirm | `Confirm` |
| Suggested-match Dismiss | `Dismiss` |
| Confirmed-match Undo | `Undo` |
| Multi-match heading | `Which one is this?` |
| Multi-match "none" option | `None of these` |
| Multi-match confirm button | `Confirm selection` |
| Live-region: match confirmed | `Friday's easy run matched to a 4.1 mile run. Marked {Achieved\|Partial}.` (status word = the computed result) |
| Live-region: swap confirmed | `Friday's easy run matched to a 2.1 mile walk. Marked Missed, activity swap.` |
| Live-region: match dismissed | `Match dismissed. Friday stays {Planned\|Missed}.` (Planned if the day is today) |
| Live-region: match undone | `Match undone. Friday is {Planned\|Missed}.` (Planned if the day is today) |
| Empty title | `No plan yet` |
| Empty body | `Add your race date and we'll lay out the training weeks leading up to it.` |
| Empty CTA | `Set up plan` |
| Error title | `Couldn't load your plan` |
| Error body | `Check your connection and try again.` |
| Error retry | `Try again` |
| Loading (SR only) | `Loading your plan` |

Tone: plain, second person, no exclamation marks, no blame ("only a walk" is
banned; the swap line states the fact neutrally). **Coach jargon**
(TSS/IF/CTL) is out; the template's own `description` text is the workout
text and is shown as written (with pace tokens resolved inline). The old
"Nice. Long run Sunday." nudge is dropped — a confirmed match is a
matter-of-fact event, so live-region copy states the fact plainly.

**Pace token display (swe — how the description and pace strip are produced).**
The day-detail sheet uses a **token-substitution helper** to add to
`packages/pace-zones/src/` (name TBD with tech-lead). It receives the
template's `description` string and the runner's computed `ZoneId` paces, and
returns the description with each recognized token followed by its computed
pace in parentheses (e.g. `at MGP (9:09 /mi)`). The pace reference strip is
built from the same mapping — full token name + pace (with `/mi` unit,
e.g. `Easy 10:30 /mi`), one entry per token that appears in the description,
`HMGP` only if the runner has a half-marathon goal pace set.

**`formatPace` unit.** The helper's `formatPace` function always appends
` /mi` (with a space before the slash), so pace values render as `10:30 /mi`,
`9:09 /mi`, etc. — both inline in the resolved description and in the pace
reference strip.

**`source: "goalTime"` / Estimated badge.** When a zone's pace is derived
from the runner's goal time only (no recent race result), the zone carries
`source: "goalTime"` in the computed pace data (as defined by PR #53 and
`plan-setup-flow.md` §7.4). The inline substitution and the pace reference
strip must show an **Estimated** badge on any pace whose zone has
`source: "goalTime"`, matching the treatment in `PaceZoneTable` from PR #53.
Display: small muted badge with label `Estimated` immediately after the pace
value (e.g. `Easy 10:30 /mi Estimated`). swe: read `source` from each
resolved zone; no `source` field or `source: "recentResult"` → no badge.

Token → ZoneId mapping:

| Template token | ZoneId | Notes |
|---|---|---|
| `easy` / `E` | `easy` | |
| `MGP` / `M` | `goal` | marathon goal pace; `goalZoneLabel()` returns `Goal — Marathon` on a marathon plan |
| `HMGP` | *(not a ZoneId)* | Half-marathon goal pace. Resolves to the runner's half-marathon goal zone pace when set; shown as `HMGP (not set)` when not set. **Not** the same as `MGP` / the `goal` zone. Only appears in half-marathon plan descriptions and in cross-plan tempo descriptions. |
| `10K pace` | `tenK` | |
| `5K pace` | `fiveK` | |
| `TP` / `threshold` / `T` | `threshold` | |
| `interval` / `I` | `interval` | |

The helper lives in `packages/pace-zones/src/` so iOS and Android clients can
reuse it. It is **not** `apps/web/src/lib/pace-zone-display.ts` — that file
handles display formatting of zone table rows; this is a separate
token-in-string substitution concern. Unknown tokens are passed through
unchanged.

### 5.4 Responsive behaviour

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column. Each week = vertical list of 7 day rows. Current week auto-expanded; past & future collapsed to a one-line summary (accordion, `type=multiple`); race week always has a header. Day detail = **bottom sheet** (~90% height max, drag-to-dismiss + close). |
| **Tablet 640–1024px** | Same vertical rhythm, wider rows; collapsed summaries can show long-run distance. Day detail = **centered modal dialog** (or right sheet). |
| **Desktop ≥ 1024px** | Week = **7-column grid row** + sticky weekly-summary rail. Weeks not collapsed by default except distant future ones (`• • •`); race week is a full row. Day detail = **right-hand side panel** (~380–420px), calendar stays usable. Max content width ~1180px, centered. |

Content never depends on hover.

### 5.5 Unit and week conventions

Miles only (`mi`); Monday-start weeks; both per the brief and ADR 0005. No
units or week-start setting is designed.

### 5.6 Data-shape requirement for the calendar (for tech-lead/swe — API contract)

The calendar must **not** assume one payload containing every day and every
activity for the whole 16–20 week plan. The API contract (`/api/v1`, OpenAPI)
should expose a **week window or cursor**: e.g. plan summary (race date,
`totalWeeks`, per-week header data — dates, planned/completed volume,
`phase`) returned once, plus days/activities/statuses for a requested week
range (default: current week ± 1), fetched as the runner expands weeks. This
keeps NFR1 (p95 < 2s) safe as the plan grows and lets a native client load
only what it shows. Collapsed week headers (which show volume and an
all-Achieved check) must be renderable from the summary alone. The exact
endpoint shape is an engineering call; the design constraint is only that
opening the calendar never requires the whole plan's activity data.

Per-day fields the UI needs from the API for the new statuses: `status`
(five-value enum from FR19), a boolean/enum for **activity swap** (or enough
data to derive it: day type + confirmed activity's run/non-run class), and a
**pending-suggestion count** per day (drives the "Suggestion" tag). The
current day's Planned → Missed flip is decided server-side at the runner's
local midnight; the client just renders `status` and must not compute Missed
from the clock.

### 5.7 Implementation notes — status identity, classification, totals

**Planned chip (new fifth `StatusBadge` value).** Must be distinct from
Missed and Rest **without relying on color** (NFR5):

| Status | Icon (Lucide) | Label | Fill/outline | Hue |
|---|---|---|---|---|
| Planned | `circle-dashed` | `Planned` | **dashed outline, no fill** | neutral (`text/primary`-adjacent; not the accent) |
| Missed | `x-circle` | `Missed` | filled/solid | red (`destructive/text`) |
| Rest | `moon` | `Rest` | filled | grey (neutral muted) |

Three separators, any one of which suffices: **icon shape** (dashed circle vs.
x vs. moon), **text label**, and **border style** (dashed vs. solid). Exact
hex and contrast (target ≥ 4.5:1 text, ≥ 3:1 for the dashed outline against
its background, both modes) are to be added to `ui-toolkit.md`'s completion-
status table when #53 is in (§10); until then, use the neutral token that
already passes 4.5:1 for `text/secondary`. Planned exists **only on the
current day**; a row is never Planned on an elapsed day.

**Run classification (swe).** "Running" vs "non-running" comes from the
**Strava sport type** on the activity — not from distance, pace, or the
activity's name. **All run variants are running** (`Run`, `TrailRun`,
`VirtualRun` — the closed v1 allowlist, defined in `packages/` so iOS/Android share it);
**`Walk` and `Hike` are non-running**, as are Ride, Swim, WeightTraining,
Yoga, etc. Implement as one shared classifier over the sport-type string
(ideally in `packages/` so iOS/Android reuse it) with a default for unknown
future types decided by the tech lead — do not scatter `=== 'Run'` checks. It
feeds: running-day scoring (run → Achieved, non-run → Missed + swap),
strength-day scoring (non-run → Achieved, run → Partial), and the swap
indicator. The template's `dayType` (not the activity) decides which rule
applies.

**Weekly totals — informational only.** No FR defines a weekly-totals
feature. The calendar week header **already shows a mileage total**
(`18 / 32 mi`, §4.1/§4.6), so no new element is designed. The completed-miles
numerator is **confirmed run miles only** (Run/TrailRun/VirtualRun per the FR20
allowlist); activity-swap non-run confirmations and Rest-day bonus activities
do not count toward run volume (non-run miles may appear as a separate note,
e.g. "also: 4.2 mi walked", but never merged into the running fraction).
Suggestions that are not confirmed do not feed the total. The number is shown
for information and is never used to grade a day or a week.

**Day-status rules at a glance (for tests).**

| Day type | Nothing confirmed, today | Nothing confirmed, elapsed | Confirmed run | Confirmed non-run | Future |
|---|---|---|---|---|---|
| `run` (incl. race day) | Planned | Missed | Achieved (any distance) | Missed + activity swap | no status |
| `strength` / `cross_training` | Planned | Missed | Partial | Achieved | no status |
| `rest` | Rest | Rest | Rest + bonus entry | Rest + bonus entry | no status |

A pending or dismissed suggestion never changes any cell above. Undo returns
a confirmed day to Planned (today) or Missed (elapsed).

---

## 6. Accessibility

Targets: **WCAG 2.2 AA** (NFR5 requires 2.1 AA; 2.2 is a superset — a
deliberate tightening).

### Keyboard path & focus order (mobile, populated)

1. Skip link (`Skip to this week`) — first focusable, visible on focus; jumps
   to the current week's header.
2. Menu button
3. Title (`<h1>`, not focusable)
4. "Today" pill button
5. Settings button
6. Connection banner (4.1b **or** 4.1c), if present — its `Connect`/`Reconnect`/
   dismiss controls are real tab stops. Backfill banner follows immediately after
   if both are present. Rendered in DOM order after Settings; tab order follows
   automatically (WCAG 2.4.3 — do **not** use a positive `tabindex` value to
   pull the Reconnect button ahead of its visual position).
7. Progress bar — not focusable
8. Week 8 header — `<button aria-expanded="false" aria-controls="week-8-days">`
9. (if expanded) every day, DOM order Mon→Sun, **including Rest days**
10. Week 9 header … same pattern for every week …
11. "Show weeks 11–16" control (between week 10 and week 17)
12. Week 17 and **Week 18 (race week)** headers, each expandable to 7 days
13. Race-day block — `<button>` / `<a>`

The Swap and Suggestion tags are part of the day's single `<button>`, not
separate tab stops.

**Enhancement (not required for v1):** roving `tabindex` + arrow keys between
day cells within a week (Notion Calendar). Tab must still reach every day.

### Day detail sheet

- On open: focus moves to the sheet. Mobile (modal): focus trapped, background
  `inert`/`aria-hidden`, **Esc** closes, focus returns to the originating day
  row. Desktop side panel (non-modal): focus moves in, **not** trapped, Esc
  closes.
- `role="dialog"`, `aria-modal="true"` on mobile, `aria-labelledby` → workout
  title `<h2>`.
- Prev/next: `aria-label="Previous day"` / `"Next day"`; day change announced
  via `aria-live="polite"` ("Now showing Thursday, March 12").
- The compact pace strip is plain text in reading order after `Planned`, e.g.
  read as "Pace reference: Easy 10:30 per mile, MGP 9:09 per mile, 10K pace
  8:10 per mile …"; give the container `aria-label="Pace reference"`. Since
  the strip now uses full token names (not single letters), no additional
  expansion is needed for screen readers.
- **Prescription row vs. status chip both say "Planned".** The prescription
  row is labelled for AT as "Prescribed: 4 miles, easy"; the chip is
  announced as "Status: Planned". Visible text stays `Planned` for both.
- **`ActivityMatchCard`'s Confirm/Dismiss** are plain `<button>`s. On
  activation, focus moves to the resulting state's first focusable element
  (the Undo button after Confirm; the sheet body after Dismiss) and the live
  region announces the result including the **status word**.
- **Multi-match `RadioGroup`**: standard arrow-key behavior; "Confirm
  selection" is `disabled`/`aria-disabled` until a choice is made, with a
  visible + SR-announced reason ("Choose one option first.").
- **Undo** is a plain `<button>`; live region announces the reversion
  (`Match undone. Friday is Missed.` / `… is Planned.` on today), focus moves
  to the now-visible `ActivityMatchCard`.
- Unlinked/bonus cards: `<section>` with a heading ("Extra activity") and
  plain text, no interactive controls.
- Status-chip changes (Planned/Missed → Achieved etc.) are announced **only**
  through the live region, not by re-announcing the chip. The midnight flip
  Planned → Missed is **not** announced (it happens without user action and
  would be noise); the chip simply reads the new value next time the day is
  read.

### Semantics / roles / labels

- `<main>` wraps the calendar; `aria-busy="true"` while loading.
- Countdown block: `<h2>`/Display-role text; not a live region.
- Progress: `role="progressbar" aria-valuemin="1" aria-valuemax="18"
  aria-valuenow="9" aria-label="Plan progress, week 9 of 18"`.
- Week list: `<ol>` of weeks; day list inside a week: `<ol>` of days.
- Each day control's accessible name is self-sufficient and **always includes
  a status word for an elapsed/current day**: `"Friday, March 13. Today.
  Easy run, 4 miles. Planned."` / `"Tuesday, March 10. Intervals, 6 miles.
  Missed. Activity swap: walk, 2.1 miles."` / `"Thursday, March 12. Tempo,
  7 miles. Missed. Suggestion waiting."` / `"Wednesday, March 11. Rest. Extra
  activity logged."` For a future day, no status word: `"Sunday, March 15.
  Long run, 14 miles."`
- Status icon, "Long" tag, "Today" pill, tag glyphs are supplementary
  (`aria-hidden`); the tag **text** is what is announced.
- Race-week Sunday row: `"Sunday, May 17. Race day. Marathon, 26.2 miles."`
  (plus the status word once it is today or elapsed.)
  Race block: `"Race day. Sunday, May 17. Marathon, 26.2 miles. 9 weeks to
  go."`
- `ActivityMatchCard`: `role="group"` with `aria-label` summarizing the
  candidate ("Possible match: run, 4.1 miles, 34 minutes, Friday 6:42 AM").
- Reconnect banner (4.1c): `role="status"`; icon `aria-hidden`; the amber
  color is never the only signal (icon + text).

### Contrast

- Body text, workout names, `description`: ≥ 4.5:1 (Tempo `text/primary`,
  both modes — verified in `ui-toolkit.md` once #53 lands).
- Muted metadata and the pace strip (`text/secondary`): ≥ 4.5:1 both modes.
- Status chip text/icon: ≥ 4.5:1 in every case, both modes — per-status
  numbers are in `ui-toolkit.md`'s completion-status table (#53); **Planned's
  numbers are to be added (§10)**, including ≥ 3:1 for its dashed border.
- Swap and Suggestion tags: outline border ≥ 3:1, text ≥ 4.5:1.
- Display countdown: ≥ 3:1 minimum.
- "Today" must not be **colour only**: accent border + "Today" text + weight.
- Status must not be **colour only**: icon + text label always. Planned vs.
  Missed vs. Rest specifically differ by icon shape, label, **and** border
  style (§5.7).
- Focus ring: visible, ≥ 3:1, never removed.

### Touch targets

- Day row: full width, **≥ 44 × 44 CSS px** (mobile ~52–56px), including Rest
  and race-week rows.
- Week header, `• • •` control: ≥ 44px tall, full width.
- Icon buttons (menu, settings, Today, prev/next, close): ≥ 44 × 44px.
- `ActivityMatchCard` Confirm/Dismiss, Undo, "Confirm selection", banner
  `Connect`/`Reconnect`: ≥ 44 × 44px.
- `RadioGroupItem` rows: ≥ 44px tall, full-width tap target.

### Motion

- Respect `prefers-reduced-motion`: no sheet slide (fade/instant), no chip
  transition, no accordion height easing.

---

## 7. New vs. reused patterns

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Collapsible section | library accordion | Reused | — |
| Bottom sheet / side panel for detail | library dialog/drawer | Reused | — |
| Skeleton loading, error-with-retry, empty-with-single-CTA | `HomePage.tsx` / `plan-setup-flow.md` | Reused | House state patterns. |
| Compact pace-reference strip | token-substitution helper in `packages/pace-zones/src/` (§5.3) | Reused | Same `formatPace` and token-mapping logic; this sheet is where the compact variant ships. Not `apps/web/src/lib/pace-zone-display.ts`. |
| **Week block** | — | New | The product's core object; built on an accordion, internal layout custom. |
| **Race-day / milestone block** | — | New | Pinned dated milestone with countdown; additional to race week, not a substitute. |
| **`StatusBadge`** | completion-status decision (#53) | New | First render of the cross-cutting status system; one shared module for calendar, sheet, and (with a different value set) the Strava settings card. |
| **Planned chip (dashed outline)** | `StatusBadge` | New value | FR19 added a fifth status for "today, not yet confirmed"; existing four (filled) values didn't cover a "still possible" state, so it takes the outline treatment (TrainingPeaks planned-outline, Things open circle). |
| **Activity-swap / Suggestion tags** | outline `Badge` (same as "Extra activity") | New use, same primitive | Secondary tags beside a status, deliberately not status-colored. |
| **`ActivityMatchCard`** (suggest → confirm/dismiss → undo) | — | New | First "system inferred something, confirm or reject it" pattern; the replacement for manual mark-complete. Used on every non-rest day type. |
| Single-select with "none of these" | `RadioGroup` (plan-setup) | New use, same primitive | FR18. |
| Unlinked/bonus-activity read-only card | — | New | FR17; no existing vocabulary. |
| Connection banners (4.1b/4.1c) | `Alert` | New use | One slot, one banner at a time. |

---

## 8. Open questions and TPM flags (product decisions — not for the designer to invent)

Routed to `@tpm` / `@tech-lead`.

**Closed by the brief + ADR 0005 (no longer open):** units (**miles only**,
product brief); week start (**Monday**, ADR 0005); phase labels (template
`phase`: base / build / peak / taper, ADR 0005 — the UI displays the field,
boundaries are authored in the template).

**Resolved by PR #58 (were open in pass 1; spec now follows the FRs):**

- **"Missed" on the current day** — resolved: today reads **Planned** until an
  activity is confirmed, then Missed at the runner's local midnight (FR19).
  The pass-1 "today shows Missed" treatment is gone.
- **FR20 "short of it" threshold** — resolved: there is no threshold. Any
  confirmed run of any Strava run type is Achieved; Partial is not computed
  for running days in v1 (it stays in the enum for later). "Wrong type" is
  judged by Strava sport type (§5.7).
- **FR21 vs FR22 overlap** — resolved: strength/cross-training is FR21; FR22
  is deferred and reserved for a future description-only day kind (§4.2i).

**Backlog issues that now own previously open items:**

1. **After race day (issue #56, "Define what a runner does after race day
   (post-race baseline/maintenance plan)").** Plan archive/recap and what
   comes next. Race day itself is scored as a normal running day (FR20) and
   Race day detail (C) now shows the status chip and match card; only the
   *aftermath* is open.
2. **Swap detection (issue #57, "Detect day swaps after the fact").** e.g.
   Thursday's workout done on Wednesday. This spec's "activity swap" covers
   only a non-run confirmed on a run day; cross-day swaps are not designed.

**Still open:**

3. **Notifications/reminders** — out of scope, would deep-link into this
   screen (the day-sheet deep link supports it).
4. **Dismissed-match review** — FR14 requires undo for a *confirmed* match
   only. This spec doesn't invent a "review dismissed matches" surface;
   revisit if runners dismiss by mistake. Related: once dismissed, is the
   same activity re-offered? Late syncs re-evaluate "affected days" (FR19), so
   engineering needs a rule (assumed here: a dismissed activity is not
   re-offered, but a *new* activity on that day is).
5. **Backfill status UX** — the lightweight banner (§3) is placeholder-grade;
   `web-v1-requirements.md` flags "poll vs. push" as still open.
6. **Activity timezone vs. local calendar day** — which day an activity near
   midnight attaches to is still open from the sync exploration
   (`docs/planning/exploration-activity-sync.md`); it decides which day's
   status a late-evening run affects. **New angle from PR #58:** Planned →
   Missed flips at "the runner's local midnight", so the product needs a
   source for the runner's timezone (browser-reported vs. stored on the
   account) — and it must not require location data (CLAUDE.md privacy:
   an IANA zone name is the minimum needed).
7. **Offline/PWA** — is offline plan viewing a v1 requirement? Not addressed.
8. ~~**Weekly totals need scoping.**~~ **Closed:** confirmed run miles only
   (FR20 run-type allowlist: Run/TrailRun/VirtualRun; see §5.7). Non-run
   swap/bonus miles do not count toward run volume. Unconfirmed suggestions
   excluded. Treated as informational; no per-week adherence number in v1.
9. **Discovering late suggestions in collapsed weeks.** v1 shows a per-day
   "Suggestion" tag only; a week-header count is deliberately omitted (§4.1).
   Revisit if runners miss late syncs (§9).

**Resolved earlier, still resolved:** completed data comes from Strava
auto-sync + confirm (FR13/14); no manual mark-complete; one active plan
(FR23/24, switcher UI deferred to #32/#33); missed-workout copy stays neutral
and non-guilt.

---

## 9. Validate with users

Before committing further build:

- **Row-per-week vs. month grid.** Show both to 2–3 marathon runners.
- **Confirm/Dismiss friction vs. the old "mark complete."** Validate that
  suggested matches get confirmed quickly with real Strava data — and whether
  the "Suggestion" row tag on old Missed days is noticed and acted on.
- **Planned vs. Missed vs. Rest at a glance** — is the dashed-outline Planned
  chip distinguishable from Rest and Missed at real mobile size, including in
  greyscale?
- **Activity-swap copy** — does "You did a walk instead of the planned run."
  read as neutral, or does "Missed" next to a logged walk feel unfair?
  (FR20 mandates Missed; the copy and tag are the only softening lever.)
- **"Is this it?" copy and `ActivityMatchCard` layout** — enough information
  to confirm without opening Strava?
- ~~**Pace-zone shorthand in the day-detail sheet** — does `3–4x1K @ TP` plus
  the `E/T/I/M` strip read clearly to the target runner, or do people need
  the letters spelled out?~~ **Closed:** full zone names in the legend
  (`Easy · MGP · HMGP · 10K pace · 5K pace`), inline pace in the workout
  description (`3–4x1K @ 10K pace (8:10/mi)…`). No single-letter shorthand
  in workout text.
- **Collapsing past weeks by default** — do runners want an at-a-glance
  adherence read?
- **Status chip legibility at compact desktop size** (`●Ach`/`◐Prt`/`✕Msd`/
  `☾Rest`/`○Plan`) at real screen size.

After shipping:

- Whether people scroll to/tap the race block, or the countdown/race week is
  enough.
- Whether multiple weeks get expanded at once (validates `type=multiple`).
- How often "None of these" is picked (FR18) — a data-scientist signal on
  matching quality.
- How often Confirm is followed by Undo.
- How often a late-synced suggestion is confirmed vs. dismissed (whether the
  row cue works).

---

## 10. Toolkit additions (delta since PR #53 is on `main`)

PR #53 is on `main`. The following are **already in `docs/design/ui-toolkit.md`
on `main`** and do NOT need to be added again: `StatusBadge`, `AlertDialog`,
`ActivityMatchCard`, the Lucide glyph set, and the Tempo color/type tokens.

This section lists only what **this PR (#55) adds** to the toolkit (or
corrections to existing entries). Land these with the first consumer PR
(#16/#17/#18/#20/#24); match the table format in `ui-toolkit.md`.

**New entries this PR adds**

| Entry | Spec |
|---|---|
| **Planned** completion-status chip | `circle-dashed` icon, label `Planned`, dashed-outline/no-fill chip, neutral hue (not the accent color). Record verified hex + contrast in the completion-status table: ≥ 4.5:1 for label text, ≥ 3:1 for the dashed border against its background, both light and dark modes. Only used for the current day. |
| **Activity-swap tag** | outline `Badge` + `arrow-left-right` Lucide glyph; neutral, never a status color. New use of the outline-Badge pattern. |
| **Suggestion tag** | outline `Badge` + `link-2` Lucide glyph; same neutral treatment. New use of the outline-Badge pattern. |

**Three corrections to record in `ui-toolkit.md`**

1. **Last-synced absolute timestamp:** use `sr-only` visually-hidden text to
   expose the full timestamp to screen readers — do **not** use a `title`
   attribute (inaccessible on touch, inconsistent SR support).
2. **Auth-expired reconnect banner (4.1c):** warning treatment (amber `Alert`
   variant), **not** destructive (red). The situation is recoverable and not
   an error.
3. **Not-connected state icon:** use `link-2-off` Lucide icon, not any other
   broken-link variant.
