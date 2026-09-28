import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlanSetupPage } from "@/pages/PlanSetupPage";

// jsdom has no ResizeObserver; Radix's RadioGroup (template picker,
// goal-time distance toggle) uses one internally to size its indicator.
// A minimal no-op stub is enough — layout measurement isn't under test.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

vi.mock("@training-plan/pace-zones", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@training-plan/pace-zones")>();
  return {
    ...actual,
    // Wraps (rather than replaces) the real implementation, so these tests
    // exercise the actual VDOT/plausibility logic end-to-end while still
    // letting us assert exactly what `calculate()` was called with — per
    // the plan, this suite treats `calculate()` as a black box for its
    // *math*, not for whether it was wired up with the right shape.
    calculate: vi.fn(actual.calculate),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function futureDateString(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function setRaceDate(value: string) {
  fireEvent.change(document.getElementById("race-date")!, {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Calculate my pace zones" }));
}

function fillGoalTime({
  distance,
  hours,
  minutes,
  seconds,
}: {
  distance: "half" | "marathon";
  hours?: string;
  minutes?: string;
  seconds?: string;
}) {
  fireEvent.click(
    screen.getByRole("radio", { name: distance === "half" ? "Half" : "Marathon" }),
  );
  if (hours !== undefined) {
    fireEvent.change(document.getElementById("goal-time-hours")!, {
      target: { value: hours },
    });
  }
  if (minutes !== undefined) {
    fireEvent.change(document.getElementById("goal-time-minutes")!, {
      target: { value: minutes },
    });
  }
  if (seconds !== undefined) {
    fireEvent.change(document.getElementById("goal-time-seconds")!, {
      target: { value: seconds },
    });
  }
}

describe("PlanSetupPage — template picker", () => {
  it("renders exactly COMMITTED_PLAN_TEMPLATES.length options", () => {
    render(<PlanSetupPage />);

    const planGroup = screen.getByRole("group", { name: "Plan" });
    expect(within(planGroup).getAllByRole("radio")).toHaveLength(
      COMMITTED_PLAN_TEMPLATES.length,
    );
  });
});

describe("PlanSetupPage — FR7 race date", () => {
  it("rejects a past race date with an inline error and never calls calculate()", async () => {
    const { calculate } = await import("@training-plan/pace-zones");
    render(<PlanSetupPage />);

    setRaceDate("2000-01-01");
    submit();

    await waitFor(() => {
      expect(screen.getByText("Race date can't be in the past.")).toBeDefined();
    });
    expect(calculate).not.toHaveBeenCalled();
  });
});

describe("PlanSetupPage — incomplete section (client-side, §5.3/§5.4)", () => {
  it("shows an inline error when a goal-time distance is picked but no time is entered", async () => {
    const { calculate } = await import("@training-plan/pace-zones");
    render(<PlanSetupPage />);

    setRaceDate(futureDateString());
    fireEvent.click(screen.getByRole("radio", { name: "Half" }));
    submit();

    await waitFor(() => {
      expect(
        screen.getByText("Enter a time for your goal time, or clear the distance."),
      ).toBeDefined();
    });
    expect(calculate).not.toHaveBeenCalled();
  });
});

describe("PlanSetupPage — submitting with neither section filled (§5.9)", () => {
  it("is a valid submission: calculate() is called with both undefined, and the table shows the non-blocking hint", async () => {
    const { calculate } = await import("@training-plan/pace-zones");
    render(<PlanSetupPage />);

    setRaceDate(futureDateString());
    submit();

    await waitFor(() => {
      expect(screen.getByText("Your pace zones")).toBeDefined();
    });

    expect(calculate).toHaveBeenCalledWith({
      recentResult: undefined,
      goalTime: undefined,
    });
    expect(
      screen.getByText("Add a recent race result or a goal time above to see real numbers."),
    ).toBeDefined();
  });
});

describe("PlanSetupPage — happy path (goal time only)", () => {
  it("calls calculate() with the correctly-shaped input and renders the pace-zone table", async () => {
    const { calculate } = await import("@training-plan/pace-zones");
    render(<PlanSetupPage />);

    setRaceDate(futureDateString());
    fillGoalTime({ distance: "half", hours: "1", minutes: "45", seconds: "0" });
    submit();

    await waitFor(() => {
      expect(screen.getByText("Goal — Half")).toBeDefined();
    });

    expect(calculate).toHaveBeenCalledWith({
      recentResult: undefined,
      goalTime: { distance: "half", timeSeconds: 1 * 3600 + 45 * 60 },
    });

    // Goal is computed; the six equivalency zones stay blocked (no recent
    // result was provided) with real actionable copy, per FR5.
    expect(
      screen.getAllByRole("button", {
        name: "Add a recent result — jump to Recent race result section",
      }),
    ).toHaveLength(6);
  });
});

describe("PlanSetupPage — ok:false leaves a previous successful table untouched", () => {
  it("shows the calculate()-returned inline error while the prior result stays on screen", async () => {
    render(<PlanSetupPage />);

    setRaceDate(futureDateString());
    fillGoalTime({ distance: "half", hours: "1", minutes: "45", seconds: "0" });
    submit();

    await waitFor(() => {
      expect(screen.getByText("Goal — Half")).toBeDefined();
    });

    const goalRowBefore = screen.getByText("Goal — Half").closest("tr")!;
    const paceTextBefore = within(goalRowBefore).getByText(/\/mi$/).textContent;

    // Now make the goal time implausible (1 second for a half marathon) and
    // resubmit — calculate() should reject it with a single field-level
    // error (path "goalTime.timeSeconds"), never touching the prior result.
    fillGoalTime({ hours: "0", minutes: "0", seconds: "1", distance: "half" });
    submit();

    await waitFor(() => {
      expect(screen.getByText(/implausible goal time/)).toBeDefined();
    });

    const goalRowAfter = screen.getByText("Goal — Half").closest("tr")!;
    expect(within(goalRowAfter).getByText(paceTextBefore!)).toBeDefined();
  });
});
