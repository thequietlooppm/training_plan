import { describe, expect, it } from "vitest";
import { daySchema, planTemplateSchema, weekSchema } from "./schema.js";

/**
 * Unit tests against the schema directly (not the committed template file —
 * see `templates.test.ts` for that). The committed template already satisfies
 * every rule below, so testing only against it wouldn't catch a rule being
 * silently deleted; these tests exercise the rules in isolation.
 */

const validRunDay = {
  dayOfWeek: "mon",
  dayType: "run",
  description: "Easy run",
  distanceMiles: 5,
};

const validRestDay = {
  dayOfWeek: "tue",
  dayType: "rest",
  description: "Rest day",
};

function makeWeek(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    weekIndex: 1,
    phase: "base",
    days: [
      { ...validRunDay, dayOfWeek: "mon" },
      { ...validRestDay, dayOfWeek: "tue" },
      { ...validRestDay, dayOfWeek: "wed" },
      { ...validRestDay, dayOfWeek: "thu" },
      { ...validRestDay, dayOfWeek: "fri" },
      { ...validRestDay, dayOfWeek: "sat" },
      { ...validRestDay, dayOfWeek: "sun" },
    ],
    ...overrides,
  };
}

function makePlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    templateId: "test-template",
    templateVersion: 1,
    title: "Test Template",
    raceDistanceType: "marathon",
    totalWeeks: 1,
    weeks: [makeWeek()],
    ...overrides,
  };
}

describe("daySchema", () => {
  it("accepts a valid run day", () => {
    expect(daySchema.safeParse(validRunDay).success).toBe(true);
  });

  it("accepts a valid rest day", () => {
    expect(daySchema.safeParse(validRestDay).success).toBe(true);
  });

  it("rejects a run day missing distanceMiles", () => {
    const { dayType, dayOfWeek, description } = validRunDay;
    const result = daySchema.safeParse({ dayType, dayOfWeek, description });
    expect(result.success).toBe(false);
  });

  it.each(["rest", "strength", "cross_training"] as const)(
    "rejects a %s day that has distanceMiles present",
    (dayType) => {
      const result = daySchema.safeParse({
        dayOfWeek: "tue",
        dayType,
        description: "some day",
        distanceMiles: 5,
      });
      expect(result.success).toBe(false);
    },
  );

  it.each(["rest", "strength", "cross_training"] as const)(
    "rejects a %s day that has workoutTag present",
    (dayType) => {
      const result = daySchema.safeParse({
        dayOfWeek: "tue",
        dayType,
        description: "some day",
        workoutTag: "easy",
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects a day with an unknown key", () => {
    const result = daySchema.safeParse({
      ...validRestDay,
      unexpectedField: "leftover from transcription",
    });
    expect(result.success).toBe(false);
  });
});

describe("weekSchema", () => {
  it("accepts a valid Monday-start week", () => {
    expect(weekSchema.safeParse(makeWeek()).success).toBe(true);
  });

  it("rejects a week with an unknown key", () => {
    const result = weekSchema.safeParse(makeWeek({ unexpectedField: "x" }));
    expect(result.success).toBe(false);
  });

  it("rejects days out of Monday-start order", () => {
    const week = makeWeek();
    const days = week.days as Array<Record<string, unknown>>;
    // Swap Monday and Tuesday.
    [days[0], days[1]] = [days[1], days[0]];

    const result = weekSchema.safeParse(week);
    expect(result.success).toBe(false);
  });
});

describe("planTemplateSchema", () => {
  it("accepts a valid plan", () => {
    expect(planTemplateSchema.safeParse(makePlan()).success).toBe(true);
  });

  it("rejects a plan with an unknown key", () => {
    const result = planTemplateSchema.safeParse(
      makePlan({ unexpectedField: "x" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a plan where totalWeeks does not match weeks.length", () => {
    const result = planTemplateSchema.safeParse(makePlan({ totalWeeks: 2 }));
    expect(result.success).toBe(false);
  });

  it("rejects a plan with gapped weekIndex values", () => {
    const week1 = makeWeek({ weekIndex: 1 });
    const week2 = makeWeek({ weekIndex: 3 });
    const result = planTemplateSchema.safeParse(
      makePlan({ totalWeeks: 2, weeks: [week1, week2] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a plan with out-of-order weekIndex values", () => {
    const week1 = makeWeek({ weekIndex: 2 });
    const week2 = makeWeek({ weekIndex: 1 });
    const result = planTemplateSchema.safeParse(
      makePlan({ totalWeeks: 2, weeks: [week1, week2] }),
    );
    expect(result.success).toBe(false);
  });
});
