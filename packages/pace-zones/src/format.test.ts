import { describe, expect, it } from "vitest";
import { formatPace } from "./format.js";

describe("formatPace", () => {
  it("formats whole seconds with the /mi unit", () => {
    expect(formatPace(465)).toBe("7:45 /mi");
    expect(formatPace(630)).toBe("10:30 /mi");
  });

  it("zero-pads seconds", () => {
    expect(formatPace(485)).toBe("8:05 /mi");
    expect(formatPace(480)).toBe("8:00 /mi");
  });

  it("rounds the total before splitting, never producing :60", () => {
    expect(formatPace(479.6)).toBe("8:00 /mi");
    expect(formatPace(479.4)).toBe("7:59 /mi");
  });

  it("handles paces of 10 minutes or more per mile", () => {
    expect(formatPace(719.5)).toBe("12:00 /mi");
  });
});
