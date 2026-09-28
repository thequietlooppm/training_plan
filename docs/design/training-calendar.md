# Design spec — Training calendar + day detail (view, Strava match, completion status)

> Owned by `@designer`. Status: **ready for implementation** — scoped against
> issues #16/#17/#18 (calendar + day-detail) and #24 (Strava activity-match UI
> in the day-detail sheet), FR9–FR22 in `docs/planning/web-v1-requirements.md`.
> Companion docs: `docs/design/ui-toolkit.md` (color/type system — **Tempo** —
> and the completion-status color decision, both referenced throughout this
> doc rather than redefined here) and `docs/design/strava-connect-settings.md`
> (issue #20 — the connect/disconnect flow this screen assumes already
> exists). Old throwaway wireframe `docs/design/wireframes/
> training-calendar-marathon.html` is now stale against this revision (it was
> built against the pre-FR "mark complete/skip" flow below) — do not build
> from it; it predates this spec and isn't being regenerated in this pass
> (no HTML mockups this pass, see the brief).
>
> **Revision (2026-09-28) — full rewrite of the flow, not just a reskin.**
> The previous version of this doc (status: "early exploration," no FRs to
> build against yet) designed a manual binary **"Mark complete / Skip"**
> button in the day-detail sheet. That flow no longer matches the product:
> per FR13–FR14, activities sync **automatically** from Strava, and the
> runner's job is to **confirm or dismiss a suggested match**, not to
> hand-enter completion. Per FR19–FR22, completion status (Achieved / Partial
> / Missed / Rest) is **computed**, not toggled. This revision replaces §3
> (user flow) and §4.2 (day-detail wireframe) entirely, updates §2 with
> color/type references and two new reference categories (calendar apps,
> todo apps) requested for this pass, reconciles §5 against the Tempo system
> in `ui-toolkit.md`, and prunes §8's open-questions list down to what FR9–25
> genuinely left open. Untouched in spirit: §1's three at-a-glance questions,
> the week-is-the-unit / long-run-as-anchor layout, and the race-day
> milestone block — those calls hold up fine against the real requirements.

---

## 1. What this screen is

The home screen of the app: a runner opens it and sees their personalized
training plan laid out on real calendar dates, from today back to the plan
start and forward to race day. It answers three questions at a glance:

1. **What am I doing today?**
2. **What's the long run this week, and how big?**
3. **How many weeks until the race?**

**Scope for this pass:**
- View the personalized plan on real dates (FR9), including strength/
  cross-training days as scheduled entries with no computed pace/distance
  target (FR11).
- See each elapsed/current day's **computed** completion status — Achieved /
  Partial / Missed / Rest (FR19–FR22) — never manually toggled.
- Open a single day for detail: prescription, any Strava-matched
  activity/activities, and the status that follows from them.
- **Confirm or dismiss** a suggested Strava match (FR14), **undo** a
  confirmed match, and **pick one** from multiple plausible same-day matches
  (FR18, single-select, "none of these" always an option).
- See unscheduled or extra activities as **unlinked/bonus entries** — never
  dropped, never silently applied to a prescription (FR17).
- See race day as a milestone.

**Explicitly not in this pass, and why it's gone from the flow below:**
- **No manual "Mark complete" / "Skip" button.** That was this doc's own
  design in the pre-FR draft; it's superseded by FR13/FR14's auto-sync +
  confirm/dismiss model. A runner never hand-enters "I did this" — they
  confirm what Strava already saw, or the day sits Missed if nothing synced.
- Editing/moving workouts, generating the plan itself (#12/#13), pace zones
  as their own screen (they're referenced inline — see §5.3 — not
  redesigned here; that's `plan-setup-flow.md` §7/§7.4).
- Plan switching (#32/#33) and Google Calendar sync (#34–36) — both
  downstream of this screen, deferred by tpm, not designed here. This screen
  assumes **exactly one active plan** (FR24) and renders it; it doesn't
  render a plan-switcher UI.
- Strava connect/disconnect itself — that flow lives in
  `strava-connect-settings.md`; this doc only covers what the calendar and
  day-detail sheet look like once a connection state already exists (or
  doesn't).

### Assumptions carried forward from FR9–FR25

- A typical 16–20 week block, weekly structure, one long run per week.
- The plan already exists by the time this screen renders (its origin is
  #12/#13, out of scope here).
- Units, week-start day, and phase labels remain **open** — see §8; nothing
  in FR9–25 resolves them, so they're not invented here either.

---

## 2. Look and feel — references

Same "this is a longitudinal view, not a one-shot form" job as the prior
pass, plus two categories this revision adds on Patrick's request: **calendar
apps**, for dense dated-grid conventions, and **todo/checklist apps**, for
done/pending/skipped visual language — directly relevant now that status is
computed and rendered as a real state (Achieved/Partial/Missed/Rest), not a
hypothetical "mark complete" toggle.

### Layout references (kept from the prior pass — still hold up)

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **TrainingPeaks** (web/app, "Calendar") | The canonical dated marathon plan. Week is a horizontal unit with a **weekly summary** (planned vs. completed volume) pinned beside it. Planned workout shows as a faint outline, completed as a filled version of the same shape. | Week-as-a-unit layout; the planned-outline → completed-fill visual pairing (now paired with the Achieved/Partial/Missed/Rest chip, not a bare fill); per-week volume total (`18 / 32 mi`). | Coach-facing density; TSS/IF/CTL jargon; cramped desktop-first grid; sluggish, busy mobile view. |
| **Runna** (iOS/Android, marathon plans) | Purpose-built for exactly this. Lands on **"this week"**, plan is organised around one key long run, workouts have **plain-language names**, race day is a visual finish-line milestone with a countdown. | Default to the current week; plain-language workout titles; race day as a distinct milestone card with "N weeks to go". | Heavy paywall gating mid-flow; saturated gradient styling; over-coached daily tips and modals. |
| **Strava** (web, "Training Log" / mobile calendar) | Past vs. future reads instantly: completed runs are solid cards with a satisfying "done" state; each week has a small mileage bar. | The clear done/not-done contrast; a lightweight weekly volume indicator; the calm, content-first list density. | Social feed, kudos, comments; blending all activity types together; clutter around each entry. |
| **Notion Calendar** (formerly Cron) | Calendar craft: an unmistakable **today** marker, restrained type hierarchy, muted weekends, smooth keyboard movement between days/weeks. | The single high-contrast "today" treatment; muted rest/weekend cells; keyboard navigation between days. | The hour-grid time-blocking model — irrelevant to a once-a-day plan; dense multi-calendar overlays. |

### New for this pass — calendar-app density references

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **Google Calendar** (month/week grid) | Handles a genuinely dense grid of dated entries without feeling cluttered — each cell shows just enough (a colored dot or a one-line chip) to know something's there, full detail is one tap/click away. Week view especially keeps every day's content legible at a glance even when every day has an entry. | The "one compact chip per day, full detail on open" discipline — our day row (mobile) and day cell (desktop grid) show workout name + one number + status icon, nothing more, exactly this restraint. | The month-grid-as-default view — wrong unit for a training plan (see §1's "week is the unit," unchanged from the prior pass); also skip Google Calendar's multi-event-per-cell stacking, since this app has at most one prescription + a small number of matched/unlinked activities per day, not an arbitrary event count. |
| **Fantastical** | Its day/week view uses restrained, legible micro-typography for dense info (time, title, location) without needing color to do all the work — text hierarchy (weight, size) carries most of the scan-ability. | The type-hierarchy-over-color-density approach — directly informs why our day row leans on label + icon + weight, not a wash of background color, per day (color is reserved for the status chip specifically, not the whole row). | Fantastical's natural-language event entry and multi-calendar-set switcher — no equivalent need here (one plan, no free-text scheduling). |
| **Apple Calendar** | Today's date cell gets one unmistakable, consistent treatment (a filled circle around the date number) used identically everywhere in the OS — recognizable at a glance, never confused with anything else. | The "today" treatment's consistency and restraint — reinforces Notion Calendar's same principle above; today gets exactly one visual idiom, reused everywhere it appears (week list, desktop grid, "Today" jump pill). | Apple Calendar's dense multi-calendar color-coding (each calendar its own hue) — we have one plan, one accent; no need for a color-per-source system. |

### New for this pass — todo/checklist done-state references

Directly relevant now: FR19–22 make completion a **computed, rendered
state** (Achieved/Partial/Missed/Rest), which is much closer to a to-do
app's "done/pending/skipped" item states than to a blank calendar cell.

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **Things 3** | A completed item gets a small, solid, **muted** checkmark circle plus a subtle strikethrough/fade on the text — the color does almost no work; icon shape and text-muting carry the "done" meaning first. Skipped/someday items get a distinct, clearly-different muted treatment, never confused with "done." | The restraint principle, adopted directly into `ui-toolkit.md`'s completion-status decision: icon + label do the primary work, color is a supporting signal, never the only signal. Also borrow the **fade-not-delete** treatment for a Missed day — it stays fully legible (§6), just visually quieter than Achieved. | Things' strikethrough-on-title treatment specifically — we don't strike through a workout's name; the prescription is a historical record ("this was planned"), not a to-do to visually cross out. Use muting/weight instead (see §5.1). |
| **Todoist** | Done tasks go grey + a light checkmark, not green — proof that "done" doesn't require a saturated color to read clearly; the app leans on de-emphasis (fade) more than emphasis (bright color) for completed items. | The alternative case for a muted, low-saturation treatment — this is part of why Achieved's green (`ui-toolkit.md`) is deliberately muted rather than a bright, high-chroma green: Todoist proves the muted route reads fine, so there's no reason to reach for anything louder. | Todoist's priority-flag color dots (red/orange/blue by urgency) — different semantic (urgency vs. status), not needed here. |
| **Apple Reminders** | A completed reminder's checkbox fills solid and the row instantly, subtly recedes (lighter text) — the transition itself (unfilled circle → filled circle) is the clearest part, more than the color of the fill. | The unfilled-outline → filled-shape transition as the *primary* signal, color as a secondary reinforcement — matches TrainingPeaks' outline-to-fill pairing above; two references independently pointing at the same convention is a good sign it's the right one to build. | Reminders' list-organization chrome (Today/Scheduled/Flagged smart lists) — not relevant, we have exactly one list (the plan) organized by date, not by user-defined lists. |

### Direction (one paragraph)

The calendar **is** the home screen and opens on **this week**, never a
month grid — a marathon build is read longitudinally, week by week, with the
long run as each week's anchor. Borrowing TrainingPeaks' planned-outline →
completed-fill pairing (independently reinforced by Apple Reminders' same
unfilled→filled convention) and Strava's calm done/not-done contrast, each
elapsed day carries a small, **muted** status chip — icon + label + a color
kept deliberately restrained (Things/Todoist's lesson: color supports, it
doesn't shout) — while exactly one element per screen is visually loud:
**today**, using Notion Calendar's and Apple Calendar's identical, unmistakable
single-idiom "today" treatment. Numbers are the hero where they're genuinely
being compared — a week's per-day mileage, planned-vs-completed volume — set
in tabular figures (Tempo's Numeral role, `ui-toolkit.md`); the countdown
itself is a standalone hero stat, not a comparison column, so it's large
Figtree (Tempo's Display role), **not** mono — a correction from the prior
pass's over-general "numbers are the hero, set in tabular figures" language,
which read as license to mono the countdown too. Race day is a pinned
"finish line" block at the end of the scroll, always the visible target, with
a countdown lifted from Runna. Getting into a day's detail is one tap; a
suggested Strava match is confirmed or dismissed in one tap too — Google
Calendar's and Fantastical's "compact chip, full detail on open" discipline
keeps the dense multi-week list itself uncluttered.

### Principles

- **Calendar is the home screen. Open on this week.**
- One glance answers: today's session, this week's long run, weeks to go.
- The week is the unit; the long run is its anchor.
- Planned is quiet; an elapsed day's status (Achieved/Partial/Missed/Rest) is
  a small, muted icon+label+color chip, never a loud wash; **today is loud**
  — one thing pops per screen.
- Numbers are the hero **only where they're a comparison column** (weekly/
  per-day mileage); a standalone hero stat (the countdown) is large body
  type, not mono — see Tempo's Display vs. Numeral roles, `ui-toolkit.md`.
- Never rely on colour alone: status, today, rest, and long run each carry a
  text label, not just a hue.
- A suggested match is a **suggestion**, never silently applied (FR14) — the
  UI must make confirm/dismiss feel as fast as the old "mark complete" tap
  was, or auto-sync will feel like it added friction instead of removing it.
- Into a day's detail in one tap, back in one tap; confirming/dismissing a
  match is one tap from inside that sheet, no second screen.
- No coach jargon in v1 (no TSS/IF/zones) — plain-language workout names.

---

## 3. User flow

### Entry points

- App launch / root URL → **Training calendar** (this screen), rendering the
  runner's one active plan (FR24).
- Deep link to a specific week or day (e.g., a future notification) →
  calendar scrolled to that week, or the day sheet open.
- Returning from `strava-connect-settings.md` after connecting → calendar
  reflects the new connection state; if this was a mid-cycle join or a plan
  switch, a bounded backfill runs (FR16/FR25) — see the backfill note at the
  end of this section.

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
       (empty state)        │            │            │ tap race row
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

### Flow 1 — viewing a week (unchanged in spirit from the prior pass)

1. Screen opens on the current week (expanded); past weeks collapsed above,
   future weeks collapsed below.
2. Runner **scrolls** vertically through weeks. Trigger to see another
   week's detail: **tap its collapsed header** → expands (accordion); other
   weeks stay as the runner left them (multiple can be open).
3. When the current week scrolls out of view, a **"Today" pill** in the top
   bar remains; tapping it scrolls back and ensures the current week is
   expanded.
4. Exit: tap a day (→ Flow 2), scroll to race day (→ Flow 3), or leave the
   screen.

### Flow 2 — tapping a day, and everything that can be inside (rewritten this revision)

1. Trigger: **tap a day row**. Every day is interactive now (including Rest
   days — a Rest day can still carry an unlinked bonus activity, FR17, so
   it's no longer a dead row the way the pre-FR draft had it).
2. **B. Day detail** opens — bottom sheet on mobile/tablet, right-hand side
   panel on desktop (calendar stays visible).
3. Contents, always: weekday + date, the day's **prescription** (workout
   title + plain-language description + planned distance/duration, or
   "Rest," or the strength/cross-training entry with no numeric target per
   FR11), and — for an elapsed or current day only (FR19: future days show
   no status) — the computed **status chip** (Achieved/Partial/Missed/Rest,
   `ui-toolkit.md`'s completion-status system).
4. Contents, conditionally, depending on what Strava has (or hasn't) synced
   for that day — **exactly one** of the following renders in the activity
   section:
   - **a. No connection / nothing synced yet:** a quiet note, no card — see
     §4.2's "Strava not connected" and "nothing synced" states. If the day
     has elapsed with nothing logged, its status is **Missed** (or, for a
     Rest day, just **Rest** — nothing to log).
   - **b. One plausible match, unconfirmed (FR14):** an `ActivityMatchCard`
     — activity type, distance/duration, start time, and two buttons,
     **Confirm** and **Dismiss**. Trigger **Confirm** → the match applies,
     status recomputes (FR20–22's rules) and the card becomes read state
     (c) below, with an **Undo** action. Trigger **Dismiss** → the
     suggestion is cleared, status computes as if nothing had synced for
     that day (Missed, if elapsed and nothing else applies), and the
     activity is **not** deleted — see §4.2's dismissed-state note (FR14
     doesn't require re-offering a dismissed match, and this spec doesn't
     invent a "review dismissed matches" surface — flagged in §8 if that
     turns out to matter).
   - **c. A confirmed match:** the logged activity's real detail (type,
     distance, duration, pace) shown plainly against the Planned row, status
     chip reflects the computed result, and a secondary **Undo** action
     returns to state (b) — the match becomes unconfirmed again, it is
     **not** un-synced or deleted (FR14 — "runner can undo a confirmed
     match").
   - **d. Multiple plausible matches (FR18):** a single-select list (each
     candidate: activity type, distance, start time, one radio) plus a
     **"None of these"** option, and a **Confirm selection** button.
     Choosing one and confirming behaves exactly like (b)'s Confirm;
     choosing "None of these" behaves like (b)'s Dismiss, for all
     candidates at once.
5. **Unlinked/bonus entries (FR17)** render as their own read-only cards
   **below** the prescription/match section, whenever they exist: an
   unscheduled activity on a Rest day, or an extra activity on a day whose
   prescription is already matched/confirmed. Each shows type, distance/
   duration, start time, and an "Extra activity" outline chip
   (`ui-toolkit.md`) — no Confirm/Dismiss, nothing to do with it in this
   pass, just visible so it's never silently dropped.
6. In-sheet nav: **‹ / ›** step to the previous/next day without returning
   to the calendar. The calendar behind updates its scroll/expansion to
   match.
7. Every state change inside the sheet (confirm / dismiss / undo / pick from
   multi-match) triggers a polite live-region announcement (§6) and updates
   the corresponding day row in the calendar behind the sheet — no separate
   "save."
8. Exit: swipe down / tap scrim / press Esc / tap close → returns to A,
   focus back on the originating day row.

### Flow 3 — race day (unchanged from the prior pass)

1. Race day lives as a **pinned block at the very end** of the week list,
   after a `• • •` gap that stands in for the taper weeks. It's always the
   scroll target.
2. It shows: **Race day**, the date, "Marathon · 26.2 mi", and **"N weeks to
   go"** (→ "Race week" in the final week → "Race day is today" on the day).
3. Trigger: **tap the race block** → **C. Race day detail** — same sheet
   pattern as a workout, but content is the race (date, distance, countdown,
   a note that the week before is a taper). No status chip, no match UI —
   post-race recap is an open question (§8).

### Backfill note (FR16/FR25 — kept lightweight, not the focus of this pass)

Joining a plan after its start date, or switching plans, triggers a bounded
backfill of prescriptions and matched Strava activity for elapsed days (FR16/
FR25, ≤5 min per NFR4). While it's running, affected days simply render as if
nothing has synced yet (state 4a above) rather than a loading spinner per
day; a single dismissible `Alert` at the top of the calendar reads **"Filling
in your recent history — this can take a few minutes."** and disappears once
the backfill job completes (polled or pushed — that mechanism is a swe/
deploy-engineer call, not a design one). This is a small addition to keep the
"nothing looks broken mid-backfill" case covered, not a full backfill-status
spec — `docs/planning/web-v1-requirements.md`'s own open-questions list
flags the fuller "poll vs. push" UX as a separate decision if it turns out
this lightweight banner isn't enough.

---

## 4. Wireframes

ASCII only, per the brief for this pass (no HTML mockup). All states drawn.

### 4.1 Calendar — populated, mid-plan, this-week emphasis (mobile)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │  top bar: menu · title · jump-to-today pill · settings
├─────────────────────────────────────┤
│  9 weeks to race day                │  countdown — Display role (Figtree, NOT mono)
│  Week 9 of 18 · base + build        │  sub: position in plan
│  ▓▓▓▓▓▓▓▓░░░░░░░░                    │  plan progress bar (role=progressbar)
├─────────────────────────────────────┤
│ ▸  Week 8   Feb 24–Mar 2   28/28mi ✓│  COLLAPSED past week (all Achieved). tap header = expand
├─────────────────────────────────────┤
│ ▾  Week 9   Mar 3–Mar 9    18/32 mi │  EXPANDED current week. header is a button (aria-expanded)
│  ┌───────────────────────────────┐  │
│  │ Mon 3  Easy run    5 mi ●Achvd│  │  Achieved — green chip, check-circle-2 icon
│  │ Tue 4  Intervals    6 mi ◐Part│  │  Partial — amber chip, circle-dot icon
│  │ Wed 5  Rest             ☾Rest│  │  Rest — grey chip, moon icon, STILL a tap target (FR17 bonus)
│  │ Thu 6  Tempo        7 mi ●Achvd│  │  Achieved
│  │▎Fri 7  Easy · Today  4 mi   › │  │  TODAY — accent left border + "Today" label, no status yet
│  │ Sat 8  Rest                  │ │  Rest, no activity synced
│  │ Sun 9  Long run [LONG] 14 mi ›│  │  UPCOMING long run — "Long" tag, no status (future)
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ ▸  Week 10  Mar 10–Mar 16  34 mi    │  COLLAPSED future week — planned volume only, no status
├─────────────────────────────────────┤
│                • • •                │  stands in for weeks 11–17 (taper) — tap = expand range
│ ╔═════════════════════════════════╗ │
│ ║ [⚑]  RACE DAY                   ║ │  PINNED finish-line block, 2px border
│ ║      Sun, May 4 · Marathon 26.2 ║ │
│ ║      9 weeks to go            › ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

Interactive: menu, Today pill, settings, each week header (expand/collapse),
**every** day row including Rest (a Rest day can still hold a bonus activity,
FR17 — see §3 Flow 2 step 5), the race block. Only the progress bar is
non-interactive status.

### 4.1b "Not connected" banner state (renders above the countdown block when Strava isn't connected)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ ⓘ Connect Strava to see your  │   │  Alert, info variant, dismissible
│ │   completed workouts here      │   │  "Connect" → strava-connect-
│ │   automatically.  [ Connect ]  │   │  settings.md
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│  9 weeks to race day                │
│  …                                   │
```

Without a Strava connection, every elapsed day still computes a status —
it's just always **Missed** (running-prescribed/strength days) or **Rest**,
since nothing can sync. That's correct per FR19–22 (status is computed from
whatever data exists, and with no connection there's no logged activity
data) — not an error state, just an accurate reflection of "nothing's synced
because nothing's connected." The banner nudges toward fixing that without
blocking the view.

### 4.2 Day detail sheet — rewritten this revision

**4.2a — Running-prescribed day, no Strava data yet (elapsed, hasn't synced or day is in the future)**

```
┌─────────────────────────────────────┐
│               ────                   │  drag handle (mobile). [✕] close (44px) also present
│ ‹ Prev     Fri, Mar 7      Next ›    │  in-sheet day stepper. center = focus target on open
├─────────────────────────────────────┤
│  Easy run                            │  h2 (Tempo H2) — sheet's accessible name
│  Week 9 · recovery day               │
│                                      │
│  Keep it relaxed — you should be     │  short plain-language description
│  able to talk in full sentences the  │
│  whole way. Sits between yesterday's │
│  tempo and Sunday's long run.        │
│                                      │
│  Planned      4 mi · easy            │
│                                      │
│  ── future day: nothing below here — no status chip, no activity section ──
```

**4.2b — Elapsed day, Strava connected, nothing synced for this day**

```
│  Planned      4 mi · easy            │
│                                      │
│  Missed  ✕                           │  status chip (red, x-circle) — FR20: nothing logged
│  No activity logged for this day.    │  plain note, no card — there's nothing to confirm/dismiss
```

**4.2c — One plausible match, unconfirmed (FR14)**

```
│  Planned      4 mi · easy            │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ Is this it?                   │   │  ActivityMatchCard
│  │ Run · 4.1 mi · 34:12           │   │  activity type, distance, duration
│  │ Fri, Mar 7 · 6:42 AM            │   │  start time
│  │  ┌───────────┐ ┌─────────────┐ │   │
│  │  │  Confirm  │ │   Dismiss   │ │   │  primary / secondary buttons, ≥44px
│  │  └───────────┘ └─────────────┘ │   │
│  └───────────────────────────────┘   │
```

No status chip yet in this state — status is undetermined until the runner
confirms or dismisses (confirming computes Achieved/Partial per FR20;
dismissing computes Missed, same as 4.2b).

**4.2d — Confirmed match**

```
│  Planned      4 mi · easy            │
│  Logged       4.1 mi · 34:12 · Run   │  the actual synced activity, plain body text
│                                      │
│  Achieved  ✓                         │  status chip (green, check-circle-2)
│  ┌───────────────────────────────┐   │
│  │           Undo                │   │  secondary button — returns to 4.2c's unconfirmed state
│  └───────────────────────────────┘   │
```

**4.2e — Multiple plausible matches (FR18)**

```
│  Planned      4 mi · easy            │
│                                      │
│  Which one is this?                  │  h3, group legend
│  ○ Run · 4.0 mi · 33:50 · 6:41 AM    │  RadioGroupItem
│  ○ Run · 4.3 mi · 36:02 · 7:15 AM    │  RadioGroupItem
│  ○ None of these                     │  RadioGroupItem — always present, per FR18
│  ┌───────────────────────────────┐   │
│  │      Confirm selection        │   │  disabled until one option is chosen
│  └───────────────────────────────┘   │
```

Choosing a run + confirming behaves like 4.2c's Confirm; choosing "None of
these" + confirming behaves like 4.2c's Dismiss (status computes Missed, and
per §3's flow note, this spec doesn't add a "review dismissed" surface — the
runner can always re-open the day, but a dismissed/none-of-these choice isn't
re-offered automatically).

**4.2f — Rest day, no bonus activity**

```
│  Rest                                │  h2
│  Week 9                              │
│                                      │
│  Rest  ☾                             │  status chip (grey, moon) — always Rest, no computation
│  Nothing scheduled today.            │
```

**4.2g — Rest day WITH an unlinked bonus activity (FR17)**

```
│  Rest                                │
│  Week 9                              │
│                                      │
│  Rest  ☾                             │  status is still Rest — a bonus activity doesn't change it
│  Nothing scheduled today.            │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ ＋ Extra activity              │   │  outline chip, no fill
│  │ Run · 3.2 mi · 28:40           │   │  read-only — nothing to confirm/dismiss
│  │ Wed, Mar 5 · 5:30 PM            │   │
│  └───────────────────────────────┘   │
```

**4.2h — Strength/cross-training day (FR11 — no computed pace/distance target)**

```
│  Strength                            │  h2
│  Week 9 · lower body                 │
│                                      │
│  30–40 min. Focus on hips and        │  plain-language description; no distance/pace figure
│  glutes — no specific sets/reps      │  anywhere on this row, per FR11
│  prescribed yet.                     │
│                                      │
│  Achieved  ✓                         │  FR21: any non-running activity logged = Achieved
│  Logged      Weight training · 38 min│
```

(If a *running* activity synced on this day instead: FR21 → **Partial**, with
the same "Logged" row showing the run. If nothing synced: **Missed**, same
copy pattern as 4.2b.)

### 4.3 Empty / first-run (unchanged from the prior pass)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan            [⚙]   │
├─────────────────────────────────────┤
│                                      │
│            ┌─────────┐               │  simple line illustration (unDraw), decorative
│            │ calendar│               │
│            └─────────┘               │
│                                      │
│           No plan yet                │  h2
│                                      │
│    Add your race date and we'll     │  body — one sentence
│    lay out the training weeks       │
│    leading up to it.                │
│                                      │
│  ┌───────────────────────────────┐  │
│  │        Set up plan            │  │  single primary CTA → setup (OUT OF SCOPE stub)
│  └───────────────────────────────┘  │
│                                      │
└─────────────────────────────────────┘
```

### 4.4 Loading (unchanged)

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

### 4.5 Error (unchanged)

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
│  Week 8 · Feb 24–Mar 2                                        28 / 28 mi  ✓   │  week sub-header (sticky), Numeral role for the fraction
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 24 │Tue 25 │Wed 26 │Thu 27 │Fri 28   │Sat 1  │Sun 2  [LONG]│  wk 8   │  │
│  │Easy   │Hills  │Rest   │Tempo  │Easy     │Rest   │Long run     │  28 mi  │  │  ← weekly-summary rail
│  │5mi●Ach│6mi●Ach│ ☾Rest │6mi●Ach│4mi●Ach  │ ☾Rest │12mi●Achieved│ all Ach │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 9 · Mar 3–Mar 9                                         18 / 32 mi      │
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 3  │Tue 4  │Wed 5  │Thu 6  │▏Fri 7   │Sat 8  │Sun 9  [LONG]│  wk 9   │  │
│  │Easy   │Interv │Rest   │Tempo  │▏Today   │Rest   │Long run     │  32 mi  │  │
│  │5mi●Ach│6mi◐Prt│ ☾Rest │7mi●Ach│▏Easy 4mi│ ☾Rest │14 mi        │ 18 done │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 10 · Mar 10–Mar 16                                      34 mi planned   │
│  ...                                                                          │
│                                   • • •                                       │
│  ╔════════════════════════════════════════════════════════════════════════╗   │
│  ║ [⚑]  RACE DAY · Week 18     Sun, May 4 · Marathon 26.2 mi · taper wk   ║   │
│  ╚════════════════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────────────────┘
     Day detail opens as a right-hand SIDE PANEL — calendar stays visible.
```

Per-day mileage figures (`5mi`, `6mi`, …) and the weekly `28/28 mi` fraction
are set in the Numeral role (tabular IBM Plex Mono) — these are genuinely a
column of numbers compared against each other. Status abbreviations
(`●Ach`/`◐Prt`/`☾Rest`) are compact renderings of the same status chip used
in the mobile row and the day-detail sheet — same icon, same color, same
label semantics, abbreviated for the narrower column, never color-only (the
abbreviated text label is still present, not dropped for space).

---

## 5. Interface detail

### 5.1 Layout & spacing intent

- **Vertical rhythm.** Week blocks separated by a hairline rule
  (`border/subtle`, `ui-toolkit.md`). Inside a week, day rows separated by
  lighter hairlines. Generous row height on mobile (~52–56px) so each day is
  a comfortable tap target.
- **Number alignment.** Only genuine comparison columns — per-day mileage,
  weekly planned/completed fractions — use the Numeral role (tabular IBM
  Plex Mono), right-aligned. The countdown is Display-role Figtree, not mono
  — see §2's correction.
- **Hierarchy.** Countdown is the largest text on the screen (Display role).
  Week numbers and volumes next (H2/Numeral). Workout names are Body.
  Dates, "Rest," and metadata are Body-sm/`text/secondary` — muted but never
  below 4.5:1 (§6).
- **Status chip.** Small, muted, icon + label + color (`ui-toolkit.md`'s
  completion-status system) — never a full-row color wash. This is the
  Things/Todoist-informed restraint from §2: the chip is a supporting
  signal next to the workout name, not the loudest thing in the row.
- **One accent, spent on today.** `accent/solid` (Tempo) is spent only on
  the **today** indicator (left border + "Today" label) in this screen —
  status colors are their own palette (green/amber/red/grey), deliberately
  not the accent, so "today" stays the one unambiguous accent-colored thing
  per screen, matching the plan-setup screen's "one accent, one job" rule.
- **Race block.** Heavier border (2px) than anything else, sitting slightly
  inset, so it reads as a destination.

### 5.2 Component mapping

Stack is decided (ADR 0002: React + Vite, Tailwind, shadcn/ui, Lucide) — no
"if React" framing needed (the prior pass framed this table by framework
because the stack wasn't locked yet; it is now, matching `ui-toolkit.md` and
`plan-setup-flow.md`'s already-updated convention).

| Element | shadcn/ui primitive | Notes |
|---|---|---|
| Top bar | plain markup | Custom, trivial. |
| "Today" pill / buttons | `Button` | Standard. |
| Settings / menu icon buttons | `Button` icon variant | 44px target. |
| Not-connected banner | `Alert` (info variant) + `Button` | Links to `strava-connect-settings.md`. Dismissible — dismissal is session-local, reappears next visit while still disconnected (don't persist a permanent dismiss without a real "don't ask again" setting, which isn't in scope). |
| Backfill-in-progress banner | `Alert` (info variant) | See §3's backfill note. |
| Plan progress bar | `Progress` | `role=progressbar`, `aria-valuenow/min/max`, plus visible "Week 9 of 18". |
| Week block (collapsible) | `Accordion`, `type="multiple"` | **Container is library; the day-row/grid layout inside is custom** (product-distinct, see `ui-toolkit.md`'s "Deliberately custom"). |
| Day row / day cell | **custom** | Core object. `<button>` per day (every day is now interactive, including Rest — FR17's bonus-activity case). |
| `StatusBadge` (Achieved/Partial/Missed/Rest chip) | `Badge` (custom color/icon per `ui-toolkit.md`) | **New adoption**, shared module — see `ui-toolkit.md`'s "Deliberately custom." Same component renders in the day row, the desktop grid cell (compact variant), and the day-detail sheet. |
| "Long" tag, "Today" label | **custom** (span) | Text badges; never colour-only. |
| Day detail — mobile sheet | `Drawer` (Vaul) or `Dialog` styled as sheet | Focus trap, Esc to close, focus return. |
| Day detail — desktop side panel | `Dialog` with side styling, or a plain aside toggled in layout | Non-modal on desktop is acceptable (calendar stays usable); if non-modal, don't trap focus, do move focus in. |
| In-sheet prev/next day | `Button` icon | Labels "Previous day" / "Next day". |
| `ActivityMatchCard` (suggested match, Confirm/Dismiss) | `Card` + `Button` × 2 | **New, custom** — see `ui-toolkit.md`. First-of-its-kind "confirm an inference" pattern in this repo. |
| Multi-match single-select (FR18) | `RadioGroup` + `RadioGroupItem`, "None of these" as a normal item in the group | **New use** of the primitive already adopted on plan-setup — no new dependency. |
| Confirmed-match "Undo" | `Button` (secondary/outline variant) | Plain button, not a toggle — undoing returns to the unconfirmed `ActivityMatchCard` state, it isn't a pressed/unpressed pair the way the old "Mark complete" toggle was. |
| Unlinked/bonus-activity card | `Card` (outline) + outline `Badge` ("Extra activity") | **New, custom** — read-only, no actions. |
| Confirmation / status-change announcement | inline `aria-live="polite"` region (no toast) | Matches the plan-setup spec's "inline is enough for v1" call. |
| Race-day block / race detail | **custom** block, reuse the sheet pattern | No library primitive for a milestone. |
| Empty-state illustration | `<img>` from unDraw | Decorative, `alt=""`. |
| Skeleton | `Skeleton` | Mirrors layout. |
| Icons | **Lucide** | See `ui-toolkit.md`'s icon list for the full calendar/day-detail glyph set (added this revision: `circle-dot`, `x-circle`, `plus-circle`, `undo-2`, `link`/`link-2-off`). |

### 5.3 Copy

| Context | Text |
|---|---|
| Screen title | `Marathon plan` |
| Countdown, normal | `9 weeks to race day` |
| Countdown, < 2 weeks | `6 days to race day` |
| Countdown, final week | `Race week` |
| Countdown, race day | `Race day is today` |
| Plan position sub-line | `Week 9 of 18 · base + build` (phase label is still an open question — §8) |
| Jump-to-today control | `Today` |
| Week header | `Week 9` · `Mar 3 – Mar 9` |
| Weekly volume, before activity | `32 mi planned` |
| Weekly volume, in progress | `18 / 32 mi` |
| Weekly volume, week complete | `28 / 28 mi` + check |
| Not-connected banner | `Connect Strava to see your completed workouts here automatically.` + button `Connect` |
| Backfill banner | `Filling in your recent history — this can take a few minutes.` |
| Rest day | `Rest` |
| Long-run tag | `Long` |
| Today label (on the row) | `Today` |
| Status chip labels | `Achieved` · `Partial` · `Missed` · `Rest` (verbatim, `ui-toolkit.md`) |
| Unlinked/bonus chip | `Extra activity` |
| Collapsed taper gap | `• • •` (tap: `Show weeks 11–17`) |
| Race block title | `Race day` |
| Race block detail line | `Sun, May 4 · Marathon 26.2 mi` |
| Race block countdown | `9 weeks to go` → `Race week` → `Race day is today` |
| Day detail — planned row | `Planned` → e.g. `4 mi · easy` |
| Day detail — logged row | `Logged` → e.g. `4.1 mi · 34:12 · Run` |
| Day detail — no activity | `No activity logged for this day.` |
| Suggested-match card heading | `Is this it?` |
| Suggested-match Confirm | `Confirm` |
| Suggested-match Dismiss | `Dismiss` |
| Confirmed-match Undo | `Undo` |
| Multi-match heading | `Which one is this?` |
| Multi-match "none" option | `None of these` |
| Multi-match confirm button | `Confirm selection` |
| Live-region: match confirmed | `Friday's easy run matched to a 4.1 mile run. Marked Achieved.` |
| Live-region: match dismissed | `Match dismissed. Friday is marked Missed.` |
| Live-region: match undone | `Match undone. Friday's status is no longer confirmed.` |
| Empty title | `No plan yet` |
| Empty body | `Add your race date and we'll lay out the training weeks leading up to it.` |
| Empty CTA | `Set up plan` |
| Error title | `Couldn't load your plan` |
| Error body | `Check your connection and try again.` |
| Error retry | `Try again` |
| Loading (SR only) | `Loading your plan` |

Tone: plain, second person, no exclamation marks. No coaching jargon. The
old "Nice. Long run Sunday." post-completion nudge from the prior draft is
**dropped** — it was written for a manual "mark complete" moment that no
longer exists; a confirmed match is a quieter, more matter-of-fact event
(the runner didn't just perform an action *for* the app, they confirmed
something the app already knew), so the live-region copy above states the
fact plainly rather than congratulating.

### 5.4 Responsive behaviour

| Breakpoint | Layout |
|---|---|
| **Mobile < 640px** | Single column. Each week = vertical list of 7 day rows. Current week auto-expanded; past & future weeks collapsed to a one-line summary (accordion, `type=multiple`). Day detail = **bottom sheet** (full-width, ~90% height max, drag-to-dismiss + close button). Race block full-width above the fold of the scroll end. |
| **Tablet 640–1024px** | Same vertical rhythm, wider rows, more breathing room. Collapsed week summaries can show a touch more (e.g. long-run distance). Day detail = **centered modal dialog** (or right sheet). |
| **Desktop ≥ 1024px** | Week = **7-column grid row** + sticky weekly-summary rail on the right. Weeks not collapsed by default; whole plan scrolls. Week sub-header sticks while its week is in view. Day detail = **right-hand side panel** (~380–420px), calendar stays visible and usable. Max content width ~1180px, centered. |

Content never depends on hover: everything works on tap/click. Chevrons and
affordances are always visible, not hover-revealed.

---

## 6. Accessibility

Targets: **WCAG 2.2 AA**.

### Keyboard path & focus order (mobile, populated)

1. Skip link (`Skip to this week`) — first focusable, visually hidden until
   focused; jumps focus to the current week's header.
2. Menu button
3. Not-connected / backfill banner (if present) — its `Connect`/dismiss
   control, if shown, is a real tab stop here.
4. Title (not focusable — it's an `<h1>`)
5. "Today" pill button
6. Settings button
7. Progress bar — not focusable (status; "Week 9 of 18" text carries it)
8. Week 8 header — `<button aria-expanded="false" aria-controls="week-8-days">`
9. (if expanded) every day in Week 8, DOM order Mon→Sun — **including Rest
   days now** (they may hold a bonus activity, FR17; a Rest day with nothing
   extra is still reachable and simply shows the plain Rest state, §4.2f).
10. Week 9 header (`aria-expanded="true"`) … same pattern for every week …
11. "Show weeks 11–17" toggle
12. Race-day block — `<button>` / `<a>`

**Enhancement (not required for v1):** roving `tabindex` + arrow keys
between day cells within a week, mirroring Notion Calendar (§2). Tab must
still reach every day regardless.

### Day detail sheet

- On open: focus moves to the sheet. Mobile (modal): focus trapped,
  background `inert`/`aria-hidden`, **Esc** closes, focus returns to the day
  row that opened it. Desktop side panel (non-modal): focus moves in,
  **not** trapped, Esc still closes.
- Sheet has `role="dialog"`, `aria-modal="true"` on mobile, `aria-labelledby`
  pointing at the workout title `<h2>`.
- Prev/next buttons: `aria-label="Previous day"` / `"Next day"`; day change
  announced via `aria-live="polite"` ("Now showing Thursday, March 6").
- **`ActivityMatchCard`'s Confirm/Dismiss** are plain `<button>`s (not
  toggles) inside the card; on activation, focus stays in the sheet (moves
  to the resulting state's first focusable element — the Undo button after
  Confirm, or nothing/back to sheet body after Dismiss) and the live region
  announces the result (§5.3's copy).
- **Multi-match `RadioGroup`**: standard roving-tabindex/arrow-key behavior;
  "Confirm selection" is `disabled` (and `aria-disabled`) until a choice is
  made, with a visible + SR-announced reason if someone tries anyway
  ("Choose one option first.").
- **Undo** is a plain `<button>`; on activation, live region announces the
  reversion, focus stays on (or moves to) the now-visible `ActivityMatchCard`.
- Unlinked/bonus-activity cards have no interactive controls — they're a
  `<section>` with a heading ("Extra activity") and plain text content, not
  a tab stop beyond that.

### Semantics / roles / labels

- `<main>` wraps the calendar; `aria-busy="true"` while loading.
- Countdown block: `<h2>`/Display-role text + supporting text; not a live
  region (doesn't change while viewing).
- Progress: `role="progressbar" aria-valuemin="1" aria-valuemax="18"
  aria-valuenow="9" aria-label="Plan progress, week 9 of 18"`.
- Week list: `<ol>` of weeks; each week `<li>`. Day list inside a week:
  `<ol>` of days.
- Each day control's accessible name is composed and self-sufficient, and
  now includes status: `"Friday, March 7. Today. Easy run, 4 miles. Status
  not yet available."` / `"Tuesday, March 4. Intervals, 6 miles. Partial."` /
  `"Wednesday, March 5. Rest. Extra activity logged."` — the status word is
  always spoken, never implied by icon/color alone.
- The status icon, "Long" tag, and "Today" pill are supplementary — the
  accessible name already carries the meaning; icons get
  `aria-hidden="true"`.
- Race block accessible name: `"Race day. Sunday, May 4. Marathon, 26.2
  miles. 9 weeks to go."`
- `ActivityMatchCard`: `role="group"` with an `aria-label` summarizing the
  candidate ("Possible match: run, 4.1 miles, 34 minutes, Friday 6:42 AM"),
  so a screen-reader user hears the full candidate before reaching
  Confirm/Dismiss.

### Contrast

- Body text, workout names: ≥ 4.5:1 (Tempo `text/primary` on `surface/card`/
  `surface/page`, both modes — verified in `ui-toolkit.md`).
- Muted metadata ("Rest," dates, `text/secondary`): ≥ 4.5:1, both modes —
  verified (~7.6:1 light, ~7.1:1 dark, `ui-toolkit.md`).
- Status chip text/icon: ≥ 4.5:1 in every case, both modes — the full
  per-status numbers (4.8:1–10.3:1 across the four statuses and two modes)
  are in `ui-toolkit.md`'s completion-status table; nothing here is a
  fresh risk, it's inherited from that already-verified set.
- Large countdown number (Display role): ≥ 3:1 minimum, same text color as
  body so it's actually well above that in practice.
- "Today" indication must not be **colour only**: accent border + visible
  "Today" text + heavier weight.
- Status must not be **colour only**: icon shape + text label always
  accompany the color, per §2/§5.1.
- Focus ring: visible, ≥ 3:1 against adjacent colours, not removed.

### Touch targets

- Day row: full row width, **≥ 44 × 44 CSS px** (mobile row height
  ~52–56px) — including Rest rows now that they're interactive.
- Week header (tap to expand): ≥ 44px tall, full width.
- Icon buttons (menu, settings, Today pill, prev/next, close): ≥ 44 × 44px.
- `ActivityMatchCard`'s Confirm/Dismiss, the Undo button, and "Confirm
  selection": ≥ 44 × 44px, same bar as any other primary/secondary button.
- `RadioGroupItem` rows in the multi-match list: ≥ 44px tall, full width
  tap target (not just the radio dot).

### Motion

- Respect `prefers-reduced-motion`: no sheet slide (fade/instant instead),
  no status-chip transition animation, no accordion height easing.

---

## 7. New vs. reused patterns

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Collapsible section | library accordion | Reused (standard) | — |
| Bottom sheet / side panel for detail | library dialog/drawer | Reused (standard) | — |
| Skeleton loading, error-with-retry, empty-with-single-CTA | `HomePage.tsx` / `plan-setup-flow.md` | Reused (standard) | House state patterns, applied identically here. |
| **Week block** (collapsible header + day rows / 7-col grid + volume summary) | — | New | The product's core object. No generic component expresses "a training week with a long-run anchor and computed per-day status." Built on an accordion primitive; internal layout is custom. |
| **Race-day / milestone block** | — | New | A pinned dated milestone with a countdown. Nothing standard covers it. |
| **`StatusBadge`** (Achieved/Partial/Missed/Rest) | `ui-toolkit.md`'s completion-status decision | New | First render of the cross-cutting status system defined once in `ui-toolkit.md` — this doc and the day-detail sheet are its first two consumers, sharing one component/module so they can't drift. |
| **`ActivityMatchCard`** (suggest → confirm/dismiss → undo) | — | New | First "the system inferred something, confirm or reject it, and you can change your mind later" pattern in this repo — the direct replacement for the old manual mark-complete/skip flow. Worth reusing verbatim if a similar inferred-match UI shows up elsewhere (e.g. a future Google-Calendar-sync conflict, FR26). |
| Multi-select-of-one list with a "none of these" escape hatch | `RadioGroup` (already adopted, plan-setup) | New use, same primitive | FR18's exact requirement; no new dependency. |
| Unlinked/bonus-activity read-only card | — | New | FR17's "never dropped, never auto-applied" requirement has no existing UI vocabulary to reuse; simple, low-effort custom card. |

---

## 8. Open questions (product decisions — not for the designer to invent)

Routed to `@tpm` / `@tech-lead`. FR9–FR25 resolved most of the prior draft's
open list — what's left, pruned to what's genuinely still undecided:

1. **Units** — miles vs. km. Per-user setting? Inferred from locale? Not
   addressed by any FR.
2. **Week start** — Monday (assumed) vs. Sunday. Setting? Not addressed.
3. **Phase labels** ("base," "build," "peak," "taper") — do we show them,
   and who defines the boundaries? Not addressed by FR9–25; this spec keeps
   the sub-line copy (`Week 9 of 18 · base + build`) but the phase-label
   source is still open.
4. **Taper/race-week visual treatment** beyond the label and the `• • •`
   collapse — not addressed.
5. **After race day** — does the plan archive, show a recap, roll into
   recovery? FR23 covers abandoning/switching a plan generally but not a
   specific post-race moment.
6. **Notifications/reminders** — out of scope for this screen, but they'd
   deep-link back into it; the day-sheet deep link is designed to support
   that already.
7. **Offline/PWA** — is viewing the plan offline a v1 requirement? Not
   addressed.
8. **Dismissed-match review** — FR14 requires undo for a *confirmed* match,
   but says nothing about re-surfacing a *dismissed* suggestion later if the
   runner changes their mind without a new sync event. This spec doesn't
   invent a "review dismissed matches" list (§3, Flow 2 step 4b) — flag back
   if real usage shows people dismissing by mistake and wanting it back.
9. **Backfill status UX** — this spec's lightweight banner (§3) is a
   placeholder-grade answer, not the full "poll vs. push" decision
   `web-v1-requirements.md` itself flags as still open.

**Resolved since the prior draft, no longer open:** "where does completed
data come from" (FR13/FR14 — Strava auto-sync + confirm), "is there a manual
mark-complete" (no — removed, FR14), "multiple plans at once" (FR23/24 — one
active plan, prior plans preserved read-only, switcher UI itself deferred by
tpm to #32/#33), "missed-workout messaging" (FR19–22 define Missed
explicitly; this spec's copy for it — §5.3 — stays neutral/non-guilt, per the
prior draft's own recommendation, now backed by an actual FR rather than a
hunch).

---

## 9. Validate with users

Before committing further build beyond what's already scoped:

- **Row-per-week vs. month grid.** Put both in front of 2–3 marathon
  runners. Hypothesis: runners think in weeks and long runs, not calendar
  months. Confirm.
- **Confirm/Dismiss friction vs. the old "mark complete."** The whole point
  of FR13/14 is removing manual entry — validate that a suggested match
  actually gets confirmed quickly (not left hanging, not dismissed out of
  confusion about what it is) with a few runners' real Strava data.
- **"Is this it?" copy and the `ActivityMatchCard` layout** — confirm the
  card gives enough information (type, distance, duration, time) to confirm
  confidently without opening Strava itself to double-check.
- **Collapsing past weeks by default** — do runners want to see how the plan
  has gone so far (an at-a-glance adherence read, now genuinely meaningful
  since status is real data, not a placeholder), or is forward-looking
  enough?
- **Status chip legibility at the compact desktop-grid size** (§4.6's
  abbreviated `●Ach`/`◐Prt`/`☾Rest` rendering) — confirm the abbreviation
  doesn't undercut the "never color alone" principle in practice, at real
  screen size, not just in this ASCII mock.

After shipping:

- Watch whether people ever scroll to/tap the race block, or if the
  countdown alone is enough.
- Whether multiple weeks get expanded at once (validates `type=multiple`
  accordion) or people keep it to one.
- How often "None of these" gets picked in the multi-match list (FR18) — a
  high rate might mean the matching heuristic itself needs tuning, a
  data-scientist question, not a design one, but worth flagging back if the
  UI surfaces it clearly.
