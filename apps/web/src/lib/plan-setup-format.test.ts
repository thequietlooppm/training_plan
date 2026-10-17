import { describe, expect, it } from "vitest";
import { formatLongDate, padTwoDigits } from "./plan-setup-format";

describe("formatLongDate", () => {
  it("formats a calendar date with weekday, independent of timezone", () => {
    expect(formatLongDate("2026-10-18")).toBe("Sunday, October 18, 2026");
    expect(formatLongDate("2026-01-01")).toBe("Thursday, January 1, 2026");
  });
  it("returns empty for empty, malformed, or non-existent dates", () => {
    expect(formatLongDate("")).toBe("");
    expect(formatLongDate("10/18/2026")).toBe("");
    expect(formatLongDate("2026-02-31")).toBe("");
  });
});

describe("padTwoDigits", () => {
  it("only pads a single digit", () => {
    expect(padTwoDigits("7")).toBe("07");
    expect(padTwoDigits("")).toBe("");
    expect(padTwoDigits("12")).toBe("12");
  });
});
