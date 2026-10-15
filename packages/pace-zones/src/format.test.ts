import { describe, expect, it, vi } from "vitest";
import {
  PLAUSIBILITY_BOUNDS_SECONDS,
  calculate,
  calculatorInputSchema,
  describeValidationError,
  formatDuration,
} from "./index.js";
import type { GoalDistance, RecentResultDistance, ValidationError } from "./index.js";

const FORBIDDEN = /timeSeconds|\bseconds\b|VDOT|\d{4,}/i;

function errorsFor(input: unknown): ValidationError[] {
  const r = calculate(input);
  if (r.ok) throw new Error("expected failure");
  return r.errors;
}

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [60, "1:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [7260, "2:01:00"],
    [-5, "0:00"],
    [Number.NaN, "0:00"],
  ])("%d -> %s", (s, out) => expect(formatDuration(s)).toBe(out));
});

describe("describeValidationError", () => {
  it("recent result too fast", () => {
    const [e] = errorsFor({ recentResult: { distance: "5k", timeSeconds: 660 } });
    expect(e).toMatchObject({
      code: "result_time_implausible",
      field: "recentResult",
      distance: "5k",
      valueSeconds: 660,
      minSeconds: 750,
      maxSeconds: 3600,
    });
    expect(describeValidationError(e!)).toBe("A 5K time of 11:00 must be between 12:30 and 1:00:00.");
  });

  it("goal time too fast", () => {
    const [e] = errorsFor({ goalTime: { distance: "marathon", timeSeconds: 6600 } });
    expect(e!.code).toBe("goal_time_implausible");
    expect(e!.field).toBe("goalTime");
    expect(describeValidationError(e!)).toBe(
      "A marathon goal time of 1:50:00 must be between 2:01:00 and 8:00:00.",
    );
  });

  it("half marathon label", () => {
    const [e] = errorsFor({ goalTime: { distance: "half", timeSeconds: 3000 } });
    expect(describeValidationError(e!)).toBe(
      "A half marathon goal time of 50:00 must be between 58:00 and 5:00:00.",
    );
  });

  it("below the VDOT floor", () => {
    const [e] = errorsFor({ recentResult: { distance: "marathon", timeSeconds: 8 * 3600 } });
    expect(e).toMatchObject({
      code: "result_below_vdot_floor",
      field: "recentResult",
      distance: "marathon",
      valueSeconds: 28800,
    });
    expect(e!.message).toMatch(/VDOT/);
    expect(describeValidationError(e!)).toBe(
      "That time is slower than our pace tables cover. Try a more recent or longer race result.",
    );
  });

  it("other zod issues map to invalid_input", () => {
    const [e] = errorsFor({ recentResult: { distance: "5k", timeSeconds: -1 } });
    expect(e!.code).toBe("invalid_input");
    expect(describeValidationError(e!)).toBe("Check this time and try again.");
    expect(errorsFor({ bogus: 1 })[0]!.code).toBe("invalid_input");
  });

  it("ignores malformed issue params", () => {
    const bad = {
      success: false as const,
      error: {
        issues: [
          { code: "custom", message: "real", path: ["x"], params: { code: 5, path: "evil", message: "evil" } },
        ],
      },
    };
    const spy = vi.spyOn(calculatorInputSchema, "safeParse").mockReturnValueOnce(bad as never);
    const [e] = errorsFor({});
    spy.mockRestore();
    expect(e).toEqual({ path: "x", message: "real", code: "invalid_input" });
  });

  it("params cannot overwrite path or message", () => {
    const hostile = {
      success: false as const,
      error: {
        issues: [
          {
            code: "custom",
            message: "real",
            path: ["x"],
            params: { code: "goal_time_implausible", path: "evil", message: "evil" },
          },
        ],
      },
    };
    const spy = vi.spyOn(calculatorInputSchema, "safeParse").mockReturnValueOnce(hostile as never);
    const [e] = errorsFor({});
    spy.mockRestore();
    expect(e).toMatchObject({ path: "x", message: "real", code: "goal_time_implausible" });
  });

  it("falls back when data is missing", () => {
    expect(describeValidationError({ path: "", message: "x", code: "goal_time_implausible" })).toBe(
      "Check this time and try again.",
    );
  });

  it("never leaks raw seconds at every bound edge", () => {
    for (const [d, b] of Object.entries(PLAUSIBILITY_BOUNDS_SECONDS)) {
      for (const t of [b.min - 1, b.max + 1]) {
        const recent = errorsFor({
          recentResult: { distance: d as RecentResultDistance, timeSeconds: t },
        });
        expect(describeValidationError(recent[0]!)).not.toMatch(FORBIDDEN);
        if (d === "half" || d === "marathon") {
          const goal = errorsFor({ goalTime: { distance: d as GoalDistance, timeSeconds: t } });
          expect(describeValidationError(goal[0]!)).not.toMatch(FORBIDDEN);
        }
      }
    }
  });
});
