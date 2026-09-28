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
| `Input` | `docs/design/plan-setup-flow.md` | Text/number/`type="date"` fields — race date, and the 3-field H/M/S time-entry composite (`TimeInputGroup`, custom, built from `Input` + `Label`). |
| `Label` | `docs/design/plan-setup-flow.md` | Paired with every `Input`/`Select`/`RadioGroup` item. |
| `Select` | `docs/design/plan-setup-flow.md` | Recent-result distance (6 options). |
| `RadioGroup` | `docs/design/plan-setup-flow.md` | Two uses: template picker (styled as a card list) and goal-time distance (styled as a 2-segment toggle) — same primitive, different CSS, no second dependency. |
| `Table` | `docs/design/plan-setup-flow.md` | The #14 pace-zone reference table. |
| `Alert` | `docs/design/plan-setup-flow.md` | Section-level `calculate()` errors (destructive variant) and the non-blocking "add a result or goal" hint (default/info variant). |
| `Badge` | `docs/design/plan-setup-flow.md` | Template metadata tag ("Marathon · 18 weeks"). |

Not yet adopted / not needed anywhere yet: `Popover`, `Calendar`
(`react-day-picker`) — considered for race-date entry on the plan-setup
screen and deliberately **not** used there (a native `<input type="date">`
does that one-date job without a full month-grid component); still expected
on the training-calendar screen itself, which genuinely needs a month/week
grid. `Toast`/Sonner — considered for the calendar's "marked complete"
confirmation and passed over in favor of an inline live region for v1.

## Icon set

**Lucide** (ISC licence). One set, used throughout. Decided — matches ADR 0002.

- Covers the training-calendar screen: `menu`, `settings`, `check`,
  `chevron-left`, `chevron-right`, `chevron-down`, `chevron-up`, `flag` (race
  day), `footprints` / `activity` (run), `moon` or `minus` (rest day),
  `calendar`, `alert-triangle` (error state).
- Covers the plan-setup screen: `alert-triangle` (reused, error/destructive
  `Alert`), `info` (non-blocking hint `Alert`), `check-circle` (reused from
  `HomePage.tsx`'s success state).
- Why Lucide: actively maintained fork of Feather, consistent 24px grid, a
  proper `lucide-react` package, permissive licence.
- Alternative considered: **Phosphor** — has literal `person-simple-run` /
  `sneaker` glyphs that suit a running app, and multiple weights. Slightly
  larger, less of a default in the React ecosystem. Not pursued.

## Font

**Deferred.** Numbers are the hero on both the calendar screen (mileage, week
counts, weeks-to-go) and the plan-setup results table (paces), so whatever we
choose needs **tabular figures**. Tentative shortlist, all free via Google
Fonts / Fontsource:

- **Inter** — has `font-feature-settings: "tnum"`, wide weight range, screen-tuned.
- **IBM Plex Sans** — tabular figures, a little more character.

Pick when the first real screen ships with real numeric output (the
plan-setup pace table is the first candidate) — not needed for the
hello-world scaffold, system font stack is fine there.

## Illustration

Empty / error states only, and only if a plain layout looks unfinished. Free
sources: unDraw (recolourable), Open Peeps, Humaaans. Keep to one source.

## Deliberately custom (not from a library)

| Component | Why it's custom |
|---|---|
| Week block (collapsible header + 7 day rows / 7-column grid) | This is the product's core object and its layout (row-per-week, long-run-as-anchor, planned vs done vs today treatment) is the thing that makes the calendar ours. Built on a library disclosure/accordion primitive, but the day-row and week-grid layout is bespoke. |
| Race-day row | A pinned "finish line" milestone with countdown — no library has this; it's a styled block, low effort. |
| Weekly-summary rail (desktop) | Small bespoke stat block; trivial to build, no primitive needed. |
| `TimeInputGroup` (3× number input for H/M/S race/goal time entry) | No library primitive models "a single duration split across three fields" — assembled from `Input` + `Label` inside a `fieldset`. See `docs/design/plan-setup-flow.md` §6.2 for the format decision (three number fields over one free-text field). |
| `PaceZoneTable` + `lib/pace-zone-display.ts` (zone order, `formatPace`, blocked/unset copy) | The other core product object besides the week block — the direct realization of issue #14. Built on the library `Table`, but the zone ordering, pace formatting, and blocked/unset microcopy are bespoke and shared via one module so a future compact/inline variant (calendar day-detail, not yet built) can't drift from this one. See `docs/design/plan-setup-flow.md` §7.4. |
| Template radio-card list | Built on the library `RadioGroup` (keyboard/roving-tabindex behavior is the primitive); the card layout inside each item — title + distance-type + week-count metadata — is bespoke, same split as the week block. |
