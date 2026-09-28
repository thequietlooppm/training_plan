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

## Component library

**Decided: shadcn/ui (MIT, copy-in) over Radix UI primitives, styled with
Tailwind CSS.**

| | Pick | Why | Cost | Alternative to weigh |
|---|---|---|---|---|
| ~~React~~ **(decided)** | **shadcn/ui** over Radix primitives | Gives us accordion, dialog, drawer, progress, button, toast, form, table, and a `react-day-picker` calendar — almost everything the calendar and plan-setup screens need — as code we own and restyle. Accessible primitives (Radix) underneath. | Tailwind buy-in; you maintain the copied components; needs a bundler (Vite, already decided). | **Mantine** — batteries-included, own styling engine, installed as a dep rather than copied. Faster to start, heavier to escape. Not pursued. |
| ~~Framework-agnostic~~ *(moot — stack is React; kept for reference only)* | Tailwind CSS + DaisyUI | N/A — not applicable now that the stack is React. | — | — |

Screen-by-screen mapping lives in:
- `docs/design/training-calendar.md` § Interface detail (calendar / day-detail
  sheet — not yet built).
- `docs/design/plan-setup-flow.md` §6.2 (template/race-date/result/goal-time
  form + §7 pace-zone table — issues #12/#14).

Scaffold-time component list for the hello-world shell (issue #5) lives in
the designer's consult response on that issue, not duplicated here.

### Primitives adopted so far

| Primitive | First used on | Notes |
|---|---|---|
| `Button` | Hello-world shell / `HomePage.tsx` | Standard. |
| `Card` (+ Header/Content/Footer/Title/Description/Action) | `HomePage.tsx` | Standard section container; reused on the plan-setup screen. |
| `Skeleton` | `HomePage.tsx` | Loading-state convention: mirrors real layout, no spinner. |
| `Progress` | `docs/design/training-calendar.md` (not yet built) | Plan-progress bar. |
| `Accordion` | `docs/design/training-calendar.md` (not yet built) | Collapsible week block. |
| `Dialog` / a `Drawer` (e.g. Vaul) | `docs/design/training-calendar.md` (not yet built) | Day-detail sheet (mobile) / side panel (desktop). |
| `Form` (react-hook-form + zod resolver) | `docs/design/plan-setup-flow.md` (issue #12, not yet built) | **New dependency add** — `react-hook-form` + `zod` (`zod` is already used inside `packages/pace-zones`/`plan-templates`, but not yet a direct `apps/web` dependency). Chosen over hand-rolled `useState` validation because this form has real multi-field, cross-field, and calculator-shaped (`errors[].path`) validation to reconcile — see the spec's "Form: recommendation" for the full trade-off. |
| `Input` | `docs/design/plan-setup-flow.md` | Text/number/`type="date"` fields — race date, and the 3-field H/M/S time-entry composite (`TimeInputGroup`, custom, built from `Input` + `Label`). **All set in the body typeface (see Font, below) — never the numeral/mono face used for pace numbers.** |
| `Label` | `docs/design/plan-setup-flow.md` | Paired with every `Input`/`Select`/`RadioGroup` item. |
| `Select` | `docs/design/plan-setup-flow.md` | Recent-result distance (6 options). |
| `RadioGroup` | `docs/design/plan-setup-flow.md` | Two uses: template picker (styled as a card list) and goal-time distance (styled as a 2-segment toggle) — same primitive, different CSS, no second dependency. |
| `Table` | `docs/design/plan-setup-flow.md` | The #14 pace-zone reference table. Pace column uses the numeral/mono face (Font, below); everything else in the table uses the body typeface. |
| `Alert` | `docs/design/plan-setup-flow.md` | Three variants in use: destructive (`calculate()` errors and the pre-submit "at least one of recent result / goal time required" check), and info/warning, non-destructive (the goal-time-derived pace-estimate warning banner, issue #52 — see the plan-setup spec §7.2). |
| `Badge` | `docs/design/plan-setup-flow.md` | Two uses: template metadata tag ("Marathon · 18 weeks"), and the "Estimated" tag on goal-derived pace-zone rows (issue #52, plan-setup spec §7.2). |

Not yet adopted / not needed anywhere yet: `Popover`, `Calendar`
(`react-day-picker`) — considered for race-date entry on the plan-setup
screen and deliberately **not** used there (a native `<input type="date">`
does that one-date job without a full month-grid component); still expected
on the training-calendar screen itself, which genuinely needs a month/week
grid. `Toast`/Sonner — considered for the calendar's "marked complete"
confirmation and passed over in favor of an inline live region for v1.
`Tooltip` — considered for the "Estimated" pace-badge's fuller explanation
(plan-setup spec §7.2) and passed over in favor of a native `title` attribute
+ visually-hidden text, to avoid a new dependency and new per-row tab stops
for information a section-level banner already states in full; revisit if
user testing shows the badge alone needs to be more discoverable.

## Color palette

**Decided (this revision — resolves "reads as terminal" feedback on the
plan-setup mockup; full reference/reasoning in `docs/design/
plan-setup-flow.md` §2).** One warm accent color against neutral, light
surfaces. No dark chrome, no green accent, no purple/blue gradient anywhere
in the app by default — this isn't a blanket ban on those tools forever, but
a future screen that wants one earns it with its own reference-backed case
(that screen's own §2), not by inheriting an unstated default from here.

| | Pick | Why | Cost | Alternative to weigh |
|---|---|---|---|---|
| Accent | **One warm amber/coral shade** (Tailwind-`amber-600`-adjacent — the exact hex is a `tailwind.config` token for whoever wires up the theme to lock in; `#D9730D` is a reasonable starting point, not gospel from this doc) | Warm, running/effort-coded — borrows Strava's and Whoop's "one confident warm accent, spent on exactly one job" convention (plan-setup spec §2) without copying Strava's specific orange outright. Spent only on primary buttons, selected/active states, and the "Estimated" badge/warning treatment — never a background wash. | This saturated a color needs a real contrast check for text-on-accent (button labels) against white/near-white — verify ≥ 4.5:1 when the Tailwind token is set, don't assume it. | A cooler blue accent (the generic default) — passed over specifically because it reads as the "AI-generated demo" tell; amber differentiates and fits a running app's "effort" connotation better. |
| Surface | Near-white neutral (e.g. Tailwind `white` / `gray-50`) — **not** warm cream, **not** near-black | Every `Card` reads as an ordinary, light consumer app (matches `HomePage.tsx` today); avoids both the terminal-dark chrome being removed and the "warm cream + terracotta + serif" editorial-blog cliché being avoided. | None of note — lowest-risk pick on this palette. | A warm cream/ivory surface (usually paired with serif type) — one of the explicit clichés this revision was asked to avoid; not pursued. |
| Text | Warm dark charcoal — not pure black, and specifically not paired with a neon accent (that combination is the terminal look being removed) | Slightly warmer than pure black reads friendlier without sacrificing contrast; pairs with the neutral surface, not with the accent. | None. | Pure black (`#000`) — harsher, more "document"; not chosen. |
| Semantic — destructive/error | shadcn's default destructive-variant red, unchanged | Already in use (field/section error `Alert`s); no reason to invent a second red. | — | — |
| Semantic — info/warning (non-destructive) | Same accent family as the amber above, lighter tint, or shadcn's default info-variant `Alert` styling | Used for the goal-time-derived pace-estimate warning banner (issue #52, plan-setup spec §7.2) — needs to read as "worth knowing," not "you made an error," so it must be visually distinct from the destructive red. | — | A dedicated third hue (e.g. yellow) — considered, skipped for now to keep the palette to one accent family plus semantic red; revisit if a future screen needs more semantic color variety than "error" vs. "everything else." |

No green anywhere in the palette. If a future screen has a genuine pass/
fail or done/not-done semantic that would benefit from green (e.g. a
completed-workout state on the training calendar), that's a fresh, small,
reference-backed decision made on that screen's own spec — not something it
inherits from this doc by default.

## Icon set

**Lucide** (ISC licence). One set, used throughout. Decided — matches ADR 0002.

- Covers the training-calendar screen: `menu`, `settings`, `check`,
  `chevron-left`, `chevron-right`, `chevron-down`, `chevron-up`, `flag` (race
  day), `footprints` / `activity` (run), `moon` or `minus` (rest day),
  `calendar`, `alert-triangle` (error state).
- Covers the plan-setup screen: `alert-triangle` (reused, destructive
  `Alert`s), `info` (non-destructive `Alert`s — the non-blocking pattern in
  general, and specifically the goal-time-derived pace-estimate warning
  banner, issue #52), `check-circle` (reused from `HomePage.tsx`'s success
  state).
- Why Lucide: actively maintained fork of Feather, consistent 24px grid, a
  proper `lucide-react` package, permissive licence.
- Alternative considered: **Phosphor** — has literal `person-simple-run` /
  `sneaker` glyphs that suit a running app, and multiple weights. Slightly
  larger, less of a default in the React ecosystem. Not pursued.

## Font

**Decided (this revision).** Previously this section deferred the pick and
left "which fields get tabular figures" unstated; that ambiguity is exactly
what let the first plan-setup mockup default to monospace on every input
field. Resolved now, with the split made explicit:

- **Body / UI typeface — Figtree** (Google Fonts / Fontsource, OFL licence,
  variable weight). Used for **everything**: headings, labels, helper text,
  button copy, and **every input field**, including the plan-setup screen's
  H/M/S time inputs and the race-date input. Chosen instead of the two
  reflexive "safe" picks flagged as AI-generated-demo clichés in this
  revision's brief (Inter, Space Grotesk) — Figtree has a rounder, slightly
  warmer letterform (rounded terminals) that reads more consumer-app-
  friendly than Inter's neutral-grotesque default, while still being a
  normal, legible UI sans with a full weight range and real tabular-figure
  support if a future screen ever wants numerals set in the body face too.
  **Alternative weighed:** Inter — genuinely fine on every technical measure
  (hinting, tabular figures, weight range) but passed over specifically
  because it's become the default "this is an AI-generated app" tell;
  Figtree gives the same technical capability with a warmer personality.
- **Numeral-alignment typeface — IBM Plex Mono**, reserved **only** for the
  pace numbers in the plan-setup results table (`docs/design/
  plan-setup-flow.md` §7) and any future compact/inline reuse of that same
  data (§7.4) — never on an input field, never on body/label text anywhere.
  This is the Garmin/Strava lap-and-split-table convention (aligned digits
  in a column of comparable times) applied to our one pace-zone table, not a
  stylistic accent. **Do not** set any `Input` (date, distance select, H/M/S
  time entry) in this face — that was the specific mistake in the first
  mockup this revision corrects.

**The rule, stated once so it doesn't drift:** one body face everywhere a
person types or reads prose (including every form field); one numeral face,
confined to a column of numbers being compared against each other in an
output/results table.

## Illustration

Empty / error states only, and only if a plain layout looks unfinished. Free
sources: unDraw (recolourable), Open Peeps, Humaaans. Keep to one source.

## Deliberately custom (not from a library)

| Component | Why it's custom |
|---|---|
| Week block (collapsible header + 7 day rows / 7-column grid) | This is the product's core object and its layout (row-per-week, long-run-as-anchor, planned vs done vs today treatment) is the thing that makes the calendar ours. Built on a library disclosure/accordion primitive, but the day-row and week-grid layout is bespoke. |
| Race-day row | A pinned "finish line" milestone with countdown — no library has this; it's a styled block, low effort. |
| Weekly-summary rail (desktop) | Small bespoke stat block; trivial to build, no primitive needed. |
| `TimeInputGroup` (3× number input for H/M/S race/goal time entry) | No library primitive models "a single duration split across three fields" — assembled from `Input` + `Label` inside a `fieldset`. See `docs/design/plan-setup-flow.md` §6.2 for the format decision (three number fields over one free-text field) and §2 for why these fields use the body typeface, not the results table's numeral face. |
| `PaceZoneTable` + `lib/pace-zone-display.ts` (zone order, `formatPace`, blocked/unset copy, and — per issue #52 — the goal-derived `source` warning banner/badge copy) | The other core product object besides the week block — the direct realization of issue #14, amended by #52's goal-time-derived-fallback warning. Built on the library `Table`/`Alert`/`Badge`, but the zone ordering, pace formatting, blocked/unset microcopy, and the goal-derived warning copy are bespoke and shared via one module so a future compact/inline variant (calendar day-detail, not yet built) can't drift from this one — data-scientist (#52) specifically flagged that the `source`/warning treatment needs to travel with a zone row wherever it's rendered, not just here. See `docs/design/plan-setup-flow.md` §7.4. |
| Template radio-card list | Built on the library `RadioGroup` (keyboard/roving-tabindex behavior is the primitive); the card layout inside each item — title + distance-type + week-count metadata — is bespoke, same split as the week block. |
