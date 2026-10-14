import { describe, expect, it } from "vitest";
import { addDays, diffDays, fromEpochDay, isoWeekday, toEpochDay } from "./date.js";

// The package.json test script runs this file under UTC, America/Los_Angeles
// and Pacific/Auckland. These tests must give identical answers in all three.
describe("timezone harness", () => {
  it("runs under the requested TZ", () => {
    if (process.env.TZ) {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
    }
  });
});

describe("toEpochDay / fromEpochDay", () => {
  it("round-trips and anchors the epoch", () => {
    expect(toEpochDay("1970-01-01")).toBe(0);
    expect(fromEpochDay(0)).toBe("1970-01-01");
    expect(fromEpochDay(toEpochDay("2028-02-29")!)).toBe("2028-02-29");
  });

  it("rejects malformed and non-existent dates", () => {
    for (const bad of ["2027-02-29", "2027-13-01", "2027-00-10", "2027-04-31", "2027-1-1", "", "abc", "2027-03-14T00:00"]) {
      expect(toEpochDay(bad), bad).toBeNull();
    }
  });

  it("accepts leap days only in leap years", () => {
    expect(toEpochDay("2028-02-29")).not.toBeNull();
    expect(toEpochDay("2100-02-29")).toBeNull();
    expect(toEpochDay("2000-02-29")).not.toBeNull();
  });
});

describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("is exact across DST transitions in any timezone", () => {
    // US spring forward / fall back, NZ DST end / start.
    expect(addDays("2027-03-13", 1)).toBe("2027-03-14");
    expect(addDays("2027-03-14", 1)).toBe("2027-03-15");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2027-04-03", 1)).toBe("2027-04-04");
    expect(addDays("2027-09-25", 1)).toBe("2027-09-26");
    expect(addDays("2027-03-13", 7)).toBe("2027-03-20");
    // Walking a full year day by day never skips or repeats.
    let d = "2027-01-01";
    for (let i = 0; i < 365; i++) d = addDays(d, 1);
    expect(d).toBe("2028-01-01");
  });
});

describe("diffDays", () => {
  it("counts whole days across DST and leap years", () => {
    expect(diffDays("2027-03-13", "2027-03-15")).toBe(2);
    expect(diffDays("2027-04-03", "2027-04-05")).toBe(2);
    expect(diffDays("2028-02-28", "2028-03-01")).toBe(2);
    expect(diffDays("2027-02-28", "2027-03-01")).toBe(1);
    expect(diffDays("2027-05-01", "2027-04-01")).toBe(-30);
  });

  it("throws on invalid input rather than returning NaN", () => {
    expect(() => diffDays("2027-02-30", "2027-03-01")).toThrow(RangeError);
  });
});

describe("isoWeekday", () => {
  it("knows known weekdays", () => {
    expect(isoWeekday("2027-03-14")).toBe(7); // Sunday, US DST start
    expect(isoWeekday("2027-03-15")).toBe(1);
    expect(isoWeekday("2028-02-29")).toBe(2); // Tuesday
  });
});
