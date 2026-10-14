import { diffDays } from "./date.js";
import type { GeneratedPlan, PlanInstanceDay, PlanInstanceWeek } from "./generate.js";

/**
 * Calendar view-model helpers. Every helper takes an injected `today`
 * (local `YYYY-MM-DD`); none reads the clock.
 */

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

export type PlanPhaseState = "not_started" | "in_progress" | "finished";

export function planState(plan: GeneratedPlan, today: string): PlanPhaseState {
  if (diffDays(today, plan.startDate) > 0) return "not_started";
  if (diffDays(plan.raceDate, today) > 0) return "finished";
  return "in_progress";
}

/** The plan day for `today`, or undefined if today is outside the plan. */
export function findToday(plan: GeneratedPlan, today: string): PlanInstanceDay | undefined {
  return findDay(plan, today);
}

/** Week containing `today`, or undefined if today is before the start or after the race. */
export function currentWeek(plan: GeneratedPlan, today: string): PlanInstanceWeek | undefined {
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
