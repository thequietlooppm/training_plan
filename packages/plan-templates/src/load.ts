import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planTemplateSchema, type PlanTemplate } from "./schema.js";

const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

/**
 * Loads and validates every committed plan-template JSON file (see
 * `src/templates/`) through `planTemplateSchema.parse()`, so `apps/api` and
 * future consumers (#12/#13) get parsed, type-checked `PlanTemplate` values
 * rather than each reinventing `JSON.parse` + a file path — and a malformed
 * committed template throws loudly instead of shipping silently.
 */
export function loadCommittedPlanTemplates(): PlanTemplate[] {
  return readdirSync(TEMPLATES_DIR)
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) =>
      planTemplateSchema.parse(
        JSON.parse(readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8")),
      ),
    );
}
