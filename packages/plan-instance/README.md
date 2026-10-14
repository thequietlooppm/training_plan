# @training-plan/plan-instance

Pure generator that turns a `PlanTemplate` + a Sunday race date into a dated
plan, plus the saved-plan schema and calendar view-model helpers. See the
"Client-side plan instance for the pre-sync slice" addendum in
`docs/decisions/0002-web-app-stack.md`.

- `src/date.ts` — dependency-free date math on `YYYY-MM-DD` strings (integer epoch days, UTC getters; never `new Date("YYYY-MM-DD")`).
- `src/validation.ts` — `validateRaceDate(raceDate, today)`: format, real date, not in the past, Sunday only.
- `src/generate.ts` — `generatePlan({ template, raceDate })`, `GENERATOR_VERSION`. Template distances used as written (FR6); `peakWeekMiles` derived from the template.
- `src/stored.ts` — saved-plan Zod schema (`schemaVersion`, `generatorVersion`, inputs, frozen pace snapshot; not the day list), `parseStoredPlanInstance` (never throws, never echoes the blob), migration chain, `materializePlan`.
- `src/calendar.ts` — week grouping, countdown, "Week N of M", today/current-week helpers. Every helper takes an injected `today`.

The package never reads the clock. `pnpm test` runs the suite under the ambient TZ, `America/Los_Angeles` and `Pacific/Auckland`.
