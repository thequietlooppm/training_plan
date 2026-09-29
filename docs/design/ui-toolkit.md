# UI toolkit — running list

> Owned by `@designer`. The short list of what we've adopted for standard UI, so
> basic elements are reused, not hand-built. Update on first use of anything new.

## Status: locked — per ADR 0002 (Accepted 2026-09-18)

`docs/decisions/0002-web-app-stack.md` is now **Accepted**: React via Vite,
Tailwind CSS, **shadcn/ui** (over Radix primitives), **Lucide** icons. The
picks below are no longer a proposal framed by framework — they're the
decision for `apps/web/`. The former "if React / if framework-agnostic" table
is collapsed accordingly; the agnostic column is kept struck through for
reference only (useful if a non-React surface ever comes up) and is not live
guidance for this repo.

## Revision (2026-09-28) — the Color palette and Font sections below are
promoted to **Tempo**, the named, product-wide design system

Everything under "Color palette" and "Font" used to be framed as "decided for
the plan-setup screen, a future screen earns its own case to deviate." That
framing was right for a reactive fix but wrong as a long-term default — it
invited exactly the kind of screen-by-screen color patching this revision
exists to stop. As of this revision:

- The amber/Figtree/Plex-Mono direction from the plan-setup correction is
  **kept, not discarded** — it's the seed of the system, re-derived below with
  concrete light **and** dark tokens, a named type scale, and a real
  completion-status color decision (previously an open "no green" placeholder
  with no resolution).
- Every screen spec (`plan-setup-flow.md`, `training-calendar.md`,
  `strava-connect-settings.md`) pulls its color and type choices from **this
  doc**, not the other way around. If a screen spec and this doc ever
  disagree, this doc wins and the screen spec is stale.
- The system has a name — **Tempo** — so it can be referred to by name in
  review and in future specs instead of re-describing it each time.

## Component library

**Decided: shadcn/ui (MIT, copy-in) over Radix UI primitives, styled with
Tailwind CSS.**

| | Pick | Why | Cost | Alternative to weigh |
|---|---|---|---|---|
| ~~React~~ **(decided)** | **shadcn/ui** over Radix primitives | Gives us accordion, dialog, drawer, progress, button, toast, form, table, and a `react-day-picker` calendar — almost everything the calendar and plan-setup screens need — as code we own and restyle. Accessible primitives (Radix) underneath. | Tailwind buy-in; you maintain the copied components; needs a bundler (Vite, already decided). | **Mantine** — batteries-included, own styling engine, installed as a dep rather than copied. Faster to start, heavier to escape. Not pursued. |
| ~~Framework-agnostic~~ *(moot — stack is React; kept for reference only)* | Tailwind CSS + DaisyUI | N/A — not applicable now that the stack is React. | — | — |

Screen-by-screen mapping lives in:
- `docs/design/training-calendar.md` § Interface detail (calendar / day-detail
  sheet, including the Strava-match UI — not yet built).
- `docs/design/plan-setup-flow.md` §6.2 (template/race-date/result/goal-time
  form + §7 pace-zone table — issues #12/#14).
- `docs/design/strava-connect-settings.md` § Interface detail (Strava connect/
  settings screen — issue #20, not yet built).

Scaffold-time component list for the hello-world shell (issue #5) lives in
the designer's consult response on that issue, not duplicated here.

### Primitives adopted so far

| Primitive | First used on | Notes |
|---|---|---|
| `Button` | Hello-world shell / `HomePage.tsx` | Standard. |
| `Card` (+ Header/Content/Footer/Title/Description/Action) | `HomePage.tsx` | Standard section container; reused on the plan-setup, calendar, and Strava-settings screens. |
| `Skeleton` | `HomePage.tsx` | Loading-state convention: mirrors real layout, no spinner. Reused for the Strava "connecting" state (`strava-connect-settings.md`). |
| `Progress` | `docs/design/training-calendar.md` (not yet built) | Plan-progress bar. |
| `Accordion` | `docs/design/training-calendar.md` (not yet built) | Collapsible week block. |
| `Dialog` / a `Drawer` (e.g. Vaul) | `docs/design/training-calendar.md` (not yet built) | Day-detail sheet (mobile) / side panel (desktop). |
| `AlertDialog` (shadcn, Radix `AlertDialog`) | `docs/design/strava-connect-settings.md` (issue #20, not yet built) | **New adoption.** Modal confirmation for the Strava **Disconnect** action — the copy must state the purge-on-disconnect behavior (FR15) before the runner confirms, so a plain `Dialog` isn't enough; `AlertDialog` is the primitive that models "confirm a consequential, non-trivial-to-undo action." |
| `Form` (react-hook-form + zod resolver) | `docs/design/plan-setup-flow.md` (issue #12, not yet built) | **New dependency add** — `react-hook-form` + `zod` (`zod` is already used inside `packages/pace-zones`/`plan-templates`, but not yet a direct `apps/web` dependency). Chosen over hand-rolled `useState` validation because this form has real multi-field, cross-field, and calculator-shaped (`errors[].path`) validation to reconcile — see the spec's "Form: recommendation" for the full trade-off. |
| `Input` | `docs/design/plan-setup-flow.md` | Text/number/`type="date"` fields — race date, and the 3-field H/M/S time-entry composite (`TimeInputGroup`, custom, built from `Input` + `Label`). **All set in the body typeface (see Type scale, below) — never the numeral/mono face used for pace numbers.** |
| `Label` | `docs/design/plan-setup-flow.md` | Paired with every `Input`/`Select`/`RadioGroup` item. |
| `Select` | `docs/design/plan-setup-flow.md` | Recent-result distance (6 options). |
| `RadioGroup` | `docs/design/plan-setup-flow.md`, `docs/design/training-calendar.md` | Three uses: template picker and goal-time distance toggle on plan-setup (same primitive, different CSS); **new use** — the multi-match single-select list in the day-detail sheet (FR18, "runner picks one of several plausible same-day Strava activities, or 'none of these'") reuses this same primitive rather than inventing a new list-selection component. |
| `Table` | `docs/design/plan-setup-flow.md` | The #14 pace-zone reference table. Pace column uses the numeral/mono face (Type scale, below); everything else in the table uses the body typeface. |
| `Alert` | `docs/design/plan-setup-flow.md`, `docs/design/training-calendar.md`, `docs/design/strava-connect-settings.md` | Variants in use: destructive (form errors, Strava auth-expired/error states), and info/warning, non-destructive (goal-time pace-estimate banner; Strava backfill-in-progress banner). |
| `Badge` | `docs/design/plan-setup-flow.md`, `docs/design/training-calendar.md`, `docs/design/strava-connect-settings.md` | Template metadata tag; "Estimated" pace-zone tag (issue #52); **new uses** — the completion-status chip (Achieved/Partial/Missed/Rest, see below) and the Strava connection-status chip (Connected/Not connected/Auth expired). Custom color per status, see "Deliberately custom" below for why the status chip isn't a bare `Badge`. |

Not yet adopted / not needed anywhere yet: `Popover`, `Calendar`
(`react-day-picker`) — considered for race-date entry on the plan-setup
screen and deliberately **not** used there (a native `<input type="date">`
does that one-date job without a full month-grid component); still expected
on the training-calendar screen itself, which genuinely needs a month/week
grid. `Toast`/Sonner — considered for the calendar's activity-match
confirmation and passed over in favor of an inline live region for v1.
`Tooltip` — considered twice (the plan-setup "Estimated" badge, and the
Strava "last synced" timestamp) and passed over both times in favor of a
native `title` attribute + visually-hidden text, to avoid a new dependency
and new per-item tab stops for information a section-level banner or visible
label already states; revisit if user testing shows either needs to be more
discoverable.

## Color system — **Tempo**

**Decided (this revision).** Tempo is one warm accent color against neutral
surfaces, in both a light and a dark variant, plus a deliberately-chosen
four-color completion-status vocabulary. It replaces the plan-setup-only
palette below without discarding it — the accent hue and the "one accent, one
job" discipline are unchanged; what's new is that this is now stated as the
default for every screen, dark-mode tokens are defined, and the completion-
status question (previously left as "no green, a future screen can make its
own case") is resolved.

### Proactive principle: no terminal, no AI-demo-cliché, stated once

This is a consumer running app, not a developer tool, and not a generic SaaS
demo. State it here so it doesn't have to be re-litigated screen by screen
(full reasoning/reference table for this was worked out on the plan-setup
screen — `docs/design/plan-setup-flow.md` §2 — this is the standing rule
derived from it):

- **No saturated green-on-dark, no near-black chrome, no CLI-style UI
  anywhere** — that combination reads as a terminal/developer tool, which is
  the opposite of the register this product wants. This isn't "we avoided it
  once on plan-setup"; it's a standing rule for every future screen.
- **No reflexive Inter/Space Grotesk, no purple/blue gradient, no
  warm-cream-and-terracotta-with-serif** — the three other clichés already
  identified and rejected. Also standing, not screen-local.
- Monospace/tabular figures are a narrow **numeral-alignment role**, not a
  stylistic accent: confined to a column of numbers being compared against
  each other (a results table, a weekly-mileage column) — **never** on an
  input field, and never on body/label/heading text, on any screen, dark mode
  included.
- Dark mode is not "invert the colors" — surfaces, text, and the accent all
  get their own verified-contrast tokens below, because a color that passes
  AA on a white surface doesn't automatically pass on a near-black one (or
  vice versa).

### Light mode tokens

| Token | Hex | Role |
|---|---|---|
| `surface/page` | `#FAFAFA` | Page background (Tailwind `neutral-50`) — true neutral, not warm cream. |
| `surface/card` | `#FFFFFF` | `Card` background — sits slightly lighter than the page for a subtle raised feel. |
| `surface/sunken` | `#F5F5F4` | Input backgrounds, skeleton fill, table row stripe (`neutral-100`). |
| `border/subtle` | `#E7E5E4` | Hairlines between rows/sections (`neutral-200`). |
| `border/default` | `#D6D3D1` | Card/input borders, dividers that need to read as a real line (`neutral-300`). |
| `text/primary` | `#292524` | Body text, headings — warm dark charcoal, not pure black (`stone-800`). |
| `text/secondary` | `#57534E` | Helper text, muted metadata, "Rest" labels (`stone-600`) — **still ≥4.5:1**, this is "muted," not "disabled." |
| `text/disabled` | `#A8A29E` | Decorative-only (e.g. a genuinely disabled control's label). **Never** used for text that carries required information — anything a user needs to read uses `text/secondary` or darker. |
| `accent/solid` | `#C2410C` | Primary buttons, selected/active states, links, icon-on-light usage. See contrast reasoning below — **this replaces the earlier placeholder `#D9730D`, which fails contrast (see below).** |
| `accent/hover` | `#9A3412` | Hover/pressed state for `accent/solid`. |
| `accent/tint-bg` | `#FFF7ED` | Background wash for info/warning `Alert`s and section banners (e.g. the goal-derived pace-estimate banner). |
| `accent/chip-bg` | `#FFEDD5` | Slightly stronger tint for `Badge`/chip backgrounds (e.g. "Estimated" badge chip fill, distinct from the paler alert-banner wash). |
| `destructive/text` | `#DC2626` | Error text, destructive `Alert`/`FormMessage`, destructive button fill (white label). (`red-600`) |
| `destructive/tint-bg` | `#FEF2F2` | Destructive `Alert` background wash. |
| `destructive/border` | `#FCA5A5` | Destructive `Alert` border. |

### Dark mode tokens

| Token | Hex | Role |
|---|---|---|
| `surface/page` | `#171717` | Page background (`neutral-900`) — warm-neutral near-black, not the flat `#000` "terminal" black. |
| `surface/card` | `#262626` | `Card` background, raised above the page (`neutral-800`). |
| `surface/sunken` | `#171717` | Input backgrounds — same tone as the page, recessed relative to the raised `Card`. |
| `border/subtle` | `#2E2E2E` | Hairlines. |
| `border/default` | `#404040` | Card/input borders (`neutral-700`). |
| `text/primary` | `#F5F5F4` | Body text, headings — warm off-white, not pure white (`stone-100`). |
| `text/secondary` | `#A8A29E` | Helper text, muted metadata (`stone-400`) — ≥4.5:1, see contrast note below. |
| `text/disabled` | `#57534E` | Decorative-only, same rule as light mode. |
| `accent/solid` | `#C2410C` | Same hex as light mode — button-fill contrast is self-contained (label vs. fill), not page-background-dependent, so it doesn't need a dark-mode variant for that use. |
| `accent/on-surface` | `#FB923C` | Text/icon/link usage of the accent color **directly on a dark surface** (e.g. an active nav item's text, a "Today" label in dark mode) — `accent/solid` itself is too dark to read as text on a near-black surface; `orange-400` is the corrected token. See contrast note. |
| `accent/hover` | `#FDBA74` | Hover/pressed state for `accent/on-surface` (`orange-300`). |
| `accent/tint-bg` | `#3A1F0F` | Dark-mode alert/banner background wash — verify exact value against the final Tailwind dark palette when the theme is wired; this is a reasonable starting point, not gospel. |
| `accent/chip-bg` | `#4A280F` | Dark-mode chip/badge background wash. |
| `destructive/text` | `#F87171` | Error text on dark surfaces (`red-400`). |
| `destructive/tint-bg` | `#450A0A` | Destructive `Alert` background wash, dark mode. |
| `destructive/border` | `#7F1D1D` | Destructive `Alert` border, dark mode. |

### Contrast reasoning — accent (the highest-risk pairing)

The earlier plan-setup spec flagged, correctly, that the accent "needs a real
contrast check... don't assume it" and left the exact hex as a placeholder
(`#D9730D`). **That check is done now, and the placeholder fails it:**
`#D9730D` with white button-label text (or as standalone text on `#FAFAFA`)
computes to **~3.3:1** — below the 4.5:1 AA bar for normal text. `accent/solid`
is corrected to **`#C2410C`** (Tailwind `orange-700`), which computes to
**~5.18:1** against both white button-label text and against the light-mode
page/card surface as standalone text — passes with real margin, not a
knife-edge pass.

For dark mode, `accent/solid` (`#C2410C`) stays valid for **button fills**
(white label on that fill is the same ~5.18:1 regardless of page background),
but used as bare text/icon color directly on the dark surface (`#171717`) it
drops to **~3.5:1** — enough for a 3:1-threshold graphical element (an icon,
a border) but not for text. `accent/on-surface` (`#FB923C`, `orange-400`)
against `#171717` computes to **~7.9:1** — the corrected token for any
accent-colored text/link/label in dark mode.

### Contrast reasoning — completion status (see full section below)

Same discipline applied to all four status colors and both modes; summarized
here, full table below: light-mode status text tokens range **4.8:1–7.6:1**,
dark-mode status text tokens range **6.5:1–10.3:1** (I chose slightly less
saturated variants — `green-500`/`amber-500` over `green-400`/`amber-400` —
in a couple of cases specifically to pull back from a needlessly bright
"neon" reading in dark mode while keeping comfortable margin above 4.5:1; see
that section for the per-color numbers).

### Semantic — destructive / info

Unchanged in spirit from the prior revision: shadcn's default destructive red
family for errors (tokens above resolve it to a specific, contrast-checked
hex per mode rather than "shadcn's default, unchanged"); the accent family,
lighter tint, for non-destructive info/warning `Alert`s (e.g. the goal-time
pace-estimate banner, the Strava backfill-in-progress banner) — it needs to
read as "worth knowing," not "you made an error," so it stays visually
distinct from destructive red in both modes.

---

## Completion-status color system (Achieved / Partial / Missed / Rest)

**Decided once, here, cross-cutting.** This is the resolution of the "no
green anywhere in the palette... a future screen with a genuine done/not-done
semantic can make its own reference-backed case" placeholder from the prior
revision. `training-calendar.md` and the day-detail sheet spec both reference
this section rather than defining their own version — FR19–FR22 define the
four states (`docs/planning/web-v1-requirements.md`); this section defines
how they look.

### References this decision draws from

| App | What it does well | Borrow | Skip |
|---|---|---|---|
| **Apple Fitness / Activity rings** | A closed ring (the Exercise ring, specifically) is a widely-recognized "you did the thing" green, sitting next to red and blue rings without visually fighting them — proof that a considered green can coexist with a warm accent elsewhere in the same UI. | The precedent that green-for-achieved is a legible, common convention, not a terminal cliché, when it's one deliberate color among several, not a screen-wide wash. | The ring/radial-progress visual itself — not the right shape for a day-status chip; we're borrowing the color decision, not the widget. |
| **Things 3** | A completed to-do gets a small, solid, **muted** checkmark circle plus strikethrough/muted text — the color carries almost no weight; the check glyph and the text-muting do the work. | The restraint: the color is a supporting signal, not the primary one — icon shape + text state (label, muting) carry the meaning first, per our own "never color alone" principle. | Things' soft-purple-and-blue brand palette elsewhere in the app — not relevant to our accent. |
| **Todoist** | Done items go grey/strikethrough, not green — proves "done" doesn't *require* green; a muted neutral treatment is a legitimate alternative. | The muted-neutral option as a real alternative we considered (see decision below) — it's why Rest, our fourth state, is neutral grey rather than a fifth color. | Todoist's priority-flag red/orange dots — a different semantic (urgency, not status) we don't need. |
| **Strava** | Completed activities read as solid, present cards; the app doesn't lean on green for "done" at all — its own brand accent (orange-red) does double duty for CTAs and presence. | The proof that a single warm accent can carry "done" *and* "action" without a dedicated status hue — this is why Partial reuses the accent family instead of inventing a new one. | N/A — Strava doesn't have a Partial/Missed distinction to borrow from directly (activities either exist or don't). |
| **TrainingPeaks** | Planned vs. completed workouts use an outline-vs-fill pairing more than a color-coded one — shape carries as much of the meaning as hue. | The outline (planned/未-reached) → fill (achieved) visual pairing as a secondary signal alongside color, already adopted in `training-calendar.md` §2/§5.1 from the first pass — kept here, not reinvented. | TrainingPeaks' sport-type color-coding (blue bike, orange run, etc.) — a different axis we don't need; we have one activity type in scope (running-plus-cross-training) and status, not sport, is what needs color. |

### The decision

**Green for Achieved, kept deliberately muted (not neon/terminal green) —
reference-backed by Apple Fitness' Exercise ring, and made visually coherent
with the amber accent by choosing a value/saturation level that matches the
accent's, rather than a bright, high-chroma green that would compete with
it.** Partial reuses the **same accent family** as the "estimated/worth
knowing" info treatment already established for the goal-derived pace
warning — semantically apt (both mean "something here, not the full
picture") and automatically coherent, not competing, with the accent by
construction. Missed reuses the **same destructive red** already adopted for
form errors — no new hue. Rest stays neutral grey, matching the muted-
metadata treatment `training-calendar.md` already used for "Rest" in its
first pass. Total palette: accent (orange), green (new, Achieved only), red
(reused), neutral grey (reused) — four hues, not five, and no hue is
introduced without a job.

**Every status is icon + label + color, never color alone** — this was
already `training-calendar.md`'s stated principle ("today, done, rest, and
long run each carry a text label") and it applies identically here.

| Status | Icon (Lucide) | Label | Light text/icon | Light tint bg | Dark text/icon | Dark tint bg |
|---|---|---|---|---|---|---|
| **Achieved** | `check-circle-2` | "Achieved" | `#15803D` (green-700) — **~5.0:1** on `surface/page` | `#F0FDF4` (green-50) | `#22C55E` (green-500) — **~7.9:1** on dark `surface/page` | `#052E16` |
| **Partial** | `circle-dot` | "Partial" | `#B45309` (amber-700) — **~5.0:1** | `#FEF3C7` (amber-100) | `#F59E0B` (amber-500) — **~8.3:1** | `#3A2A0A` |
| **Missed** | `x-circle` | "Missed" | `#DC2626` (red-600) — **~4.8:1** | `#FEF2F2` (red-50) | `#F87171` (red-400) — **~6.5:1** | `#450A0A` |
| **Rest** | `moon` | "Rest" | `#57534E` (stone-600) — **~7.6:1** | `#F5F5F4` (neutral-100) | `#A8A29E` (stone-400) — **~7.1:1** | `#171717` (same as sunken) |

Notes:
- **Partial is amber-700/amber-500, not the same hex as `accent/solid`
  (orange-700).** They're the same warm family (coherent, per the brief's
  requirement) but a visibly different shade (more yellow-gold vs. more
  red-orange) so a status chip is never literally indistinguishable from a
  primary-CTA button or the "Estimated" pace badge sitting nearby in the same
  sheet. This was a deliberate correction during this pass — the first draft
  of this decision reused the identical accent hex for Partial and it read as
  a semantic collision (same color, two different meanings: "click this
  button" vs. "this status needs attention") once I checked it against the
  actual day-detail layout in `training-calendar.md` §4.2/§5.
- **Missed reuses the exact destructive red tokens** from the Color system
  above — not a fifth hue, and it matches the existing "no reason to invent a
  second red" rule.
- **Rest's tint background equals `surface/sunken`** — visually, a rest day
  should recede, not draw a colored wash the way the other three do.
- **Unlinked/bonus activity (FR17) is not a fifth status color.** An
  unscheduled or extra activity is a different axis (presence of unexpected
  data), not a level of achievement. It's rendered as a **neutral outline
  chip** — `border/default` border, `text/secondary` label, `plus-circle`
  icon, no fill — distinguished from the four status chips by shape (outline,
  unfilled) rather than by adding a fifth color. Label: "Extra activity."

---

## Icon set

**Lucide** (ISC licence). One set, used throughout. Decided — matches ADR 0002.

- Plan-setup screen: `alert-triangle` (destructive `Alert`s), `info`
  (non-destructive `Alert`s), `check-circle-2` (reused from `HomePage.tsx`'s
  success state; also the Achieved status icon, above — same glyph, generic
  "success/complete" meaning in both places, not a conflict).
- Training-calendar / day-detail: `menu`, `settings`, `chevron-left`,
  `chevron-right`, `chevron-down`, `chevron-up`, `flag` (race day),
  `footprints` (run), `activity` (non-running activity / unlinked entry),
  `moon` (Rest status), `circle-dot` (Partial status), `x-circle` (Missed
  status), `calendar`, `plus-circle` (unlinked/bonus activity), `undo-2`
  (undo a confirmed match), `link` / `link-2-off` (matched / dismissed).
- Strava connect/settings: `link` (connect), `link-2-off` or `unlink`
  (disconnect), `refresh-cw` (syncing/connecting), `clock` (last-synced
  time), `alert-triangle` (reused — error/auth-expired), `trash-2`
  (disconnect action's destructive intent inside the confirmation dialog),
  `external-link` (indicates the Connect button leaves the app for Strava's
  OAuth screen).
- Why Lucide: actively maintained fork of Feather, consistent 24px grid, a
  proper `lucide-react` package, permissive licence.
- Alternative considered: **Phosphor** — has literal `person-simple-run` /
  `sneaker` glyphs that suit a running app, and multiple weights. Slightly
  larger, less of a default in the React ecosystem. Not pursued.

---

## Type scale — **Tempo**

**Decided (this revision).** Promotes the prior "Font" section (which named
the two typefaces but not a scale) into a real named type scale — every role
has a size, line-height, and weight, not just "which typeface." The
body/numeral split rule from the prior revision is unchanged and restated
below as the standing principle, not a one-screen fix.

| Role | Typeface | Size / line-height | Weight | Usage |
|---|---|---|---|---|
| Display | Figtree | 36 / 44 | 700 (Bold) | A single hero stat read as prose, not a comparison column — e.g. the calendar's countdown number ("9 weeks to race day"). **Not mono** — see the correction to `training-calendar.md` below; a standalone hero number is not "a column of comparable numbers," so it doesn't earn the numeral face. |
| H1 | Figtree | 28 / 36 | 700 (Bold) | Page title ("Set up your plan", "Marathon plan"). |
| H2 | Figtree | 20 / 28 | 600 (Semibold) | Section heading ("Your pace zones", a week header, the day-detail sheet's workout title). |
| H3 | Figtree | 16 / 24 | 600 (Semibold) | Card/subsection title. |
| Body | Figtree | 16 / 24 | 400 (Regular) | Default paragraph text, **every input field**, button labels. |
| Body-sm / caption | Figtree | 14 / 20 | 400 (Regular) | Helper text, zone-purpose captions, muted metadata. |
| Label | Figtree | 13 / 16 | 500 (Medium) | Form field labels, section legends, table column headers, status-chip and connection-status-chip text. Section legends may add uppercase + slight letter-spacing; field labels don't. |
| Numeral (table) | IBM Plex Mono | 16 / 24 | 500 (Medium) | **Only** a column of numbers being compared against each other: the pace-zone table's pace column, the calendar's weekly-mileage/per-day-distance columns (desktop 7-column grid). Right-aligned, tabular figures. |
| Numeral (inline) | IBM Plex Mono | 14 / 20 | 500 (Medium) | Smaller reuse of the same data in a compact context — e.g. a future inline pace-zone chip strip (`plan-setup-flow.md` §7.4). Same rule, smaller size. |

**The rule, restated as a standing principle (not a one-screen fix):** one
body face (Figtree) everywhere a person types or reads prose, including every
form field, every heading, every button label, and every standalone "hero"
number (the Display role above); one numeral face (IBM Plex Mono), confined
to a column of numbers being compared against each other in an output table.
A screen that wants to set a single big number in mono because "numbers are
the hero" is the exact mistake the first plan-setup mockup made — a lone
number isn't a comparison column, and doesn't earn the numeral face. This is
also the correction applied to `training-calendar.md` in this revision: its
prior wording ("mileage, week number, weeks-to-race — set in tabular
figures") over-generalized the rule to include the countdown, which is a
Display-role hero stat, not a comparison column; only the calendar's actual
comparison columns (a week's per-day mileage, planned-vs-completed volume)
get the numeral face.

**Typeface licensing, unchanged:** Figtree — Google Fonts / Fontsource, OFL.
IBM Plex Mono — Google Fonts / Fontsource, OFL. Both free, both already
decided against the reflexive Inter/Space Grotesk picks (see the plan-setup
spec §2 for the full reasoning on why Inter specifically was passed over).

---

## Illustration

Empty / error states only, and only if a plain layout looks unfinished. Free
sources: unDraw (recolourable), Open Peeps, Humaaans. Keep to one source.

---

## Deliberately custom (not from a library)

| Component | Why it's custom |
|---|---|
| Week block (collapsible header + 7 day rows / 7-column grid) | This is the product's core object and its layout (row-per-week, long-run-as-anchor, planned vs. status vs. today treatment) is the thing that makes the calendar ours. Built on a library disclosure/accordion primitive, but the day-row and week-grid layout is bespoke. |
| Race-day row | A pinned "finish line" milestone with countdown — no library has this; it's a styled block, low effort. |
| Weekly-summary rail (desktop) | Small bespoke stat block; trivial to build, no primitive needed. |
| `StatusBadge` (Achieved/Partial/Missed/Rest chip) | Built on the library `Badge`, but the per-status color/icon/label mapping (this doc's Completion-status section) is bespoke and shared via one module (`lib/status-display.ts`, see `training-calendar.md`) so the calendar day row, the day-detail sheet, and any future week-summary reuse can't drift from each other. |
| `ActivityMatchCard` (suggested-match confirm/dismiss card in the day-detail sheet) | No library primitive models "here's an unconfirmed inference, confirm or dismiss it, and you can undo later" — assembled from `Card` + `Button` + `Badge`. First-of-its-kind pattern in this repo (see `training-calendar.md` §7). |
| `TimeInputGroup` (3× number input for H/M/S race/goal time entry) | No library primitive models "a single duration split across three fields" — assembled from `Input` + `Label` inside a `fieldset`. See `docs/design/plan-setup-flow.md` §6.2 for the format decision (three number fields over one free-text field) and §2 for why these fields use the body typeface, not the results table's numeral face. |
| `PaceZoneTable` + `lib/pace-zone-display.ts` (zone order, `formatPace`, blocked/unset copy, and — per issue #52 — the goal-derived `source` warning banner/badge copy) | The other core product object besides the week block — the direct realization of issue #14, amended by #52's goal-time-derived-fallback warning. Built on the library `Table`/`Alert`/`Badge`, but the zone ordering, pace formatting, blocked/unset microcopy, and the goal-derived warning copy are bespoke and shared via one module so a future compact/inline variant (calendar day-detail) can't drift from this one. See `docs/design/plan-setup-flow.md` §7.4. |
| Template radio-card list | Built on the library `RadioGroup` (keyboard/roving-tabindex behavior is the primitive); the card layout inside each item — title + distance-type + week-count metadata — is bespoke, same split as the week block. |
| `ConnectionStatusCard` (Strava not-connected/connecting/connected/auth-expired/error) | Built on `Card` + `Badge` + `Button` + `Alert`, but the state machine and the specific copy per state (`strava-connect-settings.md`) is bespoke — no library primitive models "an OAuth connection's lifecycle status." |
