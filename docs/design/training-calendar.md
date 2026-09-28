# Design spec — Training calendar + day detail (view, Strava match, completion status)

> Owned by `@designer`. Status: **ready for implementation once PR #53 is
> merged into this branch** (see "Dependencies" below) — scoped against issues
> #16/#17/#18 (calendar + day-detail) and #24 (Strava activity-match UI in the
> day-detail sheet), FR8–FR22 in `docs/planning/web-v1-requirements.md`, and
> ADR 0005 (`docs/decisions/0005-plan-template-schema.md`) for the template's
> `dayType` / `description` / `distanceMiles` / `phase` fields.
> Companion spec: `docs/design/strava-connect-settings.md` (issue #20 — the
> connect/disconnect flow this screen assumes already exists). Old throwaway
> wireframe `docs/design/wireframes/training-calendar-marathon.html` is stale
> against this revision (built against the pre-FR "mark complete/skip" flow) —
> do not build from it; it is not being regenerated in this pass.
>
> ### Dependencies — where the things this spec names are defined
>
> **This PR (#55) touches only this file and `strava-connect-settings.md`. It
> does not modify `docs/design/ui-toolkit.md`.** The following are defined on
> **PR #53 ("plan-setup flow + pace-reference table", branch
> `12-plan-setup-flow`)** and arrive in this tree when `main` is merged into
> this branch after #53 lands:
>
> | Referenced here | Defined in | Arrives with |
> |---|---|---|
> | **Tempo** color/type system (tokens `text/secondary`, `accent/solid`, `border/subtle`, `destructive/text`, Display / Numeral / H2 / Body roles) | `docs/design/ui-toolkit.md` | #53 |
> | **Completion-status decision** (Achieved / Partial / Missed / Rest: icon + label + hex + verified contrast ratios) | `docs/design/ui-toolkit.md` | #53 |
> | `plan-setup-flow.md` §7.4 (compact pace-reference chip strip, deferred to this day-detail sheet; `PaceZoneTable` helpers, `lib/pace-zone-display.ts`) | `docs/design/plan-setup-flow.md` | #53 |
> | Already-adopted primitives cited here (`Alert`, `RadioGroup`, `Skeleton`) | `plan-setup-flow.md` / `ui-toolkit.md` | #53 |
>
> The rows this spec **adds** to the toolkit (`StatusBadge`, `AlertDialog`,
> the new Lucide glyphs, custom-component entries) are **not** in
> `ui-toolkit.md` yet. They are listed in §10 so whoever lands the first
> consumer can add them once #53 is in. Until then, treat any "see
> `ui-toolkit.md`" pointer below as a pointer to #53's version of that file.
>
> **Revision (2026-09-28) — full rewrite of the flow, plus review fixes.**
> The previous version designed a manual binary **"Mark complete / Skip"**
> button. That no longer matches the product: per FR13–FR14, activities sync
> **automatically** from Strava and the runner **confirms or dismisses a
> suggested match**. Per FR19–FR22, status (Achieved / Partial / Missed /
> Rest) is **computed**, not toggled. Review round 1 (PR #55) then corrected:
> template pace-zone shorthand + compact pace reference on every running day
> (FR8/FR10); no blank/undetermined status (FR19); strength/cross-training
> going through `ActivityMatchCard` (FR14); an explicit FR22 mapping; race
> week kept as a real 7-day block; the auth-expired banner drawn here (§4.1c);
> a Partial running-day state; and an API-shape requirement (§5.6).

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
- See each elapsed/current day's **computed** status — Achieved / Partial /
  Missed / Rest (FR19–FR22) — never manually toggled and **never blank**.
- Open a single day for detail: prescription, the **compact pace reference**,
  any Strava-matched activity/activities, and the status that follows.
- **Confirm or dismiss** a suggested Strava match (FR14) on **every day type**
  (running, strength/cross-training), **undo** a confirmed match, and **pick
  one** from multiple plausible same-day matches (FR18, "none of these"
  always an option).
- See unscheduled or extra activities as **unlinked/bonus entries** — never
  dropped, never silently applied (FR17).
- See race day as a milestone, with **race week kept as a full 7-day block**.

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
| **Things 3** | A completed item gets a small, solid, **muted** check circle plus a fade — color does almost no work; icon shape and text-muting carry "done". | Icon + label do the primary work, color is supporting, never the only signal. **Fade-not-delete** for a Missed day: fully legible, just quieter than Achieved. | Strikethrough on the title — the prescription is a historical record, not a to-do to cross out. Use muting/weight instead. |
| **Todoist** | Done tasks go grey + a light checkmark, not green — de-emphasis more than bright color. | The case for a muted, low-saturation Achieved green. | Priority-flag color dots (different semantic). |
| **Apple Reminders** | The unfilled-circle → filled-circle transition is the clearest part, more than the fill color. | Unfilled-outline → filled-shape as the *primary* signal, color secondary; matches TrainingPeaks' outline-to-fill. | Smart-list chrome (Today/Scheduled/Flagged). |

### Direction (one paragraph)

The calendar **is** the home screen and opens on **this week**, never a month
grid — a marathon build is read week by week, with the long run as each
week's anchor. Borrowing TrainingPeaks' planned-outline → completed-fill
pairing and Strava's calm done/not-done contrast, each elapsed **or current**
day carries a small, **muted** status chip — icon + label + restrained color
(Things/Todoist's lesson) — while exactly one element per screen is visually
loud: **today**, using Notion Calendar's and Apple Calendar's single-idiom
"today" treatment. Every day states its workout in the **template's own
words** (pace-zone shorthand such as `3–4x1K @ TP`) and the day-detail sheet
resolves that shorthand against the runner's personal pace reference
(`E 8:15 · T 7:05 · …`) — the plan's authoring vocabulary is the product, not
jargon to hide. Numbers are the hero where genuinely compared — per-day
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
- **Status is never blank for an elapsed or current day (FR19).** Until a
  match is confirmed nothing is applied (FR14), so the day reads **Missed**
  (or **Rest**); Confirm then recomputes. Only **future** days show no status.
- Numbers are the hero **only where they're a comparison column**; a
  standalone hero stat (the countdown) is large body type, not mono.
- Never rely on colour alone: status, today, rest, and long run each carry a
  text label.
- A suggested match is a **suggestion**, never silently applied (FR14), for
  **every** day type — confirm/dismiss must feel as fast as the old "mark
  complete" tap.
- Into a day's detail in one tap, back in one tap; confirming/dismissing is
  one tap from inside that sheet.
- **No coach jargon in v1 (no TSS/IF/CTL).** The template's pace-zone
  shorthand (`E`/`T`/`I`/`M`, `@ TP`) **is** the workout text: show it
  verbatim and resolve it with the compact pace reference — never rewrite it
  into conversational copy, never strip it.

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
   - **Running day (`dayType: 'run'`):** workout title, the template's
     **`description` verbatim** (pace-zone shorthand), the `Planned` row
     (distance/duration), and — directly beneath — the **compact pace
     reference** strip (`E 8:15 · T 7:05 · I 6:40 · M 7:30`), reusing
     `PaceZoneTable`'s formatting helpers from `plan-setup-flow.md` §7.4
     (`lib/pace-zone-display.ts`, arrives with #53). The full table stays in
     plan setup.
   - **Strength / cross-training (`strength`, `cross_training`):**
     `description` verbatim, no distance/pace figure (FR11), **no pace
     strip** (nothing to resolve).
   - **Rest (`rest`):** "Rest".
   - For an **elapsed or current** day (FR19): the computed **status chip**
     (Achieved / Partial / Missed / Rest) — **always present**. Future days:
     no chip, no activity section.
4. Contents, conditionally, depending on what Strava has synced — **exactly
   one** of these renders in the activity section. The rule for all of them:
   **nothing is applied until Confirm (FR14)**, so before Confirm a
   running/strength day's status is **Missed** and a Rest day's is **Rest**.
   - **a. No connection / nothing synced:** quiet note, no card. Status
     **Missed** (or **Rest**).
   - **b. One plausible match, unconfirmed (FR14):** an `ActivityMatchCard`
     (type, distance/duration, start time, **Confirm** and **Dismiss**) **on
     running and strength/cross-training days alike**. Status chip reads
     **Missed** while it is pending. **Confirm** → the match applies and the
     status recomputes by day type: **running → FR20** (Achieved if the type
     matches and it meets the prescription; **Partial** if right type but
     short, or wrong type); **strength/cross-training → FR21** (Achieved if
     any non-running activity; **Partial** if a running-only activity);
     the card becomes state (c) with **Undo**. **Dismiss** → suggestion
     cleared, status stays **Missed**; the activity is **not** deleted (see
     §8 #6 on re-offering).
   - **c. Confirmed match:** logged activity's real detail against the
     Planned row, status chip shows the computed result, secondary **Undo**
     returns to (b) — status returns to **Missed**; nothing is un-synced or
     deleted (FR14).
   - **d. Multiple plausible matches (FR18):** single-select list plus
     **"None of these"** and **Confirm selection**. Chip reads **Missed**
     until Confirm. Confirm behaves like (b)'s Confirm; "None of these"
     behaves like (b)'s Dismiss for all candidates.
5. **Unlinked/bonus entries (FR17)** render as read-only cards **below** the
   prescription/match section: an unscheduled activity on a Rest day, or an
   extra activity on an already-matched day. Type, distance/duration, start
   time, "Extra activity" outline chip. Nothing to do with it in this pass.
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
   Race day detail** — same sheet pattern, content is the race (date,
   distance, countdown, a note that the week before is a taper). Post-race
   recap and post-race status are open (§8 #4).

### Backfill note (FR16/FR25 — kept lightweight)

Joining a plan after its start date, or switching plans, triggers a bounded
backfill (≤5 min per NFR4). While it runs, affected days simply render per
state (a) — **Missed/Rest, as if nothing has synced** — rather than a spinner
per day; a single dismissible `Alert` at the top reads **"Filling in your
recent history — this can take a few minutes."** and disappears when the job
completes (poll vs. push is a swe/deploy-engineer call). It sits in its own
slot **below** any connection banner (§4.1b/c). Not a full backfill-status
spec; see §8 #7.

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
│ ▸  Week 8   Mar 3–Mar 9    28/28mi ✓│  COLLAPSED past week (all Achieved). tap header = expand
├─────────────────────────────────────┤
│ ▾  Week 9   Mar 10–Mar 16  18/32 mi │  EXPANDED current week. header is a button (aria-expanded)
│  ┌───────────────────────────────┐  │
│  │ Mon 10 Easy run    5 mi ●Achvd│  │  Achieved — green chip, check-circle-2 icon
│  │ Tue 11 Intervals    6 mi ◐Part│  │  Partial — amber chip, circle-dot icon
│  │ Wed 12 Rest             ☾Rest│  │  Rest — grey chip, moon icon, STILL a tap target (FR17)
│  │ Thu 13 Tempo        7 mi ●Achvd│  │  Achieved
│  │▎Fri 14 Easy · Today  4 mi ✕Msd›│  │  TODAY — accent left border + "Today" label; status is
│  │                               │  │  NEVER blank (FR19): Missed until a match is confirmed
│  │ Sat 15 Rest                   │  │  future Rest day: no chip (future)
│  │ Sun 16 Long run [LONG] 14 mi ›│  │  UPCOMING long run — "Long" tag, no status (future)
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ ▸  Week 10  Mar 17–Mar 23  34 mi    │  COLLAPSED future week (adjacent, always shown)
├─────────────────────────────────────┤
│        • • •  Show weeks 11–16      │  ellipsis: ONLY distant future weeks (never race week)
├─────────────────────────────────────┤
│ ▸  Week 17  Apr 28–May 4   30 mi    │  adjacent-to-race-week, always shown
│ ▸  Week 18  May 5–May 11 · Race week│  RACE WEEK — real week block, header always visible.
│                            22 mi    │  Expands to 7 day rows (see 4.1d)
├─────────────────────────────────────┤
│ ╔═════════════════════════════════╗ │
│ ║ [⚑]  RACE DAY                   ║ │  pinned finish-line block: ADDITIONAL scroll target,
│ ║      Sun, May 11 · Marathon 26.2║ │  after race week — not a replacement for it
│ ║      9 weeks to go            › ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

Each running-day row shows the template's workout name (from `description`'s
leading label / `workoutTag`) — the full `description` text appears in the
day-detail sheet, not in the row (row stays one line).

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
always **Missed** (running/strength days) or **Rest** — correct per
FR19–22 (nothing can sync). Not an error state; the banner nudges without
blocking.

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
synced reads **Missed** — the banner is the explanation. Precedence when
several banners apply: connection banner (4.1b **or** 4.1c) first, backfill
banner (§3) below it.

### 4.1d Race week expanded (mobile) — a full 7-day block

```
│ ▾  Week 18  May 5–May 11 · Race week│
│  ┌───────────────────────────────┐  │
│  │ Mon 5  Easy run      4 mi     ›│  │  future days: no chip
│  │ Tue 6  Easy run      3 mi     ›│  │
│  │ Wed 7  Rest                   ›│  │
│  │ Thu 8  Shakeout      2 mi     ›│  │
│  │ Fri 9  Rest                   ›│  │
│  │ Sat 10 Easy run      2 mi     ›│  │
│  │ Sun 11 [⚑] Race day  26.2 mi  ›│  │  race-day row → opens C. Race day detail
│  └───────────────────────────────┘  │
```

(Day names/distances illustrative; the real rows come from the template.)

### 4.2 Day detail sheet

**4.2a — Running day, FUTURE (no status, no activity section)**

```
┌─────────────────────────────────────┐
│               ────                   │  drag handle (mobile). [✕] close (44px) also present
│ ‹ Prev     Sun, Mar 16     Next ›    │  in-sheet day stepper. center = focus target on open
├─────────────────────────────────────┤
│  Long run                            │  h2 — sheet's accessible name
│  Week 9 · build                      │
│                                      │
│  14 mi, first 10 @ E, last 4 @ M     │  template `description`, verbatim (pace-zone shorthand)
│  Planned      14 mi · long run       │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │  compact pace reference (PaceZoneTable helpers, #53 §7.4)
│                                      │
│  ── future day: nothing below here — no status chip, no activity section ──
```

**4.2b — Running day, elapsed OR current, Strava connected, nothing synced**

```
│  Easy run                            │
│  3–4x1K @ TP · 6 mi                  │  description verbatim (example of a quality day)
│  Planned      6 mi · threshold       │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │
│                                      │
│  Missed  ✕                           │  status chip (red, x-circle) — FR20: nothing logged
│  No activity logged for this day.    │  plain note, no card
```

Same layout for **today**: chip reads **Missed**, note unchanged. (TPM
question in §8 #1 — a same-morning "Missed" — the spec follows FR19 as
written.)

**4.2c — One plausible match, unconfirmed (FR14) — status is Missed, not blank**

```
│  Planned      4 mi · easy            │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │
│                                      │
│  Missed  ✕                           │  nothing is applied until Confirm (FR14) → FR20 "nothing
│  ┌───────────────────────────────┐   │  logged"; recomputes on Confirm
│  │ Is this it?                   │   │  ActivityMatchCard
│  │ Run · 4.1 mi · 34:12           │   │
│  │ Fri, Mar 14 · 6:42 AM          │   │
│  │  ┌───────────┐ ┌─────────────┐ │   │
│  │  │  Confirm  │ │   Dismiss   │ │   │  primary / secondary buttons, ≥44px
│  │  └───────────┘ └─────────────┘ │   │
│  └───────────────────────────────┘   │
```

**4.2d — Confirmed match, Achieved (FR20: right type, meets prescription)**

```
│  Planned      4 mi · easy            │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │
│  Logged       4.1 mi · 34:12 · Run   │
│                                      │
│  Achieved  ✓                         │  status chip (green, check-circle-2)
│  ┌───────────────────────────────┐   │
│  │           Undo                │   │  returns to 4.2c (status back to Missed)
│  └───────────────────────────────┘   │
```

**4.2d-2 — Confirmed match, Partial running day (FR20: right type but short, or wrong type)**

```
│  Planned      6 mi · threshold       │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │
│  Logged       3.2 mi · 27:40 · Run   │  short of the prescription
│                                      │
│  Partial  ◐                          │  status chip (amber, circle-dot)
│  Ran 3.2 of 6 mi.                    │  one plain line saying why (short of prescription).
│  ┌───────────────────────────────┐   │  Wrong-type case: "Logged activity was a ride, not a run."
│  │           Undo                │   │
│  └───────────────────────────────┘   │
```

The explanation line is a plain-language restatement of FR20's rule, shown
only on Partial, so the chip is never a mystery. Exact "short of it"
threshold is FR20's/swe's to define (tpm question, §8 #2) — the UI only
renders the computed result and, if the API supplies it, the reason.

**4.2e — Multiple plausible matches (FR18) — status is Missed until Confirm**

```
│  Planned      4 mi · easy            │
│  E 8:15 · T 7:05 · I 6:40 · M 7:30  │
│                                      │
│  Missed  ✕                           │  unchanged until a choice is confirmed
│  Which one is this?                  │  h3, group legend
│  ○ Run · 4.0 mi · 33:50 · 6:41 AM    │  RadioGroupItem
│  ○ Run · 4.3 mi · 36:02 · 7:15 AM    │  RadioGroupItem
│  ○ None of these                     │  RadioGroupItem — always present, FR18
│  ┌───────────────────────────────┐   │
│  │      Confirm selection        │   │  disabled until one option is chosen
│  └───────────────────────────────┘   │
```

A run + Confirm selection behaves like 4.2c's Confirm; "None of these" +
Confirm selection behaves like Dismiss (stays Missed; not re-offered
automatically, §8 #6).

**4.2f — Rest day, no bonus activity**

```
│  Rest                                │  h2
│  Week 9                              │
│  Rest  ☾                             │  status chip (grey, moon) — always Rest
│  Nothing scheduled today.            │
```

(A **future** Rest day shows no chip, like any future day.)

**4.2g — Rest day WITH an unlinked bonus activity (FR17)**

```
│  Rest                                │
│  Rest  ☾                             │  still Rest — a bonus activity doesn't change it
│  Nothing scheduled today.            │
│  ┌───────────────────────────────┐   │
│  │ ＋ Extra activity              │   │  outline chip, no fill
│  │ Run · 3.2 mi · 28:40           │   │  read-only — nothing to confirm/dismiss
│  │ Wed, Mar 12 · 5:30 PM          │   │
│  └───────────────────────────────┘   │
```

**4.2h — Strength / cross-training day (FR11, FR14, FR21) — goes through `ActivityMatchCard` like every other day**

Elapsed, activity suggested, **not yet confirmed** — status is Missed:

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
│  │ Thu, Mar 13 · 6:10 PM          │   │
│  │  [ Confirm ]   [ Dismiss ]     │   │
│  └───────────────────────────────┘   │
```

After **Confirm**, FR21 scores it:

- non-running activity (weight training, ride, yoga…) → **Achieved ✓** + `Logged` row + `Undo`;
- a running-only activity confirmed on a strength day → **Partial ◐** + `Logged` row + `Undo`
  (same layout as 4.2d-2 with a one-line reason: "Logged a run, not a strength session.").
- If nothing synced (or Dismissed) → **Missed**, same copy as 4.2b.

FR21 is a *scoring* rule that applies after Confirm; a synced activity never
sets Achieved/Partial by itself. Multi-match (FR18) and undo behave exactly
as on running days.

**4.2i — Freeform-described day (FR22) — mapping and explicit deferral**

Mapping from ADR 0005's `dayType` to the scoring rule the UI renders:

| Template `dayType` | Has numeric target? | Rule | Possible confirmed results |
|---|---|---|---|
| `run` | Yes — `distanceMiles` is **required** on run days (ADR 0005 rule 1) | FR20 | Achieved / Partial / Missed |
| `strength`, `cross_training` | No | FR21 | Achieved / Partial / Missed |
| `rest` | — | FR19 | Rest |
| *(freeform, description-only, no numeric target, not one of the above)* | No | FR22 | Achieved / Missed (**no Partial**) |

**Deferral, stated explicitly:** under ADR 0005 every v1 template day is one
of the four `dayType`s, and `run` always carries a numeric target — so **no
v1 template day is FR22-only**. Strength/cross-training days also have a
description and no numeric target, but FR21 is the more specific rule and
gives them a Partial tier, so this spec scores them as FR21. There is
therefore **no separate FR22 wireframe in this pass**. If a future template
adds a description-only day kind, it renders as **4.2h with the Partial
outcome suppressed** (running-only match → treated as a normal confirmed
activity → Achieved; nothing confirmed → Missed). swe: switch on `dayType`,
not on "is there a numeric target"; do not infer FR22 from a missing
`distanceMiles`. Flagged for TPM in §8 #3 (FR21/FR22 overlap for
strength/cross-training).

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
│  Week 8 · Mar 3–Mar 9                                         28 / 28 mi  ✓   │  week sub-header (sticky), Numeral role
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 3  │Tue 4  │Wed 5  │Thu 6  │Fri 7    │Sat 8  │Sun 9  [LONG]│  wk 8   │  │
│  │Easy   │Hills  │Rest   │Tempo  │Easy     │Rest   │Long run     │  28 mi  │  │  ← weekly-summary rail
│  │5mi●Ach│6mi●Ach│ ☾Rest │6mi●Ach│4mi●Ach  │ ☾Rest │12mi●Achieved│ all Ach │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 9 · Mar 10–Mar 16                                       18 / 32 mi      │
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 10 │Tue 11 │Wed 12 │Thu 13 │▏Fri 14  │Sat 15 │Sun 16 [LONG]│  wk 9   │  │
│  │Easy   │Interv │Rest   │Tempo  │▏Today   │Rest   │Long run     │  32 mi  │  │
│  │5mi●Ach│6mi◐Prt│ ☾Rest │7mi●Ach│▏4mi✕Msd │       │14 mi        │ 18 done │  │  today: status never blank
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 10 · Mar 17–Mar 23                                      34 mi planned   │
│  ...                                                                          │
│                     • • •  Show weeks 11–16                                   │  distant weeks only
│  Week 17 · Apr 28–May 4                                       30 mi planned   │
│  Week 18 · May 5–May 11 · Race week                           22 mi planned   │  RACE WEEK = full 7-column row
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 5  │Tue 6  │Wed 7  │Thu 8  │Fri 9    │Sat 10 │Sun 11 [⚑]   │  wk 18  │  │
│  │Easy   │Easy   │Rest   │Shake  │Rest     │Easy   │Race day     │  22 mi  │  │
│  │4 mi   │3 mi   │       │2 mi   │         │2 mi   │26.2 mi      │         │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  ╔════════════════════════════════════════════════════════════════════════╗   │
│  ║ [⚑]  RACE DAY       Sun, May 11 · Marathon 26.2 mi · 9 weeks to go      ║   │  additional target after race week
│  ╚════════════════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────────────────┘
     Day detail opens as a right-hand SIDE PANEL — calendar stays visible.
```

Per-day mileage and the weekly `28 / 28 mi` fraction use the Numeral role
(tabular IBM Plex Mono). Status abbreviations (`●Ach`/`◐Prt`/`✕Msd`/`☾Rest`)
are compact renderings of the same status chip — same icon, color and label
semantics, abbreviated for width, never color-only.

---

## 5. Interface detail

### 5.1 Layout & spacing intent

- **Vertical rhythm.** Week blocks separated by a hairline rule
  (`border/subtle`, Tempo). Day rows separated by lighter hairlines. Row
  height ~52–56px on mobile.
- **Number alignment.** Only genuine comparison columns use the Numeral role,
  right-aligned. The countdown is Display-role Figtree, not mono.
- **Hierarchy.** Countdown largest (Display). Week numbers/volumes next
  (H2/Numeral). Workout names Body. Dates, "Rest", metadata Body-sm/
  `text/secondary`, never below 4.5:1 (§6).
- **Day-detail vertical order (running day):** title → `description`
  (verbatim, Body) → `Planned` row → compact pace strip (Body-sm, Numeral
  role for the times) → status chip → activity section → extra-activity
  cards.
- **Status chip.** Small, muted, icon + label + color — never a row wash.
- **One accent, spent on today.** `accent/solid` only on the **today**
  indicator; status colors are their own palette.
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
| `StatusBadge` (Achieved/Partial/Missed/Rest) | `Badge` (custom color/icon) | Shared module used by day row, desktop cell (compact), and day-detail sheet. Definition lands with #53; toolkit row in §10. |
| Compact pace reference strip | plain markup over `PaceZoneTable` helpers (`lib/pace-zone-display.ts`) | Reuse, don't rebuild; defined in `plan-setup-flow.md` §7.4 (#53). |
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
| Week header | `Week 9` · `Mar 10 – Mar 16`; race week: `Week 18` · `May 5 – May 11 · Race week` |
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
| Status chip labels | `Achieved` · `Partial` · `Missed` · `Rest` (verbatim) |
| Partial reason, short | `Ran 3.2 of 6 mi.` |
| Partial reason, wrong type | `Logged activity was a ride, not a run.` (type name from the activity) |
| Partial reason, run on strength day | `Logged a run, not a strength session.` |
| Unlinked/bonus chip | `Extra activity` |
| Distant-weeks control | `• • •` (tap: `Show weeks 11–16`) |
| Race block title | `Race day` |
| Race block detail line | `Sun, May 11 · Marathon 26.2 mi` |
| Race block countdown | `9 weeks to go` → `Race week` → `Race day is today` |
| Day detail — workout text | template `description`, verbatim |
| Day detail — planned row | `Planned` → e.g. `4 mi · easy` |
| Day detail — pace reference | `E 8:15 · T 7:05 · I 6:40 · M 7:30` (formatting from `lib/pace-zone-display.ts`) |
| Day detail — logged row | `Logged` → e.g. `4.1 mi · 34:12 · Run` |
| Day detail — no activity | `No activity logged for this day.` |
| Suggested-match card heading | `Is this it?` |
| Suggested-match Confirm | `Confirm` |
| Suggested-match Dismiss | `Dismiss` |
| Confirmed-match Undo | `Undo` |
| Multi-match heading | `Which one is this?` |
| Multi-match "none" option | `None of these` |
| Multi-match confirm button | `Confirm selection` |
| Live-region: match confirmed | `Friday's easy run matched to a 4.1 mile run. Marked {Achieved\|Partial}.` (status word = the computed result) |
| Live-region: match dismissed | `Match dismissed. Friday is marked Missed.` |
| Live-region: match undone | `Match undone. Friday is marked Missed.` |
| Empty title | `No plan yet` |
| Empty body | `Add your race date and we'll lay out the training weeks leading up to it.` |
| Empty CTA | `Set up plan` |
| Error title | `Couldn't load your plan` |
| Error body | `Check your connection and try again.` |
| Error retry | `Try again` |
| Loading (SR only) | `Loading your plan` |

Tone: plain, second person, no exclamation marks. **Coach jargon** (TSS/IF/
CTL) is out; the template's own pace-zone shorthand is the workout text and is
shown as written. The old "Nice. Long run Sunday." nudge is dropped — a
confirmed match is a matter-of-fact event, so live-region copy states the
fact plainly.

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

---

## 6. Accessibility

Targets: **WCAG 2.2 AA** (NFR5 requires 2.1 AA; 2.2 is a superset — a
deliberate tightening).

### Keyboard path & focus order (mobile, populated)

1. Skip link (`Skip to this week`) — first focusable, visible on focus; jumps
   to the current week's header.
2. Menu button
3. Connection banner (4.1b **or** 4.1c) and/or backfill banner, if present —
   its `Connect`/`Reconnect`/dismiss controls are real tab stops.
4. Title (`<h1>`, not focusable)
5. "Today" pill button
6. Settings button
7. Progress bar — not focusable
8. Week 8 header — `<button aria-expanded="false" aria-controls="week-8-days">`
9. (if expanded) every day, DOM order Mon→Sun, **including Rest days**
10. Week 9 header … same pattern for every week …
11. "Show weeks 11–16" control (between week 10 and week 17)
12. Week 17 and **Week 18 (race week)** headers, each expandable to 7 days
13. Race-day block — `<button>` / `<a>`

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
  via `aria-live="polite"` ("Now showing Thursday, March 13").
- The compact pace strip is plain text in reading order after `Planned`, e.g.
  read as "Pace reference: E 8:15 per mile, T 7:05 per mile …"; give the
  container `aria-label="Pace reference"` and expand the zone letters for
  screen readers (`E` → "easy"), since the letters alone are ambiguous.
- **`ActivityMatchCard`'s Confirm/Dismiss** are plain `<button>`s. On
  activation, focus moves to the resulting state's first focusable element
  (the Undo button after Confirm; the sheet body after Dismiss) and the live
  region announces the result including the **status word**.
- **Multi-match `RadioGroup`**: standard arrow-key behavior; "Confirm
  selection" is `disabled`/`aria-disabled` until a choice is made, with a
  visible + SR-announced reason ("Choose one option first.").
- **Undo** is a plain `<button>`; live region announces the reversion
  (`Match undone. Friday is marked Missed.`), focus moves to the now-visible
  `ActivityMatchCard`.
- Unlinked/bonus cards: `<section>` with a heading ("Extra activity") and
  plain text, no interactive controls.
- Status-chip changes (Missed → Achieved etc.) are announced **only** through
  the live region, not by re-announcing the chip.

### Semantics / roles / labels

- `<main>` wraps the calendar; `aria-busy="true"` while loading.
- Countdown block: `<h2>`/Display-role text; not a live region.
- Progress: `role="progressbar" aria-valuemin="1" aria-valuemax="18"
  aria-valuenow="9" aria-label="Plan progress, week 9 of 18"`.
- Week list: `<ol>` of weeks; day list inside a week: `<ol>` of days.
- Each day control's accessible name is self-sufficient and **always includes
  a status word for an elapsed/current day**: `"Friday, March 14. Today.
  Easy run, 4 miles. Missed."` / `"Tuesday, March 11. Intervals, 6 miles.
  Partial."` / `"Wednesday, March 12. Rest. Extra activity logged."` For a
  future day, no status word: `"Sunday, March 16. Long run, 14 miles."`
- Status icon, "Long" tag, "Today" pill are supplementary (`aria-hidden`).
- Race-week Sunday row: `"Sunday, May 11. Race day. Marathon, 26.2 miles."`
  Race block: `"Race day. Sunday, May 11. Marathon, 26.2 miles. 9 weeks to
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
  numbers are in `ui-toolkit.md`'s completion-status table (#53).
- Display countdown: ≥ 3:1 minimum.
- "Today" must not be **colour only**: accent border + "Today" text + weight.
- Status must not be **colour only**: icon + text label always.
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
| Compact pace-reference strip | `plan-setup-flow.md` §7.4 (#53) | Reused | Same helpers; this sheet is where the compact variant ships. |
| **Week block** | — | New | The product's core object; built on an accordion, internal layout custom. |
| **Race-day / milestone block** | — | New | Pinned dated milestone with countdown; additional to race week, not a substitute. |
| **`StatusBadge`** | completion-status decision (#53) | New | First render of the cross-cutting status system; one shared module for calendar, sheet, and (with a different value set) the Strava settings card. |
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

**TPM questions raised by this revision — spec follows the FR as written in
each case:**

1. **FR19 "Missed" on the current day.** The spec shows **Missed** on today
   (and on any elapsed day with an unconfirmed suggestion) because FR19 allows
   only four values and FR14 forbids applying an unconfirmed match. A runner
   opening the app at 07:00 sees "Missed" before they have run, or "Missed"
   next to a pending suggestion. If that is too harsh, the fix is an FR
   change (e.g. a fifth **Pending/Today** value, or "Missed" only after the
   day ends) — not a silent blank state. Awaiting a TPM decision.
2. **FR20 "short of it".** What threshold makes an activity "short" (any
   shortfall? <90% of `distanceMiles`?), and is "wrong type" judged by
   Strava sport type? The UI renders the computed result and reason; the rule
   needs an owner.
3. **FR21 vs FR22 overlap.** `strength` / `cross_training` days are both
   "freeform-described, no numeric target" (FR22, no Partial) and
   "strength/cross-training" (FR21, has Partial). §4.2i scores them as FR21.
   Confirm, or state that FR22 is reserved for a future day kind.
4. **After race day.** Plan archive/recap, and whether race-day's own status
   (a `run` day, so FR20 applies once elapsed) is shown. Race-day detail (C)
   currently has no chip or match UI.
5. **Notifications/reminders** — out of scope, would deep-link into this
   screen (the day-sheet deep link supports it).
6. **Dismissed-match review** — FR14 requires undo for a *confirmed* match
   only. This spec doesn't invent a "review dismissed matches" surface;
   revisit if runners dismiss by mistake.
7. **Backfill status UX** — the lightweight banner (§3) is placeholder-grade;
   `web-v1-requirements.md` flags "poll vs. push" as still open.
8. **Activity timezone vs. local calendar day** — which day an activity near
   midnight attaches to is still open from the sync exploration
   (`docs/planning/exploration-activity-sync.md`); it decides which day's
   status a late-evening run affects.
9. **Offline/PWA** — is offline plan viewing a v1 requirement? Not addressed.

**Resolved earlier, still resolved:** completed data comes from Strava
auto-sync + confirm (FR13/14); no manual mark-complete; one active plan
(FR23/24, switcher UI deferred to #32/#33); missed-workout copy stays neutral
and non-guilt.

---

## 9. Validate with users

Before committing further build:

- **Row-per-week vs. month grid.** Show both to 2–3 marathon runners.
- **Confirm/Dismiss friction vs. the old "mark complete."** Validate that
  suggested matches get confirmed quickly with real Strava data — and, given
  §8 #1, how people react to seeing **Missed** beside a pending suggestion
  or on today.
- **"Is this it?" copy and `ActivityMatchCard` layout** — enough information
  to confirm without opening Strava?
- **Pace-zone shorthand in the day-detail sheet** — does `3–4x1K @ TP` plus
  the `E/T/I/M` strip read clearly to the target runner, or do people need
  the letters spelled out?
- **Collapsing past weeks by default** — do runners want an at-a-glance
  adherence read?
- **Status chip legibility at compact desktop size** (`●Ach`/`◐Prt`/`✕Msd`/
  `☾Rest`) at real screen size.

After shipping:

- Whether people scroll to/tap the race block, or the countdown/race week is
  enough.
- Whether multiple weeks get expanded at once (validates `type=multiple`).
- How often "None of these" is picked (FR18) — a data-scientist signal on
  matching quality.
- How often Confirm is followed by Undo.

---

## 10. Toolkit rows to add to `docs/design/ui-toolkit.md` once PR #53 is merged

`ui-toolkit.md` is not touched by this PR. After #53 lands on `main` and `main`
is merged into this branch, add these (or land them with the first consumer
PR — #16/#17/#18/#20/#24). Sections named below are #53's; match its table
format.

**Components**

| Row | Value |
|---|---|
| `StatusBadge` | shadcn `Badge`, custom color + icon; **completion** values Achieved / Partial / Missed / Rest and a **connection** value set (Not connected / Connected / Reconnect needed) using the same four hues; one shared module. Compact variant for the desktop grid cell. |
| `AlertDialog` | shadcn `AlertDialog` — first adoption (Strava disconnect). Cancel default-focused, destructive confirm. |
| `Alert` warning (amber) variant | Needed for the reconnect-needed banner (4.1c) if not already present. |
| `ActivityMatchCard` | Custom (`Card` + 2 `Button`) — confirm-an-inference pattern; used on running and strength/cross-training days. |
| Unlinked/bonus-activity card | Custom (`Card` outline + outline `Badge`). |
| Week block, day row / desktop day cell, race-day block | Custom (Deliberately-custom list) — week container on `Accordion`. |
| Compact pace strip | Reuse of `PaceZoneTable` helpers (`lib/pace-zone-display.ts`), no new dependency. |
| `Accordion`, `Progress`, `Drawer` (Vaul), `Skeleton`, `RadioGroup` | Adopt if not already listed by #53 (`RadioGroup`, `Skeleton` are already used by plan-setup). |

**Lucide icons** (one set, per toolkit): `check-circle-2`, `circle-dot`,
`x-circle`, `moon`, `plus-circle`, `undo-2`, `link-2-off`, `alert-triangle`,
`external-link`, `flag`, `chevron-right`/`chevron-down`, `info`. Verify names
against the installed Lucide version (some have been renamed, e.g.
`check-circle-2` → `circle-check`).
