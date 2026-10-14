import { describe, expect, it } from "vitest";
import { COMMITTED_PLAN_TEMPLATES, planTemplateSchema } from "@training-plan/plan-templates";
import { addDays, diffDays, isoWeekday } from "./date.js";
import { weeklyRunMiles } from "./generate.js";
import { GENERATOR_VERSION, derivePeakWeekMiles, generatePlan } from "./generate.js";

const template = COMMITTED_PLAN_TEMPLATES[0]!;

describe("generatePlan (committed template)", () => {
  const raceDate = "2027-04-04"; // Sunday (weeks are Mon-Sun); plan spans DST changes and a year boundary
  const plan = generatePlan({ template, raceDate });
  const allDays = plan.weeks.flatMap((w) => w.days);

  it("produces totalWeeks * 7 consecutive days", () => {
    expect(plan.weeks).toHaveLength(template.totalWeeks);
    expect(allDays).toHaveLength(template.totalWeeks * 7);
    allDays.forEach((d, i) => expect(d.date).toBe(addDays(plan.startDate, i)));
  });

  it("Sunday race: Monday-start weeks", () => {
    expect(isoWeekday(plan.startDate)).toBe(1);
    expect(plan.startDate).toBe(addDays(raceDate, -(template.totalWeeks * 7 - 1)));
    expect(allDays.at(-1)!.date).toBe(raceDate);
    expect(allDays.filter((d) => d.isRaceDay).map((d) => d.date)).toEqual([raceDate]);
    plan.weeks.forEach((w) => {
      expect(isoWeekday(w.startDate)).toBe(1);
      expect(isoWeekday(w.endDate)).toBe(7);
    });
  });

  it("keeps template slot order via the race-weekday rotation and carries no dayOfWeek", () => {
    const rotation = isoWeekday(plan.startDate); // Sunday race: Monday start
    allDays.forEach((d, i) => {
      expect("dayOfWeek" in d).toBe(false);
      expect(((rotation - 1 + (i % 7)) % 7) + 1).toBe(isoWeekday(d.date));
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

  it("rejects invalid race dates", () => {
    expect(() => generatePlan({ template, raceDate: "nope" })).toThrow(RangeError);
    expect(() => generatePlan({ template, raceDate: "2027-02-30" })).toThrow(RangeError);
  });

  it.each([
    "2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02", "2027-04-03", "2027-04-04",
  ])("any-weekday race %s", (rd) => {
    const p = generatePlan({ template, raceDate: rd });
    const days = p.weeks.flatMap((w) => w.days);
    expect(days).toHaveLength(126);
    days.forEach((d, i) => expect(d.date).toBe(addDays(p.startDate, i)));
    expect(days.at(-1)!.date).toBe(rd);
    expect(days.filter((d) => d.isRaceDay)).toHaveLength(1);
    expect(isoWeekday(p.startDate)).toBe((isoWeekday(rd) % 7) + 1);
    p.weeks.forEach((w) => {
      expect(isoWeekday(w.endDate)).toBe(isoWeekday(rd));
      expect(diffDays(w.startDate, w.endDate)).toBe(6);
    });
    const longRun = (wk: number) => p.weeks[wk - 1]!.days.find((d) => d.workoutTag === "long_run")!.date;
    expect(diffDays(longRun(16), rd)).toBe(15);
    expect(diffDays(longRun(17), rd)).toBe(8);
    const at = (off: number) => days.find((d) => d.date === addDays(rd, off))!;
    expect(at(-1)).toMatchObject({ dayType: "run", distanceMiles: 3 });
    expect(at(-2).dayType).toBe("rest");
    expect(at(-3).dayType).toBe("rest");
    p.weeks.forEach((w, i) => {
      expect(weeklyRunMiles(template.weeks[i]!.days)).toBe(
        Math.round(w.days.reduce((s, d) => s + (d.distanceMiles ?? 0), 0) * 10) / 10,
      );
    });
    expect(p.peakWeekMiles).toBe(42);
  });

  it("a Saturday race equals the Sunday plan shifted by -1 day", () => {
    const sun = generatePlan({ template, raceDate: "2027-04-04" });
    const sat = generatePlan({ template, raceDate: "2027-04-03" });
    const shift = (p: typeof sun) => ({
      ...p,
      raceDate: addDays(p.raceDate, -1),
      startDate: addDays(p.startDate, -1),
      weeks: p.weeks.map((w) => ({
        ...w,
        startDate: addDays(w.startDate, -1),
        endDate: addDays(w.endDate, -1),
        days: w.days.map((d) => ({ ...d, date: addDays(d.date, -1), isRaceDay: d.isRaceDay })),
      })),
    });
    expect(sat).toEqual(shift(sun));
  });

  it("Saturday race across a year boundary and Feb 29 2028", () => {
    const p = generatePlan({ template, raceDate: "2028-04-01" });
    expect(isoWeekday("2028-04-01")).toBe(6);
    expect(p.startDate).toBe(addDays("2028-04-01", -125));
    const dates = p.weeks.flatMap((w) => w.days.map((d) => d.date));
    expect(dates).toContain("2028-02-29");
    expect(dates).toContain("2028-01-01");
    expect(dates).toContain("2027-12-31");
    expect(new Set(dates).size).toBe(126);
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
    const p = generatePlan({ template: fixture, raceDate: "2027-03-17" }); // Wednesday
    expect(p.startDate).toBe("2027-03-11");
    expect(p.peakWeekMiles).toBe(19.6);
    const w = p.weeks[0]!;
    expect(w.isCutbackWeek).toBe(true);
    expect(w.days[2]).toMatchObject({ dayType: "cross_training", durationMinutes: 45, date: "2027-03-13" });
    expect(w.days[2]!.distanceMiles).toBeUndefined();
    expect(w.days[3]).toMatchObject({ workoutTag: "easy", distanceMiles: 4 });
  });
});
