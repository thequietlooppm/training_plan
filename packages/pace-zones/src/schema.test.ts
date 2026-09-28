import { describe, expect, it } from "vitest";
import {
  calculatorInputSchema,
  goalTimeInputSchema,
  recentResultInputSchema,
} from "./schema.js";

describe("recentResultInputSchema", () => {
  it("accepts a plausible race result", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "10k",
      timeSeconds: 2400, // 40:00, well within 26:00..2:00:00
    });
    expect(result.success).toBe(true);
  });

  it("rejects a race time faster than the plausibility floor", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "5k",
      timeSeconds: 600, // 10:00, faster than the 12:30 floor
    });
    expect(result.success).toBe(false);
  });

  it("rejects a race time slower than the plausibility ceiling", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "5k",
      timeSeconds: 4000, // > 60:00
    });
    expect(result.success).toBe(false);
  });

  it("rejects a distance outside the closed enum", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "50k",
      timeSeconds: 12000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer timeSeconds", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "10k",
      timeSeconds: 2400.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields (strict object)", () => {
    const result = recentResultInputSchema.safeParse({
      distance: "10k",
      timeSeconds: 2400,
      runnerName: "should not be here",
    });
    expect(result.success).toBe(false);
  });
});

describe("goalTimeInputSchema", () => {
  it("accepts a plausible marathon goal", () => {
    const result = goalTimeInputSchema.safeParse({
      distance: "marathon",
      timeSeconds: 4 * 60 * 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a plausible half-marathon goal", () => {
    const result = goalTimeInputSchema.safeParse({
      distance: "half",
      timeSeconds: 2 * 60 * 60,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a distance other than marathon/half", () => {
    const result = goalTimeInputSchema.safeParse({
      distance: "10k",
      timeSeconds: 2400,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an implausible goal time", () => {
    const result = goalTimeInputSchema.safeParse({
      distance: "marathon",
      timeSeconds: 3600, // 1 hour marathon: implausible
    });
    expect(result.success).toBe(false);
  });
});

describe("calculatorInputSchema", () => {
  it("accepts recentResult only", () => {
    const result = calculatorInputSchema.safeParse({
      recentResult: { distance: "10k", timeSeconds: 2400 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts goalTime only", () => {
    const result = calculatorInputSchema.safeParse({
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts both provided together", () => {
    const result = calculatorInputSchema.safeParse({
      recentResult: { distance: "10k", timeSeconds: 2400 },
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts neither provided", () => {
    const result = calculatorInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an invalid nested recentResult", () => {
    const result = calculatorInputSchema.safeParse({
      recentResult: { distance: "5k", timeSeconds: 600 },
    });
    expect(result.success).toBe(false);
  });
});
