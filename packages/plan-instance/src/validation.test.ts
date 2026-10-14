import { describe, expect, it } from "vitest";
import { validateRaceDate } from "./validation.js";

const TODAY = "2027-03-10"; // Wednesday

describe("validateRaceDate", () => {
  it("accepts a future Sunday", () => {
    expect(validateRaceDate("2027-04-04", TODAY)).toEqual({ ok: true, raceDate: "2027-04-04" });
  });

  it("accepts today when today is a Sunday", () => {
    expect(validateRaceDate("2027-03-14", "2027-03-14").ok).toBe(true);
  });

  it("rejects past dates", () => {
    const r = validateRaceDate("2027-03-07", TODAY); // a Sunday, but past
    expect(r.ok === false && r.error.code).toBe("in_past");
  });

  it("rejects non-Sundays", () => {
    const r = validateRaceDate("2027-04-03", TODAY);
    expect(r.ok === false && r.error.code).toBe("not_sunday");
  });

  it("rejects malformed and non-existent dates", () => {
    const f = validateRaceDate("04/04/2027", TODAY);
    expect(f.ok === false && f.error.code).toBe("invalid_format");
    const d = validateRaceDate("2027-02-30", TODAY);
    expect(d.ok === false && d.error.code).toBe("invalid_date");
  });
});
