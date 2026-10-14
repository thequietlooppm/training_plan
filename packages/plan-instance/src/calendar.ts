import { diffDays, isValidDateString, isoWeekday } from "./date.js";
import type { GeneratedPlan, PlanInstanceDay, PlanInstanceWeek } from "./generate.js";

/**
 * Calendar view-model helpers. Every helper takes an injected `today`
 * (local `YYYY-MM-DD`); none reads the clock.
 */

function assertDate(today: string): void {
  if (!isValidDateString(today)) throw new RangeError(`Invalid calendar date: ${today}`);
}

export function groupByWeek(plan: GeneratedPlan): PlanInstanceWeek[] {
  return plan.weeks;
}

export function findDay(plan: GeneratedPlan, date: string): PlanInstanceDay | undefined {
  for (const week of plan.weeks) {
    const day = week.days.find((d) => d.date === date);
    if (day) return day;
  }
  return undefined;
}

/** Planned miles for a plan week (run days only, race day included), rounded to 1 decimal. */
export function weekPlannedMiles(week: PlanInstanceWeek): number {
  return Math.round(week.days.reduce((sum, d) => sum + (d.distanceMiles ?? 0), 0) * 10) / 10;
}

export type PlanPhaseState = "not_started" | "in_progress" | "finished";

export function planState(plan: GeneratedPlan, today: string): PlanPhaseState {
  if (diffDays(today, plan.startDate) > 0) return "not_started";
  if (diffDays(plan.raceDate, today) > 0) return "finished";
  return "in_progress";
}

/** The plan day for `today`, or undefined if today is outside the plan. */
export function findToday(plan: GeneratedPlan, today: string): PlanInstanceDay | undefined {
  assertDate(today);
  return findDay(plan, today);
}

/** Week containing `today`, or undefined if today is before the start or after the race. */
export function currentWeek(plan: GeneratedPlan, today: string): PlanInstanceWeek | undefined {
  assertDate(today);
  return plan.weeks.find((w) => today >= w.startDate && today <= w.endDate);
}

/**
 * Which week to open by default: the current week, or week 1 if the plan has
 * not started, or the final week once it has finished.
 */
export function defaultOpenWeekIndex(plan: GeneratedPlan, today: string): number {
  const state = planState(plan, today);
  if (state === "not_started") return 1;
  if (state === "finished") return plan.totalWeeks;
  return currentWeek(plan, today)?.weekIndex ?? 1;
}

export interface WeekProgress {
  /** Clamped to 1..total. */
  current: number;
  total: number;
  label: string;
}

/** "Week N of M" with N clamped into range before the start and after the race. */
export function weekProgress(plan: GeneratedPlan, today: string): WeekProgress {
  const total = plan.totalWeeks;
  const current = Math.min(total, Math.max(1, currentWeek(plan, today)?.weekIndex ?? (planState(plan, today) === "finished" ? total : 1)));
  return { current, total, label: `Week ${current} of ${total}` };
}

export interface Countdown {
  /** Whole days until race day; 0 on race day; negative once passed. */
  daysToRace: number;
  /** Whole weeks (floor) and leftover days; both 0 on/after race day. */
  weeks: number;
  days: number;
  isRaceDay: boolean;
  isPast: boolean;
}

export function countdown(plan: GeneratedPlan, today: string): Countdown {
  const daysToRace = diffDays(today, plan.raceDate);
  const remaining = Math.max(0, daysToRace);
  return {
    daysToRace,
    weeks: Math.floor(remaining / 7),
    days: remaining % 7,
    isRaceDay: daysToRace === 0,
    isPast: daysToRace < 0,
  };
}

export interface PlanWeekShape {
  /** ISO weekday (1 = Mon ... 7 = Sun) of the first day of each plan week. */
  firstWeekday: number;
  /** ISO weekday of the last day of each plan week (the race weekday). */
  lastWeekday: number;
  /** Sorted, distinct ISO weekdays on which `long_run` days fall. */
  longRunWeekdays: number[];
}

/** Derived from dates and workout tags only; for headers and week layout. */
export function planWeekShape(plan: GeneratedPlan): PlanWeekShape {
  const first = plan.weeks[0];
  if (!first) throw new RangeError("Plan has no weeks");
  const longRun = new Set<number>();
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.workoutTag === "long_run") longRun.add(isoWeekday(day.date));
    }
  }
  return {
    firstWeekday: isoWeekday(first.startDate),
    lastWeekday: isoWeekday(first.endDate),
    longRunWeekdays: [...longRun].sort((a, b) => a - b),
  };
}
