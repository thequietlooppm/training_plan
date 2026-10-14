import type { Day, DayType, Phase, PlanTemplate, WorkoutTag } from "@training-plan/plan-templates";
import { addDays, isValidDateString, isoWeekday } from "./date.js";

/** Bump when generator output for the same inputs changes; stored in saved plans. */
export const GENERATOR_VERSION = 1;

export interface PlanInstanceDay {
  /** Local calendar date, `YYYY-MM-DD`. Natural key within a plan. */
  date: string;
  weekIndex: number;
  dayOfWeek: Day["dayOfWeek"];
  phase: Phase;
  dayType: DayType;
  description: string;
  distanceMiles?: number;
  durationMinutes?: number;
  workoutTag?: WorkoutTag;
  isRaceDay: boolean;
}

export interface PlanInstanceWeek {
  weekIndex: number;
  phase: Phase;
  isCutbackWeek: boolean;
  /** Monday. */
  startDate: string;
  /** Sunday. */
  endDate: string;
  days: PlanInstanceDay[];
}

export interface GeneratedPlan {
  templateId: string;
  templateVersion: number;
  raceDate: string;
  startDate: string;
  totalWeeks: number;
  /** Highest weekly run mileage in the template (derived, never entered). */
  peakWeekMiles: number;
  weeks: PlanInstanceWeek[];
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weeklyRunMiles(days: readonly Day[]): number {
  return round1(days.reduce((sum, d) => sum + (d.dayType === "run" ? d.distanceMiles : 0), 0));
}

export function derivePeakWeekMiles(template: PlanTemplate): number {
  return Math.max(0, ...template.weeks.map((w) => weeklyRunMiles(w.days)));
}

export interface GenerateInput {
  template: PlanTemplate;
  /** Must be a Sunday; checked structurally, not against the clock. */
  raceDate: string;
}

/**
 * Pure: same inputs, same output. Anchors by day offset from the race date:
 * `startDate = raceDate - (totalWeeks * 7 - 1)` days, so the last template day
 * lands on the race date. Distances are used as written (scalar 1.0, FR6).
 * Does not reject past dates: a short runway yields the full plan with early
 * days in the past. Paces are not baked into days; callers resolve pace
 * tokens from the frozen snapshot at display time.
 */
export function generatePlan({ template, raceDate }: GenerateInput): GeneratedPlan {
  // Structural rule (not the Sunday-only product rule in validateRaceDate):
  // the race date must fall on the weekday of the template's final day.
  if (!isValidDateString(raceDate)) throw new RangeError("Invalid race date: not a real date");
  const lastDay = template.weeks.at(-1)?.days.at(-1);
  if (!lastDay) throw new RangeError("Template has no days");
  if (isoWeekday(raceDate) !== DAY_ORDER.indexOf(lastDay.dayOfWeek) + 1) {
    throw new RangeError(`Invalid race date: must fall on the template's final weekday (${lastDay.dayOfWeek})`);
  }

  const startDate = addDays(raceDate, -(template.totalWeeks * 7 - 1));
  const weeks: PlanInstanceWeek[] = template.weeks.map((week, w) => {
    const weekStart = addDays(startDate, w * 7);
    const days: PlanInstanceDay[] = week.days.map((day, d) => {
      const date = addDays(weekStart, d);
      const out: PlanInstanceDay = {
        date,
        weekIndex: week.weekIndex,
        dayOfWeek: day.dayOfWeek,
        phase: week.phase,
        dayType: day.dayType,
        description: day.description,
        isRaceDay: date === raceDate,
      };
      if (day.dayType === "run") {
        out.distanceMiles = day.distanceMiles;
        if (day.workoutTag) out.workoutTag = day.workoutTag;
      }
      if (day.durationMinutes !== undefined) out.durationMinutes = day.durationMinutes;
      return out;
    });
    return {
      weekIndex: week.weekIndex,
      phase: week.phase,
      isCutbackWeek: week.isCutbackWeek ?? false,
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      days,
    };
  });

  return {
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    raceDate,
    startDate,
    totalWeeks: template.totalWeeks,
    peakWeekMiles: derivePeakWeekMiles(template),
    weeks,
  };
}
