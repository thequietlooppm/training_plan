# Design spec — Training calendar (marathon)

> Owned by `@designer`. Status: **early exploration**, no GitHub issue yet, no
> product brief. This is a v1 sketch to help the project owner picture the core
> screen. Product decisions are flagged as **open questions**, not invented.
> Companion wireframe: `docs/design/wireframes/training-calendar-marathon.html`
> (throwaway greyscale mockup — not a source of truth).

---

## 1. What this screen is

The home screen of the app: a runner opens it and sees their marathon training
plan laid out across the ~16–18 weeks before race day. It answers three
questions at a glance:

1. **What am I doing today?**
2. **What's the long run this week, and how big?**
3. **How many weeks until the race?**

Scope for this pass: **view** the plan, **open a single day** for detail, **mark a
workout complete/skipped**, and see **race day**. Not in this pass: generating the
plan, editing/moving workouts, pace zones, syncing from a watch, charts, history.

### Assumptions (from the task brief)

- Web app first, mobile-first responsive. Native later, same backend.
- A typical 16–18 week block, weekly structure, exactly **one long run per week**
  (Sunday in the mock).
- The plan already exists by the time this screen renders (its origin is an open
  question).
- Units shown as miles in the mock; km is a settings/open question.
- Week starts **Monday** (open question — make it a setting later).

---

## 2. Look and feel — references

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **TrainingPeaks** (web/app, "Calendar") | The canonical dated marathon plan. Week is a horizontal unit with a **weekly summary** (planned vs completed volume) pinned beside it. Planned workout shows as a faint outline, completed as a filled version of the same shape. | Week-as-a-unit layout; the planned-outline → completed-fill visual pairing; per-week volume total (`18 / 32 mi`). | Coach-facing density; TSS/IF/CTL jargon; cramped desktop-first grid; sluggish, busy mobile view. |
| **Runna** (iOS/Android, marathon plans) | Purpose-built for exactly this. Lands on **"this week"**, plan is organised around one key long run, workouts have **plain-language names** ("Easy 5 mi", "Long run 16 mi"), race day is a visual finish-line milestone with a countdown. | Default to the current week; plain-language workout titles; race day as a distinct milestone card with "N weeks to go". | Heavy paywall gating mid-flow; saturated gradient styling; over-coached daily tips and modals. |
| **Strava** (web, "Training Log" / mobile calendar) | Past vs future reads instantly: completed runs are solid cards with a satisfying "done" state; each week has a small mileage bar. | The clear done/not-done contrast; a lightweight weekly volume indicator; the calm, content-first list density. | Social feed, kudos, comments; the way it blends all activity types together; clutter around each entry. |
| **Notion Calendar** (formerly Cron) | Calendar craft: an unmistakable **today** marker, restrained type hierarchy, muted weekends, smooth keyboard movement between days/weeks. | The single high-contrast "today" treatment; muted rest/weekend cells; keyboard navigation between days. | The hour-grid time-blocking model — irrelevant to a once-a-day plan; dense multi-calendar overlays. |

### Direction (one paragraph)

The calendar **is** the home screen and it opens on **this week**, never a
month grid — a marathon build is read longitudinally, week by week, with the long
run as each week's anchor, so the layout is a vertical stack of week blocks
(row-per-week list on mobile, a 7-column row per week on desktop) with a
weekly-volume summary attached to each. Borrowing TrainingPeaks' planned-outline →
completed-fill pairing and Strava's calm done/not-done contrast, **planned
workouts are quiet text, completed workouts are filled with a check, and exactly
one element per screen is loud: today.** Numbers are the hero — mileage, week
number, weeks-to-race — set in tabular figures; navigation and headers recede to
grey. Race day is a pinned "finish line" block at the end of the scroll, always
the visible target, with a countdown lifted from Runna. Getting into a day's
detail is one tap; getting back is one tap.

### Principles

- **Calendar is the home screen. Open on this week.**
- One glance answers: today's session, this week's long run, weeks to go.
- The week is the unit; the long run is its anchor.
- Planned is quiet, done is solid, **today is loud** — one thing pops per screen.
- Numbers are the hero; chrome recedes to grey.
- Into a day's detail in one tap, back in one tap.
- No coach jargon in v1 (no TSS/IF/zones) — plain-language workout names.
- Never rely on colour alone: today, done, rest, and long run each carry a text label.

---

## 3. User flow

### Entry points

- App launch / root URL → **Training calendar** (this screen).
- Deep link to a specific week or day (e.g. from a future notification) → calendar
  scrolled to that week, or the day sheet open.

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
       (empty state)        │            │ (not rest) │ tap race row
                            ▼            ▼            ▼
                 ┌──────────────┐  ┌──────────┐  ┌──────────────┐
                 │ Plan setup   │  │ B. Day   │  │ C. Race day  │
                 │ (OUT OF      │  │  detail  │  │  detail      │
                 │  SCOPE stub) │  │  sheet   │  │  sheet       │
                 └──────────────┘  └──────────┘  └──────────────┘
                        │             │   │            │
              on finish │   mark      │   │ prev/next  │ close
              returns   │   complete  │   │ day        │
              to A      │   /skip     │   │ (in sheet) │
              populated │   updates A │   │            │
                        ▼             ▼   ▼            ▼
                     A (populated, day now filled / returns to A)
```

### Flow 1 — viewing a week

1. Screen opens on the current week (expanded); past weeks collapsed above,
   future weeks collapsed below.
2. Runner **scrolls** vertically through weeks. Trigger to see another week's
   detail: **tap its collapsed header** → it expands (accordion); other weeks stay
   as the user left them (multiple can be open).
3. When the current week scrolls out of view, a **"Today" pill** in the top bar
   remains; tapping it scrolls back and ensures the current week is expanded.
4. Exit: tap a day (→ Flow 2), scroll to race day (→ Flow 3), or leave the screen.

### Flow 2 — tapping a day to see detail

1. Trigger: **tap a day row** that has a workout (rest days are not interactive).
2. **B. Day detail** opens — bottom sheet on mobile/tablet, right-hand side panel
   on desktop (calendar stays visible).
3. Contents: weekday + date, workout title, one-line "what / effort", a short
   plain-language description, `Planned` and `Completed` rows, primary button
   **Mark complete**, secondary **Edit** · **Skip**.
4. In-sheet nav: **‹ / ›** step to the previous / next day without returning to the
   calendar. The calendar behind updates its scroll/expansion to match.
5. Trigger **Mark complete** → button becomes **"Completed — tap to undo"**
   (`aria-pressed`), `Completed` row fills with actual distance (placeholder:
   copied from planned in v1 — see open questions), a polite live-region message
   confirms ("Friday's easy run marked complete"). The day row in the calendar
   gains the filled/checked treatment.
6. Trigger **Skip** → `Completed` row shows "Skipped", calendar row shows a muted
   "Skipped" label. Reversible via the same control.
7. Exit: swipe down / tap scrim / press Esc / tap close → returns to A, focus back
   on the originating day row.

### Flow 3 — race day

1. Race day lives as a **pinned block at the very end** of the week list, after a
   `• • •` gap that stands in for the taper weeks. It's always the scroll target.
2. It shows: **Race day**, the date, "Marathon · 26.2 mi", and **"N weeks to
   go"** (→ "Race week" in the final week → "Race day is today" on the day).
3. Trigger: **tap the race block** → **C. Race day detail** — same sheet pattern
   as a workout, but content is the race (date, distance, countdown, a note that
   the week before is a taper). No "Mark complete" in this pass; a post-race recap
   is an open question.

---

## 4. Wireframes

ASCII below; richer greyscale layout in
`docs/design/wireframes/training-calendar-marathon.html`. All states are drawn.

### 4.1 Calendar — populated, mid-plan, this-week emphasis (mobile)

```
┌─────────────────────────────────────┐
│ [≡]  Marathon plan      (Today) [⚙] │  top bar: menu · title · jump-to-today pill · settings
├─────────────────────────────────────┤
│  9 weeks to race day                │  countdown — hero number (tabular)
│  Week 9 of 18 · base + build        │  sub: position in plan
│  ▓▓▓▓▓▓▓▓░░░░░░░░                    │  plan progress bar (role=progressbar)
├─────────────────────────────────────┤
│ ▸  Week 8   Feb 24–Mar 2   28/28mi ✓│  COLLAPSED past week (done). tap header = expand
├─────────────────────────────────────┤
│ ▾  Week 9   Mar 3–Mar 9    18/32 mi │  EXPANDED current week. header is a button (aria-expanded)
│  ┌───────────────────────────────┐  │
│  │ Mon 3   Easy run        5 mi ✓│  │  DONE — filled bg, check, name greyed
│  │ Tue 4   Intervals 6×800 6 mi ✓│  │  DONE
│  │ Wed 5   Rest            —     │  │  REST — muted, NOT interactive, not a tab stop
│  │ Thu 6   Tempo           7 mi ✓│  │  DONE
│  │▎Fri 7   Easy run · Today 4 mi ›│ │  TODAY — accent left border + "Today" text label
│  │ Sat 8   Rest            —     │  │  REST
│  │ Sun 9   Long run [LONG]14 mi ›│  │  UPCOMING long run — "Long" tag, chevron, biggest number
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ ▸  Week 10  Mar 10–Mar 16  34 mi    │  COLLAPSED future week — planned volume only
├─────────────────────────────────────┤
│                • • •                │  stands in for weeks 11–17 (taper) — tap = expand range
│ ╔═════════════════════════════════╗ │
│ ║ [⚑]  RACE DAY                   ║ │  PINNED finish-line block, 2px border
│ ║      Sun, May 4 · Marathon 26.2 ║ │
│ ║      9 weeks to go            › ║ │
│ ╚═════════════════════════════════╝ │
└─────────────────────────────────────┘
```

Interactive: menu, Today pill, settings, each week header (expand/collapse), each
non-rest day row, the race block. Rest rows and the progress bar are not
interactive.

### 4.2 Day detail — sheet (mobile) / side panel (desktop)

```
┌─────────────────────────────────────┐
│               ────                   │  drag handle (mobile). [✕] close button also present (44px)
│ ‹ Prev     Fri, Mar 7      Next ›    │  in-sheet day stepper. center = focus target on open
├─────────────────────────────────────┤
│  Easy run                            │  h2 — sheet's accessible name
│  Week 9 · recovery day               │
│                                      │
│  Keep it relaxed — you should be     │  short plain-language description
│  able to talk in full sentences the  │
│  whole way. Sits between yesterday's │
│  tempo and Sunday's long run.        │
│                                      │
│  Planned      4 mi · easy            │
│  Completed    —                      │
│                                      │
│  ┌───────────────────────────────┐   │
│  │        Mark complete          │   │  primary button (full width, ≥44px)
│  └───────────────────────────────┘   │
│           Edit  ·  Skip              │  secondary text actions
└─────────────────────────────────────┘

  after "Mark complete":
│  Completed    4.1 mi ✓               │
│  ┌───────────────────────────────┐   │
│  │   Completed — tap to undo     │   │  toggle, aria-pressed=true
│  └───────────────────────────────┘   │
│           Nice. Long run Sunday.     │  live-region confirmation echoed here
```

### 4.3 Empty / first-run (mobile)

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

### 4.4 Loading (mobile)

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
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
└─────────────────────────────────────┘
```
No spinner. Skeleton mirrors the real layout. SR: `aria-busy="true"` on `<main>`,
polite "Loading your plan".

### 4.5 Error (mobile)

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

### 4.6 Calendar — desktop (≥1024px): week as a 7-column row

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Marathon plan          9 weeks to race day · Week 9 of 18              [⚙]   │  slim top bar
├──────────────────────────────────────────────────────────────────────────────┤
│  Week 8 · Feb 24–Mar 2                                        28 / 28 mi  ✓   │  week sub-header (sticky while in view)
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 24 │Tue 25 │Wed 26 │Thu 27 │Fri 28   │Sat 1  │Sun 2  [LONG]│  wk 8   │  │
│  │Easy   │Hills  │Rest   │Tempo  │Easy     │Rest   │Long run     │  28 mi  │  │  ← weekly-summary rail
│  │5 mi ✓ │6 mi ✓ │  —    │6 mi ✓ │4 mi ✓   │  —    │12 mi ✓      │  done   │  │
│  └───────┴───────┴───────┴───────┴─────────┴───────┴─────────────┴─────────┘  │
│  Week 9 · Mar 3–Mar 9                                         18 / 32 mi      │
│  ┌───────┬───────┬───────┬───────┬─────────┬───────┬─────────────┬─────────┐  │
│  │Mon 3  │Tue 4  │Wed 5  │Thu 6  │▏Fri 7   │Sat 8  │Sun 9  [LONG]│  wk 9   │  │
│  │Easy   │Interv │Rest   │Tempo  │▏Today   │Rest   │Long run     │  32 mi  │  │
│  │5 mi ✓ │6 mi ✓ │  —    │7 mi ✓ │▏Easy 4mi│  —    │14 mi        │ 18 done │  │
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

On desktop, weeks are **not** collapsed by default (vertical space is cheap); the
whole block scrolls. Today's cell is outlined; the week sub-header sticks while
that week is in the viewport.

---

## 5. Interface detail

### 5.1 Layout & spacing intent

- **Vertical rhythm.** Week blocks separated by a hairline rule. Inside a week,
  day rows separated by lighter hairlines. Generous row height on mobile (~52–56px)
  so each day is a comfortable tap target and the list doesn't feel cramped.
- **Number alignment.** All mileage and dates in tabular figures, right-aligned in
  their column so the eye can scan volume down a week.
- **Hierarchy.** Countdown number is the largest text on the screen. Week numbers
  and volumes next. Workout names are body size. Dates, "Rest", and metadata are
  muted (but still ≥ 4.5:1 — do not over-mute).
- **One accent.** A single dark accent (colour TBD with the palette) is spent only
  on **today**. Done state uses a fill + check, not the accent. Long run uses a
  bordered tag, not the accent.
- **Race block.** Heavier border (2px) than anything else, sitting slightly inset,
  so it reads as a destination.

### 5.2 Component mapping

Framed by framework because the web stack is undecided (`docs/decisions/0002-web-app-stack.md`).
See `docs/design/ui-toolkit.md` for the library recommendation and trade-offs.

| Element | If React | Framework-agnostic | Notes |
|---|---|---|---|
| Top bar | plain markup | plain markup | Custom, trivial. |
| "Today" pill / buttons | shadcn/ui `Button` (Radix Slot) | DaisyUI `btn` / Tailwind | Standard. |
| Settings / menu icon buttons | shadcn/ui `Button` icon variant | `<button>` + Tailwind | 44px target. |
| Plan progress bar | shadcn/ui `Progress` (Radix Progress) | `<progress>` or DaisyUI `progress` | `role=progressbar`, `aria-valuenow/min/max`, plus visible "Week 9 of 18". |
| Week block (collapsible) | Radix `Accordion` (via shadcn/ui) — `type="multiple"` | native `<details>/<summary>` | **Container is library; the day-row / grid layout inside is custom** (product-distinct). |
| Day row / day cell | **custom** | **custom** | Core object. `<button>` or `<a>` per non-rest day; rest day is a non-interactive `<div>`. |
| "Long" tag, "Today" label, "Skipped" label | **custom** (span) | **custom** (span) | Text badges; never colour-only. |
| Day detail — mobile sheet | Vaul `Drawer` (or Radix `Dialog` styled as sheet) | Radix-less: `<dialog>` + CSS transform, or a small drawer lib | Focus trap, Esc to close, focus return. |
| Day detail — desktop side panel | Radix `Dialog` with side styling, or a plain aside toggled in layout | same | Non-modal on desktop is acceptable (calendar stays usable); if non-modal, don't trap focus, do move focus in. |
| In-sheet prev/next day | shadcn/ui `Button` icon | `<button>` | Labels "Previous day" / "Next day". |
| Mark complete / undo | shadcn/ui `Button` acting as toggle (`aria-pressed`) | `<button aria-pressed>` | Not a checkbox visually, but expose pressed state. |
| Confirmation ("marked complete") | Sonner toast **and/or** inline live region | inline `aria-live="polite"` region | Inline is enough for v1; toast optional. |
| Race-day block / race detail | **custom** block, reuse the sheet pattern | same | No library primitive for a milestone. |
| Empty-state illustration | `<img>` from unDraw | same | Decorative, `alt=""`. |
| Skeleton | shadcn/ui `Skeleton` | Tailwind pulse divs | Mirrors layout. |
| Icons | **Lucide** (`lucide-react`) | Lucide SVG sprite | One set. Glyphs: `menu`, `settings`, `check`, `chevron-left/right/up/down`, `flag`, `footprints`/`activity`, `minus` (rest), `calendar`, `alert-triangle`. |

### 5.3 Copy

| Context | Text |
|---|---|
| Screen title | `Marathon plan` |
| Countdown, normal | `9 weeks to race day` |
| Countdown, < 2 weeks | `6 days to race day` |
| Countdown, final week | `Race week` |
| Countdown, race day | `Race day is today` |
| Plan position sub-line | `Week 9 of 18 · base + build` (phase label is an open question) |
| Jump-to-today control | `Today` |
| Week header | `Week 9` · `Mar 3 – Mar 9` |
| Weekly volume, before activity | `32 mi planned` |
| Weekly volume, in progress | `18 / 32 mi` |
| Weekly volume, week complete | `28 / 28 mi` + check |
| Rest day | `Rest` |
| Long-run tag | `Long` |
| Today label (on the row) | `Today` |
| Skipped label | `Skipped` |
| Collapsed taper gap | `• • •` (tap: `Show weeks 11–17`) |
| Race block title | `Race day` |
| Race block detail line | `Sun, May 4 · Marathon 26.2 mi` |
| Race block countdown | `9 weeks to go` → `Race week` → `Race day is today` |
| Day detail — planned row | `Planned` → e.g. `4 mi · easy` |
| Day detail — completed row, empty | `—` |
| Day detail — completed row, done | `4.1 mi` + check |
| Primary button | `Mark complete` |
| Primary button, after | `Completed — tap to undo` |
| Secondary actions | `Edit` · `Skip` |
| Live-region confirmation | `Friday's easy run marked complete` |
| Empty title | `No plan yet` |
| Empty body | `Add your race date and we'll lay out the training weeks leading up to it.` |
| Empty CTA | `Set up plan` |
| Error title | `Couldn't load your plan` |
| Error body | `Check your connection and try again.` |
| Error retry | `Try again` |
| Loading (SR only) | `Loading your plan` |

Tone: plain, second person, no exclamation marks except the light post-workout
nudge ("Nice. Long run Sunday."). No coaching jargon.

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
3. Title (not focusable — it's an `<h1>`)
4. "Today" pill button
5. Settings button
6. Progress bar — not focusable (it's status; the text "Week 9 of 18" carries it)
7. Week 8 header — `<button aria-expanded="false" aria-controls="week-8-days">`
8. (if expanded) each **non-rest** day in Week 8, DOM order Mon→Sun. Rest days are
   **skipped** (not focusable — no detail to show).
9. Week 9 header (`aria-expanded="true"`)
10. Week 9 day rows Mon→Sun (rest days skipped): Mon, Tue, Thu, **Fri (today)**,
    Sun
11. Week 10 header … subsequent weeks …
12. "Show weeks 11–17" toggle
13. Race-day block — `<button>` / `<a>`

**Enhancement (not required for v1):** roving `tabindex` + arrow keys to move
between day cells within a week (Left/Right within a week, Up/Down across weeks),
mirroring Notion Calendar. Tab must still reach every day regardless.

### Day detail sheet

- On open: focus moves to the sheet. Mobile (modal): focus trapped, background
  `inert`/`aria-hidden`, **Esc** closes, focus returns to the day row that opened it.
  Desktop side panel (non-modal): focus moves in, **not** trapped, Esc still closes.
- Sheet has `role="dialog"`, `aria-modal="true"` on mobile, `aria-labelledby`
  pointing at the workout title `<h2>`.
- Prev/next buttons: `aria-label="Previous day"` / `"Next day"`; when the day
  changes, the `<h2>` and nav label update and are announced via an
  `aria-live="polite"` region ("Now showing Thursday, March 6").
- **Mark complete** is a `<button>` with `aria-pressed`. On toggle, a polite live
  region announces "Friday's easy run marked complete" / "…marked not complete".
- **Skip** similarly announces "Friday's easy run skipped".

### Semantics / roles / labels

- `<main>` wraps the calendar; `aria-busy="true"` while loading.
- Countdown block: `<h2>` "9 weeks to race day" + supporting text; not a live
  region (it doesn't change while viewing).
- Progress: `role="progressbar" aria-valuemin="1" aria-valuemax="18"
  aria-valuenow="9" aria-label="Plan progress, week 9 of 18"`.
- Week list: `<ol>` of weeks; each week `<li>`. Day list inside a week: `<ol>` of
  days.
- Each day control's accessible name is composed and self-sufficient:
  `"Friday, March 7. Today. Easy run, 4 miles. Not completed."` /
  `"Tuesday, March 4. Intervals, 6 miles. Completed."`
  Rest day (non-interactive): plain text `"Wednesday, March 5. Rest day."`
- The check icon, "Long" tag, and "Today" pill are supplementary — the accessible
  name already carries the meaning; icons get `aria-hidden="true"`.
- Race block accessible name: `"Race day. Sunday, May 4. Marathon, 26.2 miles.
  9 weeks to go."`

### Contrast

- Body text and workout names: ≥ **4.5:1** on their background (including on the
  done-state fill — check the fill isn't so light that grey text fails, and not so
  dark that it fails against white).
- Muted metadata ("Rest", dates): ≥ **4.5:1** (treat as normal text, not "large").
- Large countdown number: ≥ **3:1** minimum, aim higher.
- "Today" indication must not be **colour only**: it pairs the accent border with
  the visible text "Today" and a heavier weight.
- Focus ring: visible, ≥ 3:1 against adjacent colours, not removed.

### Touch targets

- Day row: full row width, **≥ 44 × 44 CSS px** (mobile row height ~52–56px).
- Week header (tap to expand): ≥ 44px tall, full width.
- Icon buttons (menu, settings, Today pill, prev/next, close): ≥ 44 × 44px.
- Secondary text actions ("Edit", "Skip"): padded to ≥ 44px tall even though they
  look like text links.

### Motion

- Respect `prefers-reduced-motion`: no sheet slide (fade/instant instead), no
  check-mark animation, no accordion height easing.

---

## 7. New vs. reused patterns

There is **no existing UI** in this repo yet — `docs/design/` and `apps/web/` are
empty of screens — so this spec also seeds the vocabulary. Patterns introduced
here that future screens should reuse:

| Pattern | Reused from | New? | Why |
|---|---|---|---|
| Collapsible section | library accordion / `<details>` | Reused (standard) | — |
| Bottom sheet / side panel for detail | library dialog/drawer | Reused (standard) | — |
| Skeleton loading, error-with-retry, empty-with-single-CTA | standard | Reused (standard) | Establish these three as the house state patterns. |
| **Week block** (collapsible header + day rows / 7-col grid + volume summary) | — | **New** | The product's core object. No generic component expresses "a training week with a long-run anchor and planned-vs-done state". Built on an accordion primitive; the internal layout is custom. |
| **Race-day / milestone block** | — | **New** | A pinned dated milestone with a countdown. Nothing standard covers it; low effort, high identity. |
| **planned = quiet / done = filled+check / today = one accent** status language | TrainingPeaks + Strava + Notion Calendar (borrowed) | **New here** | Needs to be defined once and applied consistently across the app (e.g. a future "week detail" or "history" screen). |

---

## 8. Open questions (product decisions — not for the designer to invent)

Routed to `@tpm` / `@tech-lead` before this becomes a real issue:

1. **Where does the plan come from?** Generated from race date + goal time?
   Chosen from templates (e.g. Pfitzinger, Hal Higdon)? Hand-built? This screen
   assumes it already exists.
2. **Is the plan editable in v1?** Can a runner move a workout to a different day,
   swap sessions, or change distances? This pass is view + mark-complete/skip only.
3. **What does "completed" mean / where does actual distance come from?** Manual
   entry? Auto-copied from planned (the v1 placeholder here)? Pulled and
   auto-matched from Strava/Garmin/Apple Health? Big scope lever.
4. **Units** — miles vs km. Per-user setting? Inferred from locale?
5. **Week start** — Monday (assumed) vs Sunday. Setting?
6. **Multiple plans / races** at once, or strictly one active plan?
7. **Phase labels** ("base", "build", "peak", "taper") — do we show them, and who
   defines the boundaries?
8. **Taper / race week** — special visual treatment beyond the label? The mock
   just collapses the taper weeks behind `• • •`.
9. **Past weeks** — auto-collapse (assumed) and show an adherence figure
   (e.g. "26 / 28 mi done")? Or leave plain?
10. **After race day** — does the plan archive, show a recap, roll into recovery?
11. **Notifications / reminders** — out of scope for this screen, but they'll deep
    link back into it; the day-sheet deep link is designed for that.
12. **Offline / PWA** — is viewing the plan offline a v1 requirement?
13. **Missed workouts in the past** — shown as "Skipped", "Missed", or just left
    un-filled? Any "you're behind" messaging? (Recommend: no guilt UI in v1.)

---

## 9. Validate with users

Before committing to build:

- **Row-per-week vs month grid.** Put both in front of 2–3 marathon runners.
  Hypothesis: runners think in weeks and long runs, not calendar months. Confirm.
- **Does the countdown belong at the top, or is "today's workout" the thing they
  want first?** A/B the header: "9 weeks to race day" vs a today-workout card.
- **Collapsing past weeks by default** — do runners want to see how the plan has
  gone so far (adherence), or is forward-looking enough?
- **"Mark complete" friction** — if actual data can come from a watch sync,
  manual marking may feel redundant. Depends on open question 3.

After shipping:

- Watch whether people ever scroll to / tap the race block, or if the countdown
  alone is enough.
- Whether multiple weeks get expanded at once (validates `type=multiple`
  accordion) or people keep it to one.
