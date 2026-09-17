# UI toolkit — running list

> Owned by `@designer`. The short list of what we've adopted for standard UI, so
> basic elements are reused, not hand-built. Update on first use of anything new.
> Nothing here is locked until the web stack ADR (`docs/decisions/0002-web-app-stack.md`)
> is Accepted — until then, recommendations are framed by framework.

## Status: proposed, pending ADR 0002

No stack decision yet, so no library is installed. This file records the
**intended** picks and the reasoning, for whoever scaffolds `apps/web/`.

## Component library

| If the stack is… | Pick | Why | Cost | Alternative to weigh |
|---|---|---|---|---|
| React | **shadcn/ui** (MIT, copy-in) over Radix primitives | Gives us accordion, dialog, drawer, progress, button, toast, and a `react-day-picker` calendar — almost the entire training-calendar screen — as code we own and restyle. Accessible primitives (Radix) underneath. | Tailwind buy-in; you maintain the copied components; needs a bundler. | **Mantine** — batteries-included, own styling engine, installed as a dep rather than copied. Faster to start, heavier to escape. |
| Framework-agnostic (Vue, Svelte, plain, htmx, etc.) | **Tailwind CSS + DaisyUI** for component classes; hand-roll disclosure with native `<details>` | No JS framework lock-in; DaisyUI covers buttons/cards/progress/modal styling. | DaisyUI has a visual opinion to override; complex widgets (drawer, focus-trapped sheet) still need real JS. | **Pico.css** — near-zero-config semantic styling; too thin for the sheet/drawer interaction, would need custom JS anyway. |

Screen-by-screen mapping lives in `docs/design/training-calendar.md` § Interface detail.

## Icon set

**Lucide** (ISC licence). One set, used throughout.

- Covers this screen: `menu`, `settings`, `check`, `chevron-left`, `chevron-right`,
  `chevron-down`, `chevron-up`, `flag` (race day), `footprints` / `activity` (run),
  `moon` or `minus` (rest day), `calendar`, `alert-triangle` (error state).
- Why Lucide: actively maintained fork of Feather, consistent 24px grid, framework
  packages for React/Vue/Svelte plus a plain SVG sprite, permissive licence.
- Alternative worth considering: **Phosphor** — has literal `person-simple-run` /
  `sneaker` glyphs that suit a running app, and multiple weights. Slightly larger,
  less of a default in the React ecosystem.

## Font

**Deferred.** Numbers are the hero on this screen (mileage, week counts,
weeks-to-go), so whatever we choose needs **tabular figures**. Tentative shortlist,
all free via Google Fonts / Fontsource:

- **Inter** — has `font-feature-settings: "tnum"`, wide weight range, screen-tuned.
- **IBM Plex Sans** — tabular figures, a little more character.

Pick when the first real screen is built.

## Illustration

Empty / error states only, and only if a plain layout looks unfinished. Free
sources: unDraw (recolourable), Open Peeps, Humaaans. Keep to one source.

## Deliberately custom (not from a library)

| Component | Why it's custom |
|---|---|
| Week block (collapsible header + 7 day rows / 7-column grid) | This is the product's core object and its layout (row-per-week, long-run-as-anchor, planned vs done vs today treatment) is the thing that makes the calendar ours. Built on a library disclosure/accordion primitive, but the day-row and week-grid layout is bespoke. |
| Race-day row | A pinned "finish line" milestone with countdown — no library has this; it's a styled block, low effort. |
| Weekly-summary rail (desktop) | Small bespoke stat block; trivial to build, no primitive needed. |
