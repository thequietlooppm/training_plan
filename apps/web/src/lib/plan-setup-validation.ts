import {
  GOAL_DISTANCES,
  RECENT_RESULT_DISTANCES,
  type CalculatorInput,
  type ValidationError,
} from "@training-plan/pace-zones";
import { z } from "zod";

/**
 * The web-only form schema + validation helpers for #12's plan-setup page.
 * This wraps the H/M/S-to-seconds transform and the template/race-date
 * fields; the actual math/plausibility check is `calculate()`'s own job
 * (`@training-plan/pace-zones`) — this module never re-validates a distance
 * enum or a plausibility bound, since `calculate()` already does that on
 * the shaped `recentResult`/`goalTime` it hands off.
 */

/** Raw, string-valued form state — every field is a controlled input's
 * literal value before any numeric conversion. */
export interface PlanSetupFormValues {
  templateId: string;
  raceDate: string;
  recentResultDistance: "" | (typeof RECENT_RESULT_DISTANCES)[number];
  recentResultHours: string;
  recentResultMinutes: string;
  recentResultSeconds: string;
  goalTimeDistance: "" | (typeof GOAL_DISTANCES)[number];
  goalTimeHours: string;
  goalTimeMinutes: string;
  goalTimeSeconds: string;
}

export const PLAN_SETUP_DEFAULT_VALUES: Omit<PlanSetupFormValues, "templateId" | "raceDate"> =
  {
    recentResultDistance: "",
    recentResultHours: "",
    recentResultMinutes: "",
    recentResultSeconds: "",
    goalTimeDistance: "",
    goalTimeHours: "",
    goalTimeMinutes: "",
    goalTimeSeconds: "",
  };

/**
 * Returns `YYYY-MM-DD` for the given date in the *browser's local* calendar
 * day (not UTC) — matches what a native `<input type="date">` produces, so
 * string comparison against it is exact with no timezone conversion.
 */
export function todayLocalDateString(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * FR7: a race date of today is allowed; anything before today is rejected.
 * Deliberately a plain string comparison (both sides are already
 * `YYYY-MM-DD`) rather than `new Date(raceDate)` — parsing a bare date
 * string as UTC and comparing against a local "now" is exactly the
 * off-by-one-day timezone bug this avoids.
 */
export function isRaceDateAtOrAfterToday(
  raceDate: string,
  reference: Date = new Date(),
): boolean {
  return raceDate >= todayLocalDateString(reference);
}

function isNonNegativeIntWithinRange(value: string, max: number): boolean {
  return value === "" || (/^\d+$/.test(value) && Number(value) <= max);
}

const hoursField = z
  .string()
  .refine((value) => isNonNegativeIntWithinRange(value, 23), {
    message: "Hours must be a whole number between 0 and 23.",
  });
const minutesField = z
  .string()
  .refine((value) => isNonNegativeIntWithinRange(value, 59), {
    message: "Minutes must be a whole number between 0 and 59.",
  });
const secondsField = z
  .string()
  .refine((value) => isNonNegativeIntWithinRange(value, 59), {
    message: "Seconds must be a whole number between 0 and 59.",
  });

/**
 * The full plan-setup form schema. Cross-field checks (FR7, and the
 * "distance filled but time blank"/vice-versa incomplete-section rule from
 * design spec §5.3/§5.4) are `superRefine` issues targeted at specific field
 * paths, so `zodResolver` wires them straight onto the matching RHF field —
 * no separate error-state bookkeeping needed for these.
 */
export const planSetupFormSchema = z
  .object({
    templateId: z.string().min(1, "Select a plan."),
    raceDate: z.string().min(1, "Race date is required."),
    recentResultDistance: z.union([z.literal(""), z.enum(RECENT_RESULT_DISTANCES)]),
    recentResultHours: hoursField,
    recentResultMinutes: minutesField,
    recentResultSeconds: secondsField,
    goalTimeDistance: z.union([z.literal(""), z.enum(GOAL_DISTANCES)]),
    goalTimeHours: hoursField,
    goalTimeMinutes: minutesField,
    goalTimeSeconds: secondsField,
  })
  .superRefine((values, ctx) => {
    if (values.raceDate && !isRaceDateAtOrAfterToday(values.raceDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["raceDate"],
        message: "Race date can't be in the past.",
      });
    }

    const recentResultHasDistance = values.recentResultDistance !== "";
    const recentResultHasAnyTime =
      values.recentResultHours !== "" ||
      values.recentResultMinutes !== "" ||
      values.recentResultSeconds !== "";
    if (recentResultHasDistance && !recentResultHasAnyTime) {
      ctx.addIssue({
        code: "custom",
        path: ["recentResultHours"],
        message: "Enter a time for your recent result, or clear the distance.",
      });
    } else if (!recentResultHasDistance && recentResultHasAnyTime) {
      ctx.addIssue({
        code: "custom",
        path: ["recentResultDistance"],
        message: "Select a distance for your recent race result.",
      });
    }

    const goalTimeHasDistance = values.goalTimeDistance !== "";
    const goalTimeHasAnyTime =
      values.goalTimeHours !== "" ||
      values.goalTimeMinutes !== "" ||
      values.goalTimeSeconds !== "";
    if (goalTimeHasDistance && !goalTimeHasAnyTime) {
      ctx.addIssue({
        code: "custom",
        path: ["goalTimeHours"],
        message: "Enter a time for your goal time, or clear the distance.",
      });
    } else if (!goalTimeHasDistance && goalTimeHasAnyTime) {
      ctx.addIssue({
        code: "custom",
        path: ["goalTimeDistance"],
        message: "Select a distance for your goal time.",
      });
    }
  });

function hmsToSeconds(hours: string, minutes: string, seconds: string): number {
  const h = hours === "" ? 0 : Number(hours);
  const m = minutes === "" ? 0 : Number(minutes);
  const s = seconds === "" ? 0 : Number(seconds);
  return h * 3600 + m * 60 + s;
}

/**
 * Shapes validated form values into `calculate()`'s own input contract.
 * Only called after `planSetupFormSchema` has already confirmed each
 * touched section is fully filled or fully empty — so "distance present"
 * is a reliable signal for "this section was filled in."
 */
export function buildCalculatorInput(values: PlanSetupFormValues): CalculatorInput {
  const recentResult =
    values.recentResultDistance === ""
      ? undefined
      : {
          distance: values.recentResultDistance,
          timeSeconds: hmsToSeconds(
            values.recentResultHours,
            values.recentResultMinutes,
            values.recentResultSeconds,
          ),
        };

  const goalTime =
    values.goalTimeDistance === ""
      ? undefined
      : {
          distance: values.goalTimeDistance,
          timeSeconds: hmsToSeconds(
            values.goalTimeHours,
            values.goalTimeMinutes,
            values.goalTimeSeconds,
          ),
        };

  return { recentResult, goalTime };
}

/** Which form field (or section) a `calculate()`-returned error maps to,
 * per design spec §6.4. */
export type MappedCalculateError =
  | { kind: "field"; field: "recentResultHours" | "recentResultDistance" | "goalTimeHours" | "goalTimeDistance"; message: string }
  | { kind: "section"; section: "recentResult" | "goalTime"; message: string }
  | { kind: "unknown"; message: string };

/**
 * Maps a single `calculate()` `ValidationError` to a display location, per
 * the table in design spec §6.4. This is new glue code with no repo
 * precedent — a naming mismatch here would silently drop an error, hence
 * its own direct test (see `plan-setup-validation.test.ts`).
 */
export function mapCalculateError(error: ValidationError): MappedCalculateError {
  switch (error.path) {
    case "recentResult.timeSeconds":
      return { kind: "field", field: "recentResultHours", message: error.message };
    case "recentResult.distance":
      return { kind: "field", field: "recentResultDistance", message: error.message };
    case "recentResult":
      return { kind: "section", section: "recentResult", message: error.message };
    case "goalTime.timeSeconds":
      return { kind: "field", field: "goalTimeHours", message: error.message };
    case "goalTime.distance":
      return { kind: "field", field: "goalTimeDistance", message: error.message };
    case "goalTime":
      return { kind: "section", section: "goalTime", message: error.message };
    default:
      return { kind: "unknown", message: error.message };
  }
}
