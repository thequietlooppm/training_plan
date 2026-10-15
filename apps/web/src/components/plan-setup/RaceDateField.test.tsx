import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";
import { RaceDateField } from "./RaceDateField";

function Harness() {
  const { register } = useForm<PlanSetupFormValues>();
  return <RaceDateField register={register} />;
}

afterEach(cleanup);

describe("RaceDateField", () => {
  it("keeps the native date input, labelled, with responsive width", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Race date") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.className).toContain("w-full");
    expect(input.className).toContain("min-w-0");
    expect(input.className).toContain("max-w-[14rem]");
  });

  it("shows an empty polite live line, then the long form once a date is chosen", () => {
    render(<Harness />);
    const line = screen.getByTestId("race-date-long");
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.textContent).toBe("");
    fireEvent.change(screen.getByLabelText("Race date"), { target: { value: "2026-10-18" } });
    expect(line.textContent).toBe("Sunday, October 18, 2026");
    fireEvent.change(screen.getByLabelText("Race date"), { target: { value: "" } });
    expect(line.textContent).toBe("");
  });
});
