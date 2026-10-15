import { calculate, type CalculatorInput } from "@training-plan/pace-zones";
import {
  createStoredPlanInstance,
  generatePlan,
  type GeneratedPlan,
  type StoredPlanInstance,
} from "@training-plan/plan-instance";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { createLocalStoragePlanStore, type PlanInstanceStore } from "@/lib/plan-store";

export const TEMPLATE = COMMITTED_PLAN_TEMPLATES[0]!;

/** A stored plan for `raceDate`, built the same way the setup page builds one. */
export function makeStoredPlan(
  raceDate: string,
  id = "7f3c1a52-4a64-4c0e-9d1b-0a6a1b2c3d4e",
  calculatorInput: CalculatorInput = { goalTime: { distance: "marathon", timeSeconds: 3.5 * 3600 } },
): StoredPlanInstance {
  const result = calculate(calculatorInput);
  if (!result.ok) throw new Error("fixture calculate() failed");
  return createStoredPlanInstance({
    id,
    template: TEMPLATE,
    raceDate,
    calculatorInput,
    paceZones: result.zones,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

export function makePlan(raceDate: string): GeneratedPlan {
  return generatePlan({ template: TEMPLATE, raceDate });
}

/** A store backed by a plain object, with optional failure injection. */
export function failingStore(error = new Error("storage unavailable")): PlanInstanceStore {
  return {
    get: () => Promise.reject(error),
    save: () => Promise.reject(error),
    clear: () => Promise.reject(error),
  };
}

export function localStore(): PlanInstanceStore {
  return createLocalStoragePlanStore(window.localStorage);
}
