import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import { TimeInputGroup } from "./TimeInputGroup";

type V = { h: string; m: string; s: string };

function Harness({ errorMessage }: { errorMessage?: string }) {
  const { register } = useForm<V>({ defaultValues: { h: "", m: "", s: "" } });
  return (
    <TimeInputGroup<V>
      legend="Goal time"
      idPrefix="t"
      hoursName="h"
      minutesName="m"
      secondsName="s"
      register={register}
      errorMessage={errorMessage}
    />
  );
}

afterEach(cleanup);

describe("TimeInputGroup", () => {
  it("exposes labelled numeric text fields in a fieldset with a legend", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Goal time" })).toBeTruthy();
    for (const label of ["Hours", "Minutes", "Seconds"]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.type).toBe("text");
      expect(input.getAttribute("inputmode")).toBe("numeric");
      expect(input.getAttribute("pattern")).toBe("[0-9]*");
      expect(input.maxLength).toBe(2);
    }
  });

  it("keeps the leading zero as typed and pads single-digit MM/SS on blur", () => {
    render(<Harness />);
    const minutes = screen.getByLabelText("Minutes") as HTMLInputElement;
    const seconds = screen.getByLabelText("Seconds") as HTMLInputElement;
    const hours = screen.getByLabelText("Hours") as HTMLInputElement;
    fireEvent.change(minutes, { target: { value: "07" } });
    expect(minutes.value).toBe("07");
    fireEvent.change(seconds, { target: { value: "5" } });
    fireEvent.blur(seconds);
    expect(seconds.value).toBe("05");
    fireEvent.change(hours, { target: { value: "3" } });
    fireEvent.blur(hours);
    expect(hours.value).toBe("3");
  });

  it("wraps at narrow widths and uses no fixed-width container", () => {
    const { container } = render(<Harness />);
    const row = container.querySelector("fieldset > div") as HTMLElement;
    expect(row.className).toContain("flex-wrap");
    expect(row.className).not.toMatch(/\bw-/);
    const input = screen.getByLabelText("Minutes");
    expect(input.className).toContain("min-w-[3.25rem]");
    expect(input.className).toContain("tabular-nums");
  });

  it("links the error message to every field", () => {
    render(<Harness errorMessage="Bad" />);
    expect(screen.getByRole("alert").id).toBe("t-time-error");
    for (const label of ["Hours", "Minutes", "Seconds"]) {
      expect(screen.getByLabelText(label).getAttribute("aria-describedby")).toBe("t-time-error");
    }
  });

  it("is reachable by keyboard focus in natural tab order", () => {
    render(<Harness />);
    const hours = screen.getByLabelText("Hours");
    hours.focus();
    expect(document.activeElement).toBe(hours);
    expect(hours.tabIndex).toBe(0);
  });
});
