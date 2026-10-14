import { describe, expect, it } from "vitest";
import { COMMITTED_PLAN_TEMPLATES, planTemplateSchema } from "@training-plan/plan-templates";
import { addDays, diffDays, isoWeekday } from "./date.js";
import { GENERATOR_VERSION, derivePeakWeekMiles, generatePlan } from "./generate.js";

const template = COMMITTED_PLAN_TEMPLATES[0]!;

describe("generatePlan (committed template)", () => {
  const raceDate = "2027-04-04"; // Sunday; plan spans DST changes and a year boundary
  const plan = generatePlan({ template, raceDate });
  const allDays = plan.weeks.flatMap((w) => w.days);

  it("produces totalWeeks * 7 consecutive days", () => {
    expect(plan.weeks).toHaveLength(template.totalWeeks);
    expect(allDays).toHaveLength(template.totalWeeks * 7);
    allDays.forEach((d, i) => expect(d.date).toBe(addDays(plan.startDate, i)));
  });

  it("starts on a Monday and ends on the race date", () => {
    expect(isoWeekday(plan.startDate)).toBe(1);
    expect(plan.startDate).toBe(addDays(raceDate, -(template.totalWeeks * 7 - 1)));
    expect(allDays.at(-1)!.date).toBe(raceDate);
    expect(allDays.filter((d) => d.isRaceDay).map((d) => d.date)).toEqual([raceDate]);
    plan.weeks.forEach((w) => {
      expect(isoWeekday(w.startDate)).toBe(1);
      expect(isoWeekday(w.endDate)).toBe(7);
    });
  });

  it("keeps template day order and weekday alignment", () => {
    allDays.forEach((d) => {
      expect(["mon", "tue", "wed", "thu", "fri", "sat", "sun"][isoWeekday(d.date) - 1]).toBe(d.dayOfWeek);
    });
  });

  it("derives peak week = 42 mi from the template", () => {
    expect(plan.peakWeekMiles).toBe(42);
    expect(derivePeakWeekMiles(template)).toBe(42);
  });

  it("carries distance only on run days and uses template distances as written", () => {
    allDays.forEach((d) => {
      if (d.dayType !== "run") expect(d.distanceMiles).toBeUndefined();
      else expect(d.distanceMiles).toBeGreaterThan(0);
    });
    expect(allDays.at(-1)).toMatchObject({ dayType: "run", distanceMiles: 26.2, isRaceDay: true });
  });

  it("is deterministic", () => {
    expect(generatePlan({ template, raceDate })).toEqual(plan);
    expect(JSON.stringify(generatePlan({ template, raceDate }))).toBe(JSON.stringify(plan));
  });

  it("does not mutate the template", () => {
    const before = JSON.stringify(template);
    generatePlan({ template, raceDate });
    expect(JSON.stringify(template)).toBe(before);
  });

  it("spans month, year and DST edges with exact dates", () => {
    expect(plan.startDate).toBe("2026-11-30");
    expect(allDays.some((d) => d.date === "2026-12-31")).toBe(true);
    expect(allDays.some((d) => d.date === "2027-01-01")).toBe(true);
    expect(allDays.map((d) => d.date)).toContain("2027-03-14");
    expect(new Set(allDays.map((d) => d.date)).size).toBe(allDays.length);
  });

  it("handles a leap day inside the plan", () => {
    const p = generatePlan({ template, raceDate: "2028-03-05" });
    const dates = p.weeks.flatMap((w) => w.days.map((d) => d.date));
    expect(dates).toContain("2028-02-29");
    expect(dates.indexOf("2028-03-01") - dates.indexOf("2028-02-29")).toBe(1);
    expect(diffDays(p.startDate, p.raceDate)).toBe(template.totalWeeks * 7 - 1);
  });

  it("generates the full plan for a short runway (early days in the past)", () => {
    const p = generatePlan({ template, raceDate: "2027-04-04" });
    expect(p.weeks).toHaveLength(18); // independent of any "today"
  });

  it("rejects non-Sunday and invalid race dates", () => {
    expect(() => generatePlan({ template, raceDate: "2027-04-03" })).toThrow(RangeError);
    expect(() => generatePlan({ template, raceDate: "nope" })).toThrow(RangeError);
  });

  it("exposes a generator version", () => {
    expect(GENERATOR_VERSION).toBe(1);
  });
});

describe("generatePlan (small fixture)", () => {
  const fixture = planTemplateSchema.parse({
    templateId: "fx",
    templateVersion: 1,
    title: "Fixture",
    raceDistanceType: "marathon",
    totalWeeks: 1,
    weeks: [
      {
        weekIndex: 1,
        phase: "taper",
        isCutbackWeek: true,
        days: [
          { dayOfWeek: "mon", dayType: "rest", description: "Rest" },
          { dayOfWeek: "tue", dayType: "strength", description: "Lift" },
          { dayOfWeek: "wed", dayType: "cross_training", description: "Bike", durationMinutes: 45 },
          { dayOfWeek: "thu", dayType: "run", description: "Easy", distanceMiles: 4, workoutTag: "easy" },
          { dayOfWeek: "fri", dayType: "rest", description: "Rest" },
          { dayOfWeek: "sat", dayType: "run", description: "Shake", distanceMiles: 2.5 },
          { dayOfWeek: "sun", dayType: "run", description: "Race", distanceMiles: 13.1, workoutTag: "race_pace" },
        ],
      },
    ],
  });

  it("maps day types, durations and flags", () => {
    const p = generatePlan({ template: fixture, raceDate: "2027-03-14" });
    expect(p.startDate).toBe("2027-03-08");
    expect(p.peakWeekMiles).toBe(19.6);
    const w = p.weeks[0]!;
    expect(w.isCutbackWeek).toBe(true);
    expect(w.days[2]).toMatchObject({ dayType: "cross_training", durationMinutes: 45, date: "2027-03-10" });
    expect(w.days[2]!.distanceMiles).toBeUndefined();
    expect(w.days[3]).toMatchObject({ workoutTag: "easy", distanceMiles: 4 });
  });
});
