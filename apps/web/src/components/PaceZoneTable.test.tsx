import type { PaceZones } from "@training-plan/pace-zones";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaceZoneTable } from "@/components/PaceZoneTable";

afterEach(() => {
  cleanup();
});

/**
 * RTL's default `getByText` matcher only ever looks at an element's *direct*
 * text-node children (`getNodeText`), never descendant elements' text — so
 * it can't match a sentence that's split across a text node and a nested
 * `<button>` jump-link, like the goal-derived warning banner (§7.2). This
 * checks the full `element.textContent` (nested elements included) instead,
 * scoped to one element via `selector` so it can't accidentally match an
 * ancestor with the same effective text (e.g. the wrapping `Alert`).
 */
function textMatcher(selector: string, expected: string) {
  return (_content: string, element: Element | null) =>
    Boolean(element?.matches(selector)) && element?.textContent === expected;
}

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
  recovery: { state: "computed", paceSecPerMile: 550, source: "recentResult" },
  easy: { state: "computed", paceSecPerMile: 495, source: "recentResult" },
  threshold: { state: "computed", paceSecPerMile: 425, source: "recentResult" },
  tenK: { state: "computed", paceSecPerMile: 408, source: "recentResult" },
  fiveK: { state: "computed", paceSecPerMile: 390, source: "recentResult" },
  interval: { state: "computed", paceSecPerMile: 370, source: "recentResult" },
  goal: { state: "unset" },
};

/** Goal-time only (issue #52): the six equivalency zones are now derived
 * from the goal time as a fallback (`source: "goalTime"`), never `blocked`
 * — `blocked` can no longer occur from any submission this screen allows
 * (design spec §7.2), since #12's "at least one input required" check means
 * a submission that reaches this table always has a recent result and/or a
 * goal time. */
const GOAL_ONLY: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 620, source: "goalTime" },
  easy: { state: "computed", paceSecPerMile: 560, source: "goalTime" },
  threshold: { state: "computed", paceSecPerMile: 470, source: "goalTime" },
  tenK: { state: "computed", paceSecPerMile: 450, source: "goalTime" },
  fiveK: { state: "computed", paceSecPerMile: 430, source: "goalTime" },
  interval: { state: "computed", paceSecPerMile: 405, source: "goalTime" },
  goal: { state: "computed", label: "half", paceSecPerMile: 480 },
};

const BOTH: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 550, source: "recentResult" },
  easy: { state: "computed", paceSecPerMile: 495, source: "recentResult" },
  threshold: { state: "computed", paceSecPerMile: 425, source: "recentResult" },
  tenK: { state: "computed", paceSecPerMile: 408, source: "recentResult" },
  fiveK: { state: "computed", paceSecPerMile: 390, source: "recentResult" },
  interval: { state: "computed", paceSecPerMile: 370, source: "recentResult" },
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

  describe("source: 'recentResult' rows (§7.2) — no goal-derived banner or badges", () => {
    it("renders no warning banner and no 'Estimated' badges when every equivalency zone's source is recentResult", () => {
      render(<PaceZoneTable zones={RECENT_RESULT_ONLY} />);

      expect(
        screen.queryByText(/estimated from your goal time, not a race you've run/i),
      ).toBeNull();
      expect(screen.queryByText("Estimated")).toBeNull();
    });

    it("renders no warning banner and no badges when both a recent result and a goal time were provided", () => {
      // BOTH: recentResult takes priority over the goalTime fallback per
      // #52 — every equivalency zone's source is "recentResult" even though
      // a goal time was also entered.
      render(<PaceZoneTable zones={BOTH} />);

      expect(
        screen.queryByText(/estimated from your goal time, not a race you've run/i),
      ).toBeNull();
      expect(screen.queryByText("Estimated")).toBeNull();
    });
  });

  describe("source: 'goalTime' rows (§7.2, issue #52) — goal-derived fallback banner + badges", () => {
    it("renders a computed goal zone and computed (not blocked) equivalency rows, each real numbers", () => {
      render(<PaceZoneTable zones={GOAL_ONLY} />);

      expect(screen.getByText("Goal — Half")).toBeDefined();
      expect(screen.getByText("8:00 /mi")).toBeDefined(); // 480s
      expect(screen.getByText("10:20 /mi")).toBeDefined(); // 620s, recovery
      expect(screen.getByText("9:20 /mi")).toBeDefined(); // 560s, easy

      // The now-unreachable-from-this-screen blocked state must not render
      // six per-row jump-links — only the banner's single jump-link (below)
      // shares this same aria-label.
      expect(
        screen.getAllByRole("button", {
          name: "Add a recent result — jump to Recent race result section",
        }),
      ).toHaveLength(1);
    });

    it("renders the warning banner exactly once, with the verbatim §6.3 copy and a jump-link to the recent-result section", () => {
      render(<PaceZoneTable zones={GOAL_ONLY} />);

      expect(
        screen.getByText(
          textMatcher(
            "[data-slot='alert-description']",
            "These paces are estimated from your goal time, not a race you've run. If that goal is ambitious, expect all of them — especially Interval and 5K — to run faster than your current fitness supports. Add a recent result above for paces based on what you've actually run.",
          ),
        ),
      ).toBeDefined();

      const jumpLinks = screen.getAllByRole("button", {
        name: "Add a recent result — jump to Recent race result section",
      });
      // Exactly one banner jump-link (§7.2: "one banner, one CTA, no
      // per-row jump-link"), not six.
      expect(jumpLinks).toHaveLength(1);
    });

    it("renders exactly six 'Estimated' badges, one per equivalency row, never on the goal row", () => {
      render(<PaceZoneTable zones={GOAL_ONLY} />);

      const badges = screen.getAllByText("Estimated");
      expect(badges).toHaveLength(6);

      const goalRow = screen.getByText("Goal — Half").closest("tr")!;
      expect(within(goalRow).queryByText("Estimated")).toBeNull();
    });

    it("gives the 'Estimated' badge the verbatim §6.3 tooltip/accessible-name text", () => {
      render(<PaceZoneTable zones={GOAL_ONLY} />);

      const [badge] = screen.getAllByText("Estimated");
      const badgeEl = badge.closest("[data-slot='badge']") ?? badge.parentElement!;
      expect(badgeEl.getAttribute("title")).toBe(
        "Estimated from your goal time — not a demonstrated result. Add a recent result above for more accurate paces.",
      );
    });
  });

  it("never gives the goal zone a source — it has no source field to render, computed or not", () => {
    expect("source" in GOAL_ONLY.goal).toBe(false);
    expect("source" in BOTH.goal).toBe(false);
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
