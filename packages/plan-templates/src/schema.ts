import { z } from "zod";

/**
 * Zod schema for hand-authored plan templates (see docs/decisions/0005-plan-template-schema.md).
 *
 * A template is a versioned, generic training-plan skeleton — week-by-week,
 * day-by-day — that gets personalized into a real plan instance later (#13).
 * It is not a plan instance itself: no dates, no user, no PII.
 */

export const RACE_DISTANCE_TYPES = ["marathon", "ten_mile"] as const;
export type RaceDistanceType = (typeof RACE_DISTANCE_TYPES)[number];

export const PHASES = ["base", "build", "peak", "taper"] as const;
export type Phase = (typeof PHASES)[number];

export const DAYS_OF_WEEK = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_TYPES = ["run", "rest", "strength", "cross_training"] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const WORKOUT_TAGS = [
  "long_run",
  "quality",
  "recovery",
  "easy",
  "race_pace",
] as const;
export type WorkoutTag = (typeof WORKOUT_TAGS)[number];

/**
 * Day level.
 *
 * A discriminated union on `dayType`, rather than one flat optional-field
 * object, so the shape itself — not a hand-written `.superRefine()` — rules
 * out nonsensical combinations: `distanceMiles`/`workoutTag` genuinely don't
 * exist on the `rest`/`strength`/`cross_training` variants' types, and
 * `distanceMiles` is a required (not optional) `number` on `run` days. This
 * also means consumers (plan-instance volume math in #13) get real type
 * narrowing from `if (day.dayType === "run")` instead of `day.distanceMiles!`
 * or `?? 0`.
 *
 * `workoutTag` is hand-set at transcription time, never parsed out of
 * `description`.
 */
const dayBase = {
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  description: z.string().min(1),
  durationMinutes: z.number().positive().optional(),
};

export const daySchema = z.discriminatedUnion("dayType", [
  z.strictObject({
    ...dayBase,
    dayType: z.literal("run"),
    distanceMiles: z.number().positive(),
    workoutTag: z.enum(WORKOUT_TAGS).optional(),
  }),
  z.strictObject({
    ...dayBase,
    dayType: z.literal("rest"),
  }),
  z.strictObject({
    ...dayBase,
    dayType: z.literal("strength"),
  }),
  z.strictObject({
    ...dayBase,
    dayType: z.literal("cross_training"),
  }),
]);

export type Day = z.infer<typeof daySchema>;

/**
 * Week level. Exactly 7 days, Monday-start, in `DAYS_OF_WEEK` order — a
 * defensive, explicit rule rather than relying on authoring convention,
 * since #13 anchors "race day = Sunday of the final week" positionally on
 * this ordering.
 */
const weekShape = z.strictObject({
  weekIndex: z.number().int().positive(),
  phase: z.enum(PHASES),
  isCutbackWeek: z.boolean().optional(),
  days: z.array(daySchema).length(7),
});

export const weekSchema = weekShape.superRefine((week, ctx) => {
  week.days.forEach((day, index) => {
    if (day.dayOfWeek !== DAYS_OF_WEEK[index]) {
      ctx.addIssue({
        code: "custom",
        message: `days[${index}] must be '${DAYS_OF_WEEK[index]}' (Monday-start order), got '${day.dayOfWeek}'`,
        path: ["days", index, "dayOfWeek"],
      });
    }
  });
});

export type Week = z.infer<typeof weekShape>;

/**
 * Plan level. `weeks` is forward-indexed 1..totalWeeks from plan start (not
 * a race countdown — the countdown is trivially `totalWeeks - weekIndex`).
 */
const planTemplateShape = z.strictObject({
  templateId: z.string().min(1),
  templateVersion: z.number().int().positive(),
  title: z.string().min(1),
  raceDistanceType: z.enum(RACE_DISTANCE_TYPES),
  totalWeeks: z.number().int().positive(),
  weeks: z.array(weekSchema),
});

export const planTemplateSchema = planTemplateShape.superRefine((plan, ctx) => {
  if (plan.weeks.length !== plan.totalWeeks) {
    ctx.addIssue({
      code: "custom",
      message: `totalWeeks (${plan.totalWeeks}) must match weeks.length (${plan.weeks.length})`,
      path: ["totalWeeks"],
    });
  }

  plan.weeks.forEach((week, index) => {
    const expectedWeekIndex = index + 1;
    if (week.weekIndex !== expectedWeekIndex) {
      ctx.addIssue({
        code: "custom",
        message: `weeks[${index}].weekIndex must be ${expectedWeekIndex} (weeks are forward-indexed 1..totalWeeks with no gaps), got ${week.weekIndex}`,
        path: ["weeks", index, "weekIndex"],
      });
    }
  });
});

export type PlanTemplate = z.infer<typeof planTemplateShape>;
