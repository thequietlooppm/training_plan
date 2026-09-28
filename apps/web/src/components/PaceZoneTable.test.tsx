import type { PaceZones } from "@training-plan/pace-zones";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaceZoneTable } from "@/components/PaceZoneTable";

afterEach(() => {
  cleanup();
});

const ALL_BLOCKED_AND_UNSET: PaceZones = {
  recovery: { state: "blocked" },
  easy: { state: "blocked" },
  threshold: { state: "blocked" },
  tenK: { state: "blocked" },
  fiveK: { state: "blocked" },
  interval: { state: "blocked" },
  goal: { state: "unset" },
};

const RECENT_RESULT_ONLY: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 550 },
  easy: { state: "computed", paceSecPerMile: 495 },
  threshold: { state: "computed", paceSecPerMile: 425 },
  tenK: { state: "computed", paceSecPerMile: 408 },
  fiveK: { state: "computed", paceSecPerMile: 390 },
  interval: { state: "computed", paceSecPerMile: 370 },
  goal: { state: "unset" },
};

const GOAL_ONLY: PaceZones = {
  recovery: { state: "blocked" },
  easy: { state: "blocked" },
  threshold: { state: "blocked" },
  tenK: { state: "blocked" },
  fiveK: { state: "blocked" },
  interval: { state: "blocked" },
  goal: { state: "computed", label: "half", paceSecPerMile: 480 },
};

const BOTH: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 550 },
  easy: { state: "computed", paceSecPerMile: 495 },
  threshold: { state: "computed", paceSecPerMile: 425 },
  tenK: { state: "computed", paceSecPerMile: 408 },
  fiveK: { state: "computed", paceSecPerMile: 390 },
  interval: { state: "computed", paceSecPerMile: 370 },
  goal: { state: "computed", label: "marathon", paceSecPerMile: 450 },
};

describe("PaceZoneTable", () => {
  it("renders all 7 zone rows in the fixed order, with formatted paces, when both inputs are provided", () => {
    render(<PaceZoneTable zones={BOTH} />);

    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows).toHaveLength(7);

    expect(screen.getByText("Recovery")).toBeDefined();
    expect(screen.getByText("9:10 /mi")).toBeDefined(); // 550s
    expect(screen.getByText("Easy")).toBeDefined();
    expect(screen.getByText("8:15 /mi")).toBeDefined(); // 495s
    expect(screen.getByText("Threshold")).toBeDefined();
    expect(screen.getByText("7:05 /mi")).toBeDefined(); // 425s
    expect(screen.getByText("10K")).toBeDefined();
    expect(screen.getByText("6:48 /mi")).toBeDefined(); // 408s
    expect(screen.getByText("5K")).toBeDefined();
    expect(screen.getByText("6:30 /mi")).toBeDefined(); // 390s
    expect(screen.getByText("Interval")).toBeDefined();
    expect(screen.getByText("6:10 /mi")).toBeDefined(); // 370s
    expect(screen.getByText("Goal — Marathon")).toBeDefined();
    expect(screen.getByText("7:30 /mi")).toBeDefined(); // 450s
  });

  it("renders computed equivalency zones and a blocked/unset goal row when only a recent result was provided", () => {
    render(<PaceZoneTable zones={RECENT_RESULT_ONLY} />);

    expect(screen.getByText("9:10 /mi")).toBeDefined();
    expect(screen.getByText("Goal")).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Add a goal time — jump to Goal time section",
      }),
    ).toBeDefined();
  });

  it("renders a computed goal zone and blocked equivalency rows when only a goal time was provided", () => {
    render(<PaceZoneTable zones={GOAL_ONLY} />);

    expect(screen.getByText("Goal — Half")).toBeDefined();
    expect(screen.getByText("8:00 /mi")).toBeDefined(); // 480s

    const blockedJumpLinks = screen.getAllByRole("button", {
      name: "Add a recent result — jump to Recent race result section",
    });
    expect(blockedJumpLinks).toHaveLength(6);
  });

  it("renders every row blocked/unset with actionable copy (never a bare dash) when neither input was provided", () => {
    render(<PaceZoneTable zones={ALL_BLOCKED_AND_UNSET} />);

    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("N/A")).toBeNull();

    expect(
      screen.getAllByRole("button", {
        name: "Add a recent result — jump to Recent race result section",
      }),
    ).toHaveLength(6);
    expect(
      screen.getByRole("button", {
        name: "Add a goal time — jump to Goal time section",
      }),
    ).toBeDefined();
  });
});
