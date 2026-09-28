import { describe, expect, it } from "vitest";
import {
  buildCalculatorInput,
  isRaceDateAtOrAfterToday,
  mapCalculateError,
  planSetupFormSchema,
  todayLocalDateString,
  type PlanSetupFormValues,
} from "@/lib/plan-setup-validation";

const baseValues: PlanSetupFormValues = {
  templateId: "club-style-marathon",
  raceDate: "2099-01-01",
  recentResultDistance: "",
  recentResultHours: "",
  recentResultMinutes: "",
  recentResultSeconds: "",
  goalTimeDistance: "",
  goalTimeHours: "",
  goalTimeMinutes: "",
  goalTimeSeconds: "",
};

describe("isRaceDateAtOrAfterToday (FR7 boundary)", () => {
  const reference = new Date(2026, 8, 27); // 2026-09-27, local time

  it("allows a race date of exactly today", () => {
    expect(isRaceDateAtOrAfterToday("2026-09-27", reference)).toBe(true);
  });

  it("rejects a race date of yesterday", () => {
    expect(isRaceDateAtOrAfterToday("2026-09-26", reference)).toBe(false);
  });

  it("allows a race date in the future", () => {
    expect(isRaceDateAtOrAfterToday("2026-12-31", reference)).toBe(true);
  });

  it("todayLocalDateString formats using local year/month/day, zero-padded", () => {
    expect(todayLocalDateString(reference)).toBe("2026-09-27");
  });
});

describe("planSetupFormSchema — race date", () => {
  it("rejects a past race date with the FR7 copy", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      raceDate: "2000-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const raceDateIssue = result.error.issues.find(
        (issue) => issue.path.join(".") === "raceDate",
      );
      expect(raceDateIssue?.message).toBe("Race date can't be in the past.");
    }
  });

  it("accepts today and future race dates", () => {
    expect(planSetupFormSchema.safeParse(baseValues).success).toBe(true);
  });
});

describe("planSetupFormSchema — incomplete section checks", () => {
  it("rejects a recent-result distance with no time entered", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      recentResultDistance: "10k",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "recentResultHours",
      );
      expect(issue?.message).toBe(
        "Enter a time for your recent result, or clear the distance.",
      );
    }
  });

  it("rejects a recent-result time with no distance selected", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      recentResultMinutes: "45",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "recentResultDistance",
      );
      expect(issue?.message).toBe("Select a distance for your recent race result.");
    }
  });

  it("rejects a goal-time distance with no time entered", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      goalTimeDistance: "half",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "goalTimeHours");
      expect(issue?.message).toBe("Enter a time for your goal time, or clear the distance.");
    }
  });

  it("rejects a goal-time time with no distance selected", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      goalTimeSeconds: "30",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "goalTimeDistance",
      );
      expect(issue?.message).toBe("Select a distance for your goal time.");
    }
  });

  it("allows both recent-result and goal-time fully empty (a valid, allowed submission)", () => {
    expect(planSetupFormSchema.safeParse(baseValues).success).toBe(true);
  });

  it("allows a fully-filled recent-result section", () => {
    const result = planSetupFormSchema.safeParse({
      ...baseValues,
      recentResultDistance: "10k",
      recentResultMinutes: "45",
      recentResultSeconds: "0",
    });
    expect(result.success).toBe(true);
  });
});

describe("buildCalculatorInput", () => {
  it("omits recentResult/goalTime when their distance is blank", () => {
    expect(buildCalculatorInput(baseValues)).toEqual({
      recentResult: undefined,
      goalTime: undefined,
    });
  });

  it("converts H/M/S strings to total seconds, defaulting blank fields to 0", () => {
    const input = buildCalculatorInput({
      ...baseValues,
      recentResultDistance: "10k",
      recentResultHours: "",
      recentResultMinutes: "45",
      recentResultSeconds: "30",
      goalTimeDistance: "marathon",
      goalTimeHours: "3",
      goalTimeMinutes: "30",
      goalTimeSeconds: "",
    });

    expect(input.recentResult).toEqual({ distance: "10k", timeSeconds: 45 * 60 + 30 });
    expect(input.goalTime).toEqual({ distance: "marathon", timeSeconds: 3 * 3600 + 30 * 60 });
  });
});

describe("mapCalculateError (design spec §6.4)", () => {
  it("maps recentResult.timeSeconds to the recent-result time field group", () => {
    expect(
      mapCalculateError({ path: "recentResult.timeSeconds", message: "m" }),
    ).toEqual({ kind: "field", field: "recentResultHours", message: "m" });
  });

  it("maps recentResult.distance to the recent-result distance field", () => {
    expect(
      mapCalculateError({ path: "recentResult.distance", message: "m" }),
    ).toEqual({ kind: "field", field: "recentResultDistance", message: "m" });
  });

  it("maps a bare recentResult path to the recent-result section alert", () => {
    expect(mapCalculateError({ path: "recentResult", message: "m" })).toEqual({
      kind: "section",
      section: "recentResult",
      message: "m",
    });
  });

  it("maps goalTime.timeSeconds to the goal-time time field group", () => {
    expect(
      mapCalculateError({ path: "goalTime.timeSeconds", message: "m" }),
    ).toEqual({ kind: "field", field: "goalTimeHours", message: "m" });
  });

  it("maps goalTime.distance to the goal-time distance field", () => {
    expect(
      mapCalculateError({ path: "goalTime.distance", message: "m" }),
    ).toEqual({ kind: "field", field: "goalTimeDistance", message: "m" });
  });

  it("maps a bare goalTime path to the goal-time section alert", () => {
    expect(mapCalculateError({ path: "goalTime", message: "m" })).toEqual({
      kind: "section",
      section: "goalTime",
      message: "m",
    });
  });

  it("maps any unrecognized path to 'unknown' (routed to the summary alert)", () => {
    expect(mapCalculateError({ path: "templateId", message: "m" })).toEqual({
      kind: "unknown",
      message: "m",
    });
  });
});
