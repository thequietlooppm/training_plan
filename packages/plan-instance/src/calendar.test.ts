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
  planWeekShape,
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
    expect(findToday(plan, today)).toMatchObject({ date: today, weekIndex: 9 });
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

  it("rejects an invalid injected today the same way across helpers", () => {
    for (const bad of ["2027-02-30", "nope", ""]) {
      expect(() => planState(plan, bad), bad).toThrow(RangeError);
      expect(() => currentWeek(plan, bad), bad).toThrow(RangeError);
      expect(() => findToday(plan, bad), bad).toThrow(RangeError);
    }
  });

  describe("Wednesday race (2027-04-07)", () => {
    const wed = generatePlan({ template: COMMITTED_PLAN_TEMPLATES[0]!, raceDate: "2027-04-07" });
    // Week 9 runs Thu 2027-01-28 .. Wed 2027-02-03.

    it("week boundaries follow the race weekday", () => {
      expect(currentWeek(wed, "2027-02-03")?.weekIndex).toBe(9);
      expect(currentWeek(wed, "2027-02-04")?.weekIndex).toBe(10);
      expect(findToday(wed, "2027-02-03")).toMatchObject({ weekIndex: 9 });
      expect(findToday(wed, "2027-02-04")).toMatchObject({ weekIndex: 10 });
    });

    it("weekProgress and defaultOpenWeekIndex agree at the boundary", () => {
      expect(weekProgress(wed, "2027-02-03").current).toBe(9);
      expect(defaultOpenWeekIndex(wed, "2027-02-03")).toBe(9);
      expect(weekProgress(wed, "2027-02-04").current).toBe(10);
      expect(defaultOpenWeekIndex(wed, "2027-02-04")).toBe(10);
    });

    it("countdown is unaffected", () => {
      expect(countdown(wed, "2027-04-04")).toMatchObject({ daysToRace: 3, weeks: 0, days: 3 });
    });
  });

  describe("planWeekShape", () => {
    const t = COMMITTED_PLAN_TEMPLATES[0]!;
    it.each([
      ["2027-04-04", 1, 7, [6]], // Sunday race
      ["2027-04-07", 4, 3, [2]], // Wednesday race
      ["2027-04-03", 7, 6, [5]], // Saturday race
    ])("race %s", (raceDate, first, last, longRun) => {
      expect(planWeekShape(generatePlan({ template: t, raceDate }))).toEqual({
        firstWeekday: first,
        lastWeekday: last,
        longRunWeekdays: longRun,
      });
    });
  });
});
