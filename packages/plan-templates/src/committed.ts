import { planTemplateSchema, type PlanTemplate } from "./schema.js";
import clubStyleMarathonV1 from "./templates/club-style-marathon.v1.json" with { type: "json" };

/**
 * Browser-safe (Vite-bundleable) alternative to `loadCommittedPlanTemplates()`
 * (`load.ts`), which is Node-only (`fs`, `import.meta.url`) and can't run in
 * a client bundle. `apps/web`'s template picker (#12) needs the committed
 * templates in the browser, and there's no `apps/api` template endpoint yet
 * (that's tied to #13) — so this module gets there via static, statically-
 * analyzable JSON imports instead of a runtime directory scan.
 *
 * Each imported template is still validated through `planTemplateSchema` at
 * module-load time, same as `load.ts` — a malformed committed file fails
 * loudly (throws on import) rather than shipping silently to the browser.
 *
 * `load.ts` stays exactly as-is for a future Node/`apps/api` consumer; this
 * file does not replace it.
 *
 * IMPORTANT — adding a new committed template (e.g. #10's MCR 10-mile plan)
 * requires updating BOTH:
 *   1. `src/templates/*.json` (auto-discovered by `load.ts`'s directory scan)
 *   2. This file — add the `with { type: "json" }` import and the array entry
 * `load.ts`'s `readdirSync` scan does NOT make a new template visible here;
 * see README.md for the full explanation.
 */
export const COMMITTED_PLAN_TEMPLATES: PlanTemplate[] = [
  planTemplateSchema.parse(clubStyleMarathonV1),
];
