import { z } from "zod";

/**
 * Zod schemas for the two inputs `calculate()` accepts: a recent race
 * result (used to derive VDOT and, from it, the six equivalency zones) and
 * a goal time (used to derive the single goal-pace zone directly, with no
 * VDOT involved). See `calculator.ts` for the algorithm and
 * `docs` reference in `vdotTable.ts` for where the equivalency numbers come
 * from.
 *
 * Zod is used here — on the *inputs* — because #12 feeds this loosely-typed
 * form values. The output (`PaceZones` in `calculator.ts`) is produced by
 * trusted code, not parsed from an untrusted source, so it is a plain
 * TypeScript type, not a Zod schema.
 */

/**
 * Closed set of distances a "recent race result" can be reported at. Matches
 * Daniels' calibration range and the two existing plan templates' distances
 * — avoids reasoning about extrapolation for an oddball distance.
 */
export const RECENT_RESULT_DISTANCES = [
  "5k",
  "10k",
  "15k",
  "10_mile",
  "half",
  "marathon",
] as const;
export type RecentResultDistance = (typeof RECENT_RESULT_DISTANCES)[number];

/** Goal-time distance is restricted to Marathon | Half, per FR3. */
export const GOAL_DISTANCES = ["half", "marathon"] as const;
export type GoalDistance = (typeof GOAL_DISTANCES)[number];

/** Race distance, in meters, for every distance either input can use. */
export const DISTANCE_METERS: Record<RecentResultDistance, number> = {
  "5k": 5000,
  "10k": 10000,
  "15k": 15000,
  "10_mile": 16093.44, // 10 * 1609.344
  half: 21097.5, // official half-marathon distance
  marathon: 42195, // official marathon distance
};

/**
 * Plausibility bounds per distance: reject a reported/goal time outside
 * this range before any zone math runs. This is a real safety control, not
 * just input hygiene — an unvalidated fast typo would put an impossible
 * Interval/Threshold pace on screen that a runner could actually attempt.
 * Shared by both the recent-result and goal-time schemas for marathon/half,
 * so the two inputs are held to the same plausibility standard.
 */
export const PLAUSIBILITY_BOUNDS_SECONDS: Record<
  RecentResultDistance,
  { min: number; max: number }
> = {
  "5k": { min: 12 * 60 + 30, max: 60 * 60 }, // 12:30 .. 60:00
  "10k": { min: 26 * 60, max: 2 * 60 * 60 }, // 26:00 .. 2:00:00
  "15k": { min: 40 * 60, max: 3 * 60 * 60 }, // 40:00 .. 3:00:00
  "10_mile": { min: 44 * 60, max: 3 * 60 * 60 + 30 * 60 }, // 44:00 .. 3:30:00
  half: { min: 58 * 60, max: 5 * 60 * 60 }, // 58:00 .. 5:00:00
  marathon: { min: 2 * 60 * 60 + 60, max: 8 * 60 * 60 }, // 2:01:00 .. 8:00:00
};

const recentResultShape = z.strictObject({
  distance: z.enum(RECENT_RESULT_DISTANCES),
  timeSeconds: z.number().int().positive(),
});

export const recentResultInputSchema = recentResultShape.superRefine(
  (input, ctx) => {
    const bounds = PLAUSIBILITY_BOUNDS_SECONDS[input.distance];
    if (input.timeSeconds < bounds.min || input.timeSeconds > bounds.max) {
      ctx.addIssue({
        code: "custom",
        message: `timeSeconds for '${input.distance}' must be between ${bounds.min} and ${bounds.max} seconds (implausible race time)`,
        path: ["timeSeconds"],
      });
    }
  },
);
export type RecentResultInput = z.infer<typeof recentResultShape>;

const goalTimeShape = z.strictObject({
  distance: z.enum(GOAL_DISTANCES),
  timeSeconds: z.number().int().positive(),
});

export const goalTimeInputSchema = goalTimeShape.superRefine((input, ctx) => {
  const bounds = PLAUSIBILITY_BOUNDS_SECONDS[input.distance];
  if (input.timeSeconds < bounds.min || input.timeSeconds > bounds.max) {
    ctx.addIssue({
      code: "custom",
      message: `timeSeconds for goal distance '${input.distance}' must be between ${bounds.min} and ${bounds.max} seconds (implausible goal time)`,
      path: ["timeSeconds"],
    });
  }
});
export type GoalTimeInput = z.infer<typeof goalTimeShape>;

/**
 * Top-level input to `calculate()`. Both fields are optional and
 * independent: providing only `recentResult` computes the six equivalency
 * zones and leaves `goal` unset (FR4); providing only `goalTime` computes
 * the goal zone and leaves the six equivalency zones blocked (FR5);
 * providing both computes all seven; providing neither is valid and leaves
 * everything blocked/unset (no data to reject, just none to compute from).
 */
export const calculatorInputSchema = z.strictObject({
  recentResult: recentResultInputSchema.optional(),
  goalTime: goalTimeInputSchema.optional(),
});
export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
