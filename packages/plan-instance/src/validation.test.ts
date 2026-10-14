import { describe, expect, it } from "vitest";
import { validateRaceDate } from "./validation.js";

const TODAY = "2027-03-10"; // Wednesday

describe("validateRaceDate", () => {
  it.each(["2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02", "2027-04-03", "2027-04-04"])(
    "accepts a future date on any weekday (%s)",
    (d) => {
      expect(validateRaceDate(d, TODAY)).toEqual({ ok: true, raceDate: d });
    },
  );

  it("accepts today", () => {
    expect(validateRaceDate("2027-03-10", "2027-03-10").ok).toBe(true);
  });

  it("rejects past dates", () => {
    const r = validateRaceDate("2027-03-07", TODAY); // a Sunday, but past
    expect(r.ok === false && r.error.code).toBe("in_past");
  });

  it("rejects malformed and non-existent dates", () => {
    const f = validateRaceDate("04/04/2027", TODAY);
    expect(f.ok === false && f.error.code).toBe("invalid_format");
    const d = validateRaceDate("2027-02-30", TODAY);
    expect(d.ok === false && d.error.code).toBe("invalid_date");
  });
});
