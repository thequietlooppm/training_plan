import { describe, expect, it } from "vitest";
import {
  dayTitle,
  formatDateFull,
  formatDateLong,
  formatMiles,
  formatWeekRange,
  weekdayShort,
} from "@/lib/plan-date-format";

describe("plan-date-format", () => {
  it("derives weekdays from the date string", () => {
    expect(weekdayShort("2026-12-16")).toBe("Wed");
    expect(weekdayShort("2026-12-20")).toBe("Sun");
  });

  it("adds the year only when it is not the current year", () => {
    expect(formatDateLong("2026-12-16", "2026-10-14")).toBe("Wed, Dec 16");
    expect(formatDateLong("2027-01-12", "2026-10-14")).toBe("Tue, Jan 12, 2027");
  });

  it("formats week ranges, including across months", () => {
    expect(formatWeekRange("2026-10-08", "2026-10-14")).toBe("Oct 8–14");
    expect(formatWeekRange("2026-10-29", "2026-11-04")).toBe("Oct 29–Nov 4");
  });

  it("formats miles without a trailing .0", () => {
    expect(formatMiles(5)).toBe("5 mi");
    expect(formatMiles(10.5)).toBe("10.5 mi");
    expect(formatMiles(26.2)).toBe("26.2 mi");
    expect(formatMiles(32.04)).toBe("32 mi");
  });

  it("shortens a description to its leading clause", () => {
    expect(dayTitle("Group quality workout (structured track or tempo session)")).toBe(
      "Group quality workout",
    );
    expect(dayTitle("10-12 mile long run, last 4 miles at MGP")).toBe("10-12 mile long run");
    expect(dayTitle("Recovery run")).toBe("Recovery run");
    expect(dayTitle("Fartlek – 15 min warm-up")).toBe("Fartlek");
  });

  it("formats the full race date, independent of timezone", () => {
    expect(formatDateFull("2026-10-18")).toBe("Sunday, October 18, 2026");
    expect(formatDateFull("2026-01-01")).toBe("Thursday, January 1, 2026");
  });

  it("returns empty for empty, malformed, or non-existent dates", () => {
    expect(formatDateFull("")).toBe("");
    expect(formatDateFull("10/18/2026")).toBe("");
    expect(formatDateFull("2026-02-31")).toBe("");
    expect(formatDateFull("0050-01-01")).toBe("");
  });
});
