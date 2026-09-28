export {
  DAYS_OF_WEEK,
  DAY_TYPES,
  PHASES,
  RACE_DISTANCE_TYPES,
  WORKOUT_TAGS,
  daySchema,
  planTemplateSchema,
  weekSchema,
  type Day,
  type DayOfWeek,
  type DayType,
  type Phase,
  type PlanTemplate,
  type RaceDistanceType,
  type Week,
  type WorkoutTag,
} from "./schema.js";
export { COMMITTED_PLAN_TEMPLATES } from "./committed.js";

// `loadCommittedPlanTemplates` (Node-only: `node:fs`, `node:path`, `node:url`)
// is deliberately NOT re-exported here. This barrel is the package's default
// "." entry point, which apps/web imports for the browser-safe
// COMMITTED_PLAN_TEMPLATES — re-exporting load.js from here would drag
// node:fs into the client bundle graph and crash the page on mount (see
// README.md "Why the Node-only loader is not in the default export"). Import
// loadCommittedPlanTemplates from "@training-plan/plan-templates/load" instead.
