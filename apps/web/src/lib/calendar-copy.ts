import { countdown, type GeneratedPlan } from "@training-plan/plan-instance";
import { formatDateLong } from "@/lib/plan-date-format";

/** The countdown `<h1>` copy (spec §A "Countdown copy"). */
export function countdownHeading(plan: GeneratedPlan, today: string): string {
  const c = countdown(plan, today);
  if (c.isPast) return `Race day was ${formatDateLong(plan.raceDate, today)}`;
  if (c.isRaceDay) return "Race day is today";
  if (c.daysToRace <= 6) return "Race week";
  return c.weeks === 1 ? "1 week to race day" : `${c.weeks} weeks to race day`;
}
