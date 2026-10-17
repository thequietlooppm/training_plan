import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";
import { RaceDateField } from "./RaceDateField";

type FormRef = { current: UseFormReturn<PlanSetupFormValues> | null };

function Harness({ initial = "", formRef }: { initial?: string; formRef?: FormRef }) {
  const form = useForm<PlanSetupFormValues>({
    defaultValues: { raceDate: initial } as Partial<PlanSetupFormValues>,
  });
  useEffect(() => {
    if (formRef) formRef.current = form;
  });
  return (
    <FormProvider {...form}>
      <RaceDateField register={form.register} />
    </FormProvider>
  );
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

  it("describes the input by the long-date line", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Race date").getAttribute("aria-describedby")).toContain(
      "race-date-long",
    );
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

  it("renders the long form for a prefilled value", () => {
    render(<Harness initial="2026-10-18" />);
    expect(screen.getByTestId("race-date-long").textContent).toBe("Sunday, October 18, 2026");
  });

  it("follows the form on reset", () => {
    const formRef: FormRef = { current: null };
    render(<Harness initial="2026-10-18" formRef={formRef} />);
    act(() => formRef.current!.reset({ raceDate: "" } as PlanSetupFormValues));
    expect(screen.getByTestId("race-date-long").textContent).toBe("");
    act(() => formRef.current!.reset({ raceDate: "2027-03-07" } as PlanSetupFormValues));
    expect(screen.getByTestId("race-date-long").textContent).toBe("Sunday, March 7, 2027");
  });
});
