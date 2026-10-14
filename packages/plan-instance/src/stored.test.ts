import { describe, expect, it } from "vitest";
import { calculate } from "@training-plan/pace-zones";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { GENERATOR_VERSION, generatePlan } from "./generate.js";
import {
  createStoredPlanInstance,
  materializePlan,
  parseStoredPlanInstance,
  runMigrations,
  serializeStoredPlanInstance,
  storedPlanInstanceSchema,
} from "./stored.js";

const template = COMMITTED_PLAN_TEMPLATES[0]!;
const calculatorInput = { recentResult: { distance: "10k" as const, timeSeconds: 2700 } };
const calc = calculate(calculatorInput);
if (!calc.ok) throw new Error("fixture must calculate");

const stored = createStoredPlanInstance({
  id: "6f1c1f0e-5d0b-4a5e-9a39-0f6c2d7a1b11",
  template,
  raceDate: "2027-04-04",
  calculatorInput,
  paceZones: calc.zones,
  createdAt: "2026-10-14T12:00:00.000Z",
});

describe("stored plan instance", () => {
  it("has the planned shape", () => {
    expect(stored).toMatchObject({
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      raceDate: "2027-04-04",
      peakWeekMiles: 42,
      scalar: 1,
      status: "active",
    });
    expect(stored).not.toHaveProperty("weeks");
  });

  it("round-trips through serialize/parse", () => {
    const result = parseStoredPlanInstance(serializeStoredPlanInstance(stored));
    expect(result).toEqual({ status: "ok", value: stored });
  });

  it("round-trips a goal-time-only snapshot including blocked and unset zones", () => {
    const goalOnly = calculate({ goalTime: { distance: "marathon", timeSeconds: 4 * 3600 } });
    if (!goalOnly.ok) throw new Error("fixture");
    const s = createStoredPlanInstance({
      id: stored.id, template, raceDate: stored.raceDate,
      calculatorInput: { goalTime: { distance: "marathon", timeSeconds: 4 * 3600 } },
      paceZones: goalOnly.zones, createdAt: stored.createdAt,
    });
    expect(parseStoredPlanInstance(serializeStoredPlanInstance(s))).toEqual({ status: "ok", value: s });
  });

  it("regenerates identical days from the stored form", () => {
    const m = materializePlan(stored, template);
    expect(m).toEqual({ ok: true, plan: generatePlan({ template, raceDate: "2027-04-04" }) });
  });

  it("refuses to materialize on template or generator mismatch", () => {
    expect(materializePlan({ ...stored, templateVersion: 99 }, template)).toEqual({ ok: false, reason: "template_mismatch" });
    expect(materializePlan({ ...stored, generatorVersion: GENERATOR_VERSION + 1 }, template)).toEqual({
      ok: false,
      reason: "generator_version_mismatch",
    });
  });

  it("does not treat a non-Sunday race date as corruption (product rule, not a data check)", () => {
    const s = { ...stored, raceDate: "2027-04-03" }; // Saturday
    expect(parseStoredPlanInstance(JSON.stringify(s))).toEqual({ status: "ok", value: s });
  });

  it("materializePlan reports unsupported_race_date instead of throwing", () => {
    expect(materializePlan({ ...stored, raceDate: "2027-04-03" }, template)).toEqual({
      ok: false,
      reason: "unsupported_race_date",
    });
  });

  it("treats a missing value as empty", () => {
    expect(parseStoredPlanInstance(null)).toEqual({ status: "empty" });
  });

  it("flags corrupt data without throwing or echoing it", () => {
    const cases: Array<[string, string]> = [
      ["{not json", "invalid_json"],
      ["[]", "invalid_shape"],
      ["null", "invalid_shape"],
      ["{}", "invalid_shape"],
      [JSON.stringify({ ...stored, raceDate: "2027-02-30" }), "invalid_shape"],
      [JSON.stringify({ ...stored, id: "not-a-uuid" }), "invalid_shape"],
      [JSON.stringify({ ...stored, extra: 1 }), "invalid_shape"],
      [JSON.stringify({ ...stored, schemaVersion: 0 }), "invalid_shape"],
      [JSON.stringify({ ...stored, schemaVersion: 2 }), "unsupported_version"],
    ];
    for (const [raw, reason] of cases) {
      const r = parseStoredPlanInstance(raw);
      expect(r, raw).toEqual({ status: "corrupt", reason });
    }
  });

  it("rejects out-of-range pace values", () => {
    const bad = structuredClone(stored);
    bad.paceZones.easy = { state: "computed", paceSecPerMile: -5, source: "recentResult" };
    expect(storedPlanInstanceSchema.safeParse(bad).success).toBe(false);
  });
});

describe("runMigrations", () => {
  it("applies steps in order up to the target", () => {
    const calls: number[] = [];
    const out = runMigrations({ schemaVersion: 1, a: 1 }, 3, {
      1: (b) => (calls.push(1), { ...b, schemaVersion: 2, b: 2 }),
      2: (b) => (calls.push(2), { ...b, schemaVersion: 3 }),
    });
    expect(calls).toEqual([1, 2]);
    expect(out).toEqual({ schemaVersion: 3, a: 1, b: 2 });
  });

  it("is a no-op when already at target", () => {
    const blob = { schemaVersion: 2 };
    expect(runMigrations(blob, 2, {})).toBe(blob);
  });

  it("returns null when a step is missing", () => {
    expect(runMigrations({ schemaVersion: 1 }, 3, { 1: (b) => ({ ...b, schemaVersion: 2 }) })).toBeNull();
    expect(runMigrations({ schemaVersion: 1 }, 2, {})).toBeNull();
  });

  it("returns null when a step fails to advance the version", () => {
    expect(runMigrations({ schemaVersion: 1 }, 2, { 1: (b) => b })).toBeNull();
  });
});
