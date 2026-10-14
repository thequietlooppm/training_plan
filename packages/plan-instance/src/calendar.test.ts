import { describe, expect, it } from "vitest";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import {
  countdown,
  currentWeek,
  defaultOpenWeekIndex,
  findDay,
  findToday,
  groupByWeek,
  planState,
  weekProgress,
} from "./calendar.js";
import { generatePlan } from "./generate.js";

const plan = generatePlan({ template: COMMITTED_PLAN_TEMPLATES[0]!, raceDate: "2027-04-04" });
// startDate 2026-11-30; week 9 starts 2027-01-25

describe("calendar helpers", () => {
  it("groups by week", () => {
    expect(groupByWeek(plan)).toHaveLength(18);
    expect(groupByWeek(plan)[0]!.days).toHaveLength(7);
  });

  it("finds today and the current week mid-plan", () => {
    const today = "2027-01-27"; // Wednesday of week 9
    expect(findToday(plan, today)).toMatchObject({ date: today, weekIndex: 9, dayOfWeek: "wed" });
    expect(currentWeek(plan, today)?.weekIndex).toBe(9);
    expect(weekProgress(plan, today)).toEqual({ current: 9, total: 18, label: "Week 9 of 18" });
    expect(defaultOpenWeekIndex(plan, today)).toBe(9);
    expect(planState(plan, today)).toBe("in_progress");
  });

  it("handles a plan that has not started", () => {
    const today = "2026-11-01";
    expect(planState(plan, today)).toBe("not_started");
    expect(findToday(plan, today)).toBeUndefined();
    expect(currentWeek(plan, today)).toBeUndefined();
    expect(weekProgress(plan, today).label).toBe("Week 1 of 18");
    expect(defaultOpenWeekIndex(plan, today)).toBe(1);
  });

  it("handles a plan that has finished", () => {
    const today = "2027-04-10";
    expect(planState(plan, today)).toBe("finished");
    expect(weekProgress(plan, today).label).toBe("Week 18 of 18");
    expect(defaultOpenWeekIndex(plan, today)).toBe(18);
  });

  it("treats first and last plan days as in progress", () => {
    expect(planState(plan, plan.startDate)).toBe("in_progress");
    expect(planState(plan, plan.raceDate)).toBe("in_progress");
    expect(weekProgress(plan, plan.raceDate).label).toBe("Week 18 of 18");
  });

  it("finds days by date", () => {
    expect(findDay(plan, "2027-04-04")?.isRaceDay).toBe(true);
    expect(findDay(plan, "2030-01-01")).toBeUndefined();
  });

  it("counts down across DST and month boundaries", () => {
    expect(countdown(plan, "2027-03-13")).toEqual({
      daysToRace: 22, weeks: 3, days: 1, isRaceDay: false, isPast: false,
    });
    expect(countdown(plan, "2027-04-04")).toMatchObject({ daysToRace: 0, weeks: 0, days: 0, isRaceDay: true });
    expect(countdown(plan, "2027-04-06")).toMatchObject({ daysToRace: -2, weeks: 0, days: 0, isPast: true });
  });

  it("covers a mid-cycle join (race under 18 weeks away)", () => {
    const today = "2027-03-01";
    expect(planState(plan, today)).toBe("in_progress");
    expect(weekProgress(plan, today).current).toBe(14);
  });
});
