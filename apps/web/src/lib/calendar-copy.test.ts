import { describe, expect, it } from "vitest";
import { countdownHeading } from "@/lib/calendar-copy";
import { makePlan } from "@/test-fixtures";

describe("countdownHeading", () => {
  const plan = makePlan("2026-12-20");
  it.each([
    ["2026-10-14", "9 weeks to race day"],
    ["2026-12-13", "1 week to race day"],
    ["2026-12-14", "Race week"],
    ["2026-12-20", "Race day is today"],
    ["2026-12-25", "Race day was Sun, Dec 20"],
  ])("on %s reads %s", (today, expected) => {
    expect(countdownHeading(plan, today)).toBe(expected);
  });
});
