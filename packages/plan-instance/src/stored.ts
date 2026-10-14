import { z } from "zod";
import { calculatorInputSchema, type PaceZones } from "@training-plan/pace-zones";
import type { PlanTemplate } from "@training-plan/plan-templates";
import { isValidDateString } from "./date.js";
import { GENERATOR_VERSION, derivePeakWeekMiles, generatePlan, type GeneratedPlan } from "./generate.js";

/** Bump (and add an entry to MIGRATIONS) when the stored shape changes. */
export const STORED_SCHEMA_VERSION = 1;

const equivalencyZoneSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("computed"),
    paceSecPerMile: z.number().positive(),
    source: z.enum(["recentResult", "goalTime"]),
  }),
  z.strictObject({
    state: z.literal("blocked"),
    reason: z.enum(["noInput", "goalVdotBelowTable"]),
  }),
]);

const goalZoneSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("computed"),
    label: z.enum(["marathon", "half"]),
    paceSecPerMile: z.number().positive(),
  }),
  z.strictObject({ state: z.literal("unset") }),
]);

/** Snapshot of the computed zones, frozen at plan creation (never recomputed on load). */
export const paceZonesSnapshotSchema = z.strictObject({
  recovery: equivalencyZoneSchema,
  easy: equivalencyZoneSchema,
  threshold: equivalencyZoneSchema,
  tenK: equivalencyZoneSchema,
  fiveK: equivalencyZoneSchema,
  interval: equivalencyZoneSchema,
  goal: goalZoneSchema,
});

const dateString = z.string().refine(isValidDateString, "must be a real YYYY-MM-DD date");

/**
 * What is persisted: inputs plus frozen derived values, NOT the day list.
 * Days are regenerated on load by the pure generator (deterministic given the
 * pinned template version and `generatorVersion`). No PII: nothing here
 * identifies a person; `id` is a random UUID.
 */
export const storedPlanInstanceSchema = z.strictObject({
  schemaVersion: z.literal(STORED_SCHEMA_VERSION),
  generatorVersion: z.number().int().positive(),
  id: z.uuid(),
  templateId: z.string().min(1),
  templateVersion: z.number().int().positive(),
  raceDate: dateString,
  calculatorInput: calculatorInputSchema,
  paceZones: paceZonesSnapshotSchema,
  peakWeekMiles: z.number().positive(),
  scalar: z.literal(1),
  status: z.literal("active"),
  createdAt: z.iso.datetime(),
});

export type StoredPlanInstance = z.infer<typeof storedPlanInstanceSchema>;

export interface CreateStoredInput {
  id: string;
  template: PlanTemplate;
  raceDate: string;
  calculatorInput: z.infer<typeof calculatorInputSchema>;
  paceZones: PaceZones;
  /** ISO timestamp, injected (the package never reads the clock). */
  createdAt: string;
}

/** Builds and validates the saved form; throws ZodError on bad input. */
export function createStoredPlanInstance(input: CreateStoredInput): StoredPlanInstance {
  return storedPlanInstanceSchema.parse({
    schemaVersion: STORED_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    id: input.id,
    templateId: input.template.templateId,
    templateVersion: input.template.templateVersion,
    raceDate: input.raceDate,
    calculatorInput: input.calculatorInput,
    paceZones: input.paceZones,
    peakWeekMiles: derivePeakWeekMiles(input.template),
    scalar: 1,
    status: "active",
    createdAt: input.createdAt,
  });
}

/**
 * Ordered migration chain: `MIGRATIONS[n]` upgrades a version-n blob to n+1.
 * Empty while v1 is current.
 */
export type MigrationStep = (raw: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, MigrationStep> = {};

/**
 * Applies `migrations` in order from the blob's `schemaVersion` up to
 * `target`. Returns null if a step is missing or fails to advance the
 * version; a step that throws propagates to the caller.
 */
export function runMigrations(
  blob: Record<string, unknown>,
  target: number,
  migrations: Record<number, MigrationStep>,
): Record<string, unknown> | null {
  let current = blob;
  let version = current.schemaVersion as number;
  while (version < target) {
    const step = migrations[version];
    if (!step) return null;
    current = step(current);
    const next = current.schemaVersion;
    if (!Number.isInteger(next) || (next as number) <= version) return null;
    version = next as number;
  }
  return current;
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; value: StoredPlanInstance }
  /** Caller should move the raw value aside (never delete it) and show the empty state. */
  | { status: "corrupt"; reason: "invalid_json" | "invalid_shape" | "unsupported_version" };

/**
 * Parses a raw stored value (the string from storage, or null). Never throws
 * and never echoes the blob in its result, so callers cannot log it by accident.
 */
export function parseStoredPlanInstance(raw: string | null): LoadResult {
  if (raw === null) return { status: "empty" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: "corrupt", reason: "invalid_json" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { status: "corrupt", reason: "invalid_shape" };
  }
  const version = (data as Record<string, unknown>).schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { status: "corrupt", reason: "invalid_shape" };
  }
  if ((version as number) > STORED_SCHEMA_VERSION) {
    return { status: "corrupt", reason: "unsupported_version" };
  }
  let blob: Record<string, unknown> | null;
  try {
    blob = runMigrations(data as Record<string, unknown>, STORED_SCHEMA_VERSION, MIGRATIONS);
  } catch {
    return { status: "corrupt", reason: "invalid_shape" };
  }
  if (blob === null) return { status: "corrupt", reason: "unsupported_version" };
  const parsed = storedPlanInstanceSchema.safeParse(blob);
  return parsed.success
    ? { status: "ok", value: parsed.data }
    : { status: "corrupt", reason: "invalid_shape" };
}

export function serializeStoredPlanInstance(stored: StoredPlanInstance): string {
  return JSON.stringify(storedPlanInstanceSchema.parse(stored));
}

export type MaterializeResult =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; reason: "template_mismatch" | "generator_version_mismatch" | "unsupported_race_date" };

/**
 * Regenerates the dated days from a stored blob and the pinned template.
 * Refuses (rather than silently drifting) if the template or generator
 * version differs from what the plan was created with.
 */
export function materializePlan(stored: StoredPlanInstance, template: PlanTemplate): MaterializeResult {
  if (
    template.templateId !== stored.templateId ||
    template.templateVersion !== stored.templateVersion
  ) {
    return { ok: false, reason: "template_mismatch" };
  }
  if (stored.generatorVersion !== GENERATOR_VERSION) {
    return { ok: false, reason: "generator_version_mismatch" };
  }
  try {
    return { ok: true, plan: generatePlan({ template, raceDate: stored.raceDate }) };
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, reason: "unsupported_race_date" };
    throw e;
  }
}
