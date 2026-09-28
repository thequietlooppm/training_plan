import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMMITTED_PLAN_TEMPLATES } from "./committed.js";

const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

// This module intentionally has no `fs` dependency at runtime (it has to
// stay browser-safe/Vite-bundleable) — but the test file isn't shipped to
// the browser, so it's free to scan disk to guard against the exact footgun
// this file exists to flag: a new template JSON landing in src/templates/
// without a matching static import + array entry in committed.ts.
const templateFileCount = readdirSync(TEMPLATES_DIR).filter((filename) =>
  filename.endsWith(".json"),
).length;

describe("COMMITTED_PLAN_TEMPLATES", () => {
  it("exposes exactly one entry per committed template file on disk", () => {
    // If this fails, it means src/templates/ gained (or lost) a file without
    // committed.ts's static imports being updated to match — see the
    // IMPORTANT note in committed.ts and the README for why this can't be
    // caught any other way without reintroducing an `fs` dependency into a
    // browser-safe module.
    expect(COMMITTED_PLAN_TEMPLATES.length).toBe(templateFileCount);
  });

  it("includes the club-style-marathon template", () => {
    const templateIds = COMMITTED_PLAN_TEMPLATES.map((t) => t.templateId);
    expect(templateIds).toContain("club-style-marathon");
  });

  it("every entry is already a parsed, valid PlanTemplate", () => {
    for (const template of COMMITTED_PLAN_TEMPLATES) {
      expect(template.templateId).toBeTruthy();
      expect(template.templateVersion).toBeGreaterThan(0);
      expect(template.weeks.length).toBe(template.totalWeeks);
    }
  });
});
