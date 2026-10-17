import { describe, expect, it } from "vitest";
import { padTwoDigits } from "./plan-setup-format";

describe("padTwoDigits", () => {
  it("only pads a single digit", () => {
    expect(padTwoDigits("7")).toBe("07");
    expect(padTwoDigits("")).toBe("");
    expect(padTwoDigits("12")).toBe("12");
  });
});
