import type { PaceZones } from "@training-plan/pace-zones";
import { describe, expect, it } from "vitest";
import { EQUIVALENCY_ZONE_IDS, hasGoalDerivedEquivalencyZone } from "@/lib/pace-zone-display";

const RECENT_RESULT_ONLY: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 550, source: "recentResult" },
  easy: { state: "computed", paceSecPerMile: 495, source: "recentResult" },
  threshold: { state: "computed", paceSecPerMile: 425, source: "recentResult" },
  tenK: { state: "computed", paceSecPerMile: 408, source: "recentResult" },
  fiveK: { state: "computed", paceSecPerMile: 390, source: "recentResult" },
  interval: { state: "computed", paceSecPerMile: 370, source: "recentResult" },
  goal: { state: "unset" },
};

const BOTH_RECENT_RESULT_PRIORITY: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 550, source: "recentResult" },
  easy: { state: "computed", paceSecPerMile: 495, source: "recentResult" },
  threshold: { state: "computed", paceSecPerMile: 425, source: "recentResult" },
  tenK: { state: "computed", paceSecPerMile: 408, source: "recentResult" },
  fiveK: { state: "computed", paceSecPerMile: 390, source: "recentResult" },
  interval: { state: "computed", paceSecPerMile: 370, source: "recentResult" },
  goal: { state: "computed", label: "marathon", paceSecPerMile: 450 },
};

const GOAL_ONLY_DERIVED: PaceZones = {
  recovery: { state: "computed", paceSecPerMile: 620, source: "goalTime" },
  easy: { state: "computed", paceSecPerMile: 560, source: "goalTime" },
  threshold: { state: "computed", paceSecPerMile: 470, source: "goalTime" },
  tenK: { state: "computed", paceSecPerMile: 450, source: "goalTime" },
  fiveK: { state: "computed", paceSecPerMile: 430, source: "goalTime" },
  interval: { state: "computed", paceSecPerMile: 405, source: "goalTime" },
  goal: { state: "computed", label: "half", paceSecPerMile: 480 },
};

const ALL_BLOCKED_AND_UNSET: PaceZones = {
  recovery: { state: "blocked", reason: "noInput" },
  easy: { state: "blocked", reason: "noInput" },
  threshold: { state: "blocked", reason: "noInput" },
  tenK: { state: "blocked", reason: "noInput" },
  fiveK: { state: "blocked", reason: "noInput" },
  interval: { state: "blocked", reason: "noInput" },
  goal: { state: "unset" },
};

describe("EQUIVALENCY_ZONE_IDS", () => {
  it("is exactly the six equivalency zones — never includes 'goal'", () => {
    expect(EQUIVALENCY_ZONE_IDS).toEqual([
      "recovery",
      "easy",
      "threshold",
      "tenK",
      "fiveK",
      "interval",
    ]);
    expect(EQUIVALENCY_ZONE_IDS).not.toContain("goal");
  });
});

describe("hasGoalDerivedEquivalencyZone (§7.2, issue #52)", () => {
  it("is false when every computed equivalency zone's source is 'recentResult'", () => {
    expect(hasGoalDerivedEquivalencyZone(RECENT_RESULT_ONLY)).toBe(false);
  });

  it("is false when a recent result is present alongside a goal time (recentResult wins)", () => {
    expect(hasGoalDerivedEquivalencyZone(BOTH_RECENT_RESULT_PRIORITY)).toBe(false);
  });

  it("is true when the equivalency zones were derived from the goal time as a fallback", () => {
    expect(hasGoalDerivedEquivalencyZone(GOAL_ONLY_DERIVED)).toBe(true);
  });

  it("is false when every equivalency zone is blocked (neither input provided)", () => {
    expect(hasGoalDerivedEquivalencyZone(ALL_BLOCKED_AND_UNSET)).toBe(false);
  });

  it("never inspects the goal zone's own state (it has no `source` field to read)", () => {
    // GOAL_ONLY_DERIVED's `goal` zone is `computed` with no `source` property
    // at all (§7.2/§7.3) — this assertion documents that fact directly,
    // rather than only exercising it indirectly through the function above.
    expect(GOAL_ONLY_DERIVED.goal.state).toBe("computed");
    expect("source" in GOAL_ONLY_DERIVED.goal).toBe(false);
  });
});
