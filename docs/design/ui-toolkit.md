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
| ~~React~~ **(decided)** | **shadcn/ui** over Radix primitives | Gives us accordion, dialog, drawer, progress, button, toast, and a `react-day-picker` calendar — almost the entire training-calendar screen — as code we own and restyle. Accessible primitives (Radix) underneath. | Tailwind buy-in; you maintain the copied components; needs a bundler (Vite, already decided). | **Mantine** — batteries-included, own styling engine, installed as a dep rather than copied. Faster to start, heavier to escape. Not pursued. |
| ~~Framework-agnostic~~ *(moot — stack is React; kept for reference only)* | Tailwind CSS + DaisyUI | N/A — not applicable now that the stack is React. | — | — |

Screen-by-screen mapping lives in `docs/design/training-calendar.md` § Interface
detail. Scaffold-time component list for the hello-world shell (issue #5) lives
in the designer's consult response on that issue, not duplicated here.

## Icon set

**Lucide** (ISC licence). One set, used throughout. Decided — matches ADR 0002.

- Covers the training-calendar screen: `menu`, `settings`, `check`,
  `chevron-left`, `chevron-right`, `chevron-down`, `chevron-up`, `flag` (race
  day), `footprints` / `activity` (run), `moon` or `minus` (rest day),
  `calendar`, `alert-triangle` (error state).
- Why Lucide: actively maintained fork of Feather, consistent 24px grid, a
  proper `lucide-react` package, permissive licence.
- Alternative considered: **Phosphor** — has literal `person-simple-run` /
  `sneaker` glyphs that suit a running app, and multiple weights. Slightly
  larger, less of a default in the React ecosystem. Not pursued.

## Font

**Deferred.** Numbers are the hero on the calendar screen (mileage, week
counts, weeks-to-go), so whatever we choose needs **tabular figures**.
Tentative shortlist, all free via Google Fonts / Fontsource:

- **Inter** — has `font-feature-settings: "tnum"`, wide weight range, screen-tuned.
- **IBM Plex Sans** — tabular figures, a little more character.

Pick when the first real screen is built (not needed for the hello-world
scaffold — system font stack is fine there).

## Illustration

Empty / error states only, and only if a plain layout looks unfinished. Free
sources: unDraw (recolourable), Open Peeps, Humaaans. Keep to one source.

## Deliberately custom (not from a library)

| Component | Why it's custom |
|---|---|
| Week block (collapsible header + 7 day rows / 7-column grid) | This is the product's core object and its layout (row-per-week, long-run-as-anchor, planned vs done vs today treatment) is the thing that makes the calendar ours. Built on a library disclosure/accordion primitive, but the day-row and week-grid layout is bespoke. |
| Race-day row | A pinned "finish line" milestone with countdown — no library has this; it's a styled block, low effort. |
| Weekly-summary rail (desktop) | Small bespoke stat block; trivial to build, no primitive needed. |
