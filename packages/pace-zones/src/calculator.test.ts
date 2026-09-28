import { describe, expect, it } from "vitest";
import {
  calculate,
  type EquivalencyZone,
  type EquivalencyZoneSource,
  type GoalZone,
  type PaceZones,
} from "./calculator.js";
import { DISTANCE_METERS } from "./schema.js";
import {
  EASY_TABLE,
  FIVE_K_TABLE,
  INTERVAL_TABLE,
  RECOVERY_VO2_PERCENT_OF_VDOT,
  TEN_K_TABLE,
  THRESHOLD_TABLE,
  VDOT_TABLE_MIN,
  type VdotPoint,
} from "./vdotTable.js";

const MILE_METERS = 1609.344;

/** Convert a sourced pace/mile table value back into a race time, seconds. */
function raceTimeFromPace(distanceMeters: number, paceSecPerMile: number): number {
  const miles = distanceMeters / MILE_METERS;
  return Math.round(paceSecPerMile * miles);
}

/** Round-half-up, mirroring calculator.ts's own private helper. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Independent reference implementation of calculator.ts's private
 * `paceSecPerMile` (the `goal` zone's direct time/distance division, no VDOT
 * involved) — kept as its own copy here, like `paceFromVo2Percent` below,
 * rather than imported, so tests asserting the `goal` zone's value don't
 * just re-assert the implementation against itself.
 */
function paceFromDirectDivision(distanceMeters: number, timeSeconds: number): number {
  const miles = distanceMeters / MILE_METERS;
  return roundHalfUp(timeSeconds / miles);
}

/**
 * The same VO2(v) equation `calculator.ts` uses internally
 * (`vdotFromRecentResult`), exposed here only so this test file can
 * independently derive a reference Recovery pace at a given VDOT without
 * importing calculator.ts's private functions.
 */
function vo2FromVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/**
 * Independent reference implementation of the quadratic inversion
 * calculator.ts uses for Recovery: solve `VO2(v) = targetVo2` for `v` via
 * the quadratic formula's positive root, then convert to pace. Kept
 * deliberately separate from (not imported from) calculator.ts so these
 * tests don't just re-assert the implementation against itself.
 */
function paceFromVo2Percent(vdot: number, percent: number): number {
  const targetVo2 = percent * vdot;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - targetVo2;
  const v = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return roundHalfUp((MILE_METERS * 60) / v);
}

function computedZone(zone: EquivalencyZone): number {
  if (zone.state !== "computed") {
    throw new Error(`expected a computed zone, got '${zone.state}'`);
  }
  return zone.paceSecPerMile;
}

/** Like `computedZone`, but also asserts/returns the `source` tag (#52). */
function computedZoneSource(zone: EquivalencyZone): EquivalencyZoneSource {
  if (zone.state !== "computed") {
    throw new Error(`expected a computed zone, got '${zone.state}'`);
  }
  return zone.source;
}

/**
 * Independent reference implementation of `calculator.ts`'s private
 * `vdotFromRecentResult` (#52) — same distance+time -> VDOT transform, kept
 * as its own copy here (like `paceFromVo2Percent` above) rather than
 * imported, so this file's boundary tests for the goal-time fallback don't
 * just re-assert the implementation against itself. Used only to binary-
 * search for a goal time that lands right at `VDOT_TABLE_MIN`, mirroring
 * the recentResult-path boundary test's use of a sourced table row for the
 * same purpose (not available here, since goal-time distances are limited
 * to marathon/half, neither of which has a sourced VDOT table keyed by
 * race time directly).
 */
function vdotFromDistanceTime(distanceMeters: number, timeSeconds: number): number {
  const t = timeSeconds / 60;
  const v = distanceMeters / t;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pct =
    0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}

/**
 * Binary-searches integer `timeSeconds` within `[minBound, maxBound]` for
 * the slowest (largest) time whose derived VDOT is still `>= targetVdot` —
 * i.e. the boundary time itself, one second faster than the first time that
 * would fall below the threshold. VDOT decreases monotonically as time
 * increases (slower performance), so this is a standard monotonic binary
 * search, not an approximation.
 */
function findBoundaryTimeSeconds(
  distanceMeters: number,
  targetVdot: number,
  minBound: number,
  maxBound: number,
): number {
  let lo = minBound;
  let hi = maxBound;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (vdotFromDistanceTime(distanceMeters, mid) >= targetVdot) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function computedGoal(zone: GoalZone): { label: "marathon" | "half"; paceSecPerMile: number } {
  if (zone.state !== "computed") {
    throw new Error(`expected a computed goal zone, got '${zone.state}'`);
  }
  return { label: zone.label, paceSecPerMile: zone.paceSecPerMile };
}

function calculateZones(input: unknown): PaceZones {
  const result = calculate(input);
  if (!result.ok) {
    throw new Error(`expected ok:true, got errors: ${JSON.stringify(result.errors)}`);
  }
  return result.zones;
}

/**
 * Round-trips each sourced 5K-table VDOT row through the real calculator:
 * derive the 5K time that produces this row's pace, feed it in as a recent
 * 5K result, and check the resulting equivalency zones land back within
 * tolerance of the same row's sourced Threshold/Interval/Easy values.
 * VDOT 66 is excluded from EASY_TABLE (documented misprint — see
 * vdotTable.ts) so its easy/recovery assertions are skipped for that row.
 */
const PRIMARY_ROWS: VdotPoint[] = FIVE_K_TABLE;
const TOLERANCE_PRIMARY = 2;
const TOLERANCE_10K = 5;

describe("calculate() — table-driven against sourced Daniels rows (via 5K round-trip)", () => {
  it.each(PRIMARY_ROWS.map((row) => [row.vdot, row.value] as const))(
    "VDOT %i row: threshold/interval/5K land within +/-2 sec/mile",
    (vdot, fiveKPace) => {
      const raceTimeSeconds = raceTimeFromPace(DISTANCE_METERS["5k"], fiveKPace);
      const zones = calculateZones({
        recentResult: { distance: "5k", timeSeconds: raceTimeSeconds },
      });

      const thresholdRow = THRESHOLD_TABLE.find((p) => p.vdot === vdot);
      const intervalRow = INTERVAL_TABLE.find((p) => p.vdot === vdot);
      expect(thresholdRow).toBeDefined();
      expect(intervalRow).toBeDefined();

      expect(computedZone(zones.fiveK)).toBeGreaterThanOrEqual(fiveKPace - TOLERANCE_PRIMARY);
      expect(computedZone(zones.fiveK)).toBeLessThanOrEqual(fiveKPace + TOLERANCE_PRIMARY);
      expect(computedZone(zones.threshold)).toBeGreaterThanOrEqual(
        thresholdRow!.value - TOLERANCE_PRIMARY,
      );
      expect(computedZone(zones.threshold)).toBeLessThanOrEqual(
        thresholdRow!.value + TOLERANCE_PRIMARY,
      );
      expect(computedZone(zones.interval)).toBeGreaterThanOrEqual(
        intervalRow!.value - TOLERANCE_PRIMARY,
      );
      expect(computedZone(zones.interval)).toBeLessThanOrEqual(
        intervalRow!.value + TOLERANCE_PRIMARY,
      );

      const easyRow = EASY_TABLE.find((p) => p.vdot === vdot);
      if (easyRow) {
        expect(computedZone(zones.easy)).toBeGreaterThanOrEqual(easyRow.value - TOLERANCE_PRIMARY);
        expect(computedZone(zones.easy)).toBeLessThanOrEqual(easyRow.value + TOLERANCE_PRIMARY);
      }

      // Recovery is formula-derived (VO2(v)-inversion at the 59% VO2max
      // floor — see vdotTable.ts), not read off a table, so it's checked
      // against an independent reference implementation of that same
      // formula rather than a sourced table row. Same tolerance as the
      // other zones in this round-trip test, since the only slop is the
      // recentResult -> VDOT round-trip, not the (deterministic) formula.
      const expectedRecovery = paceFromVo2Percent(vdot, RECOVERY_VO2_PERCENT_OF_VDOT);
      expect(computedZone(zones.recovery)).toBeGreaterThanOrEqual(
        expectedRecovery - TOLERANCE_PRIMARY,
      );
      expect(computedZone(zones.recovery)).toBeLessThanOrEqual(
        expectedRecovery + TOLERANCE_PRIMARY,
      );
    },
  );

  it.each(TEN_K_TABLE.map((row) => [row.vdot, row.value] as const))(
    "VDOT %i 10K anchor: lands within +/-5 sec/mile via a direct 10K result",
    (vdot, tenKPace) => {
      const raceTimeSeconds = raceTimeFromPace(DISTANCE_METERS["10k"], tenKPace);
      const zones = calculateZones({
        recentResult: { distance: "10k", timeSeconds: raceTimeSeconds },
      });

      expect(computedZone(zones.tenK)).toBeGreaterThanOrEqual(tenKPace - TOLERANCE_10K);
      expect(computedZone(zones.tenK)).toBeLessThanOrEqual(tenKPace + TOLERANCE_10K);
    },
  );
});

describe("FR4 — recent-result-only", () => {
  it("computes the six equivalency zones (tagged source: recentResult) and leaves goal unset", () => {
    const zones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 2400 }, // 40:00
    });

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(zones[key].state).toBe("computed");
      expect(computedZoneSource(zones[key])).toBe("recentResult");
    }
    expect(zones.goal.state).toBe("unset");
  });
});

describe("FR5 — goal-time-only (amended by #52: the six equivalency zones now fall back to goal-derived, not blocked)", () => {
  it("computes the goal zone directly, and all six equivalency zones from a goal-derived VDOT, tagged source: goalTime", () => {
    const zones = calculateZones({
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(zones[key].state).toBe("computed");
      expect(computedZoneSource(zones[key])).toBe("goalTime");
    }
    expect(zones.goal.state).toBe("computed");

    const goal = computedGoal(zones.goal);
    expect(goal.label).toBe("marathon");
    // 4:00:00 marathon = 26.2188 mi => ~549 sec/mi (9:09/mi)
    expect(goal.paceSecPerMile).toBeGreaterThanOrEqual(545);
    expect(goal.paceSecPerMile).toBeLessThanOrEqual(555);
  });

  it("the goal zone itself is still a direct division, not equivalency-derived — ignores VDOT tables entirely, and has no source field", () => {
    // An implausibly slow-for-its-VDOT-equivalent goal marathon pace should
    // still compute directly, since the goal zone never touches the VDOT
    // path at all. This particular half-marathon time is slow enough that
    // its goal-derived VDOT would be rejected below (see the
    // VDOT_TABLE_MIN describe block for that case) — using a comfortably
    // plausible time here instead, since this test is only about the goal
    // zone's own computation, not the six equivalency zones' fallback.
    const zones = calculateZones({
      goalTime: { distance: "half", timeSeconds: 2 * 60 * 60 }, // 2:00:00 half
    });
    const goal = computedGoal(zones.goal);
    expect(goal.label).toBe("half");
    // 2:00:00 half = 13.1094... mi => ~549 sec/mi
    expect(goal.paceSecPerMile).toBeGreaterThanOrEqual(545);
    expect(goal.paceSecPerMile).toBeLessThanOrEqual(555);
    // `GoalZone`'s `computed` variant has no `source` field at all (see
    // calculator.ts's comment on why) — not merely an omitted-but-typed
    // field. This assertion double-checks that at runtime, not just via
    // the type system.
    expect(zones.goal.state === "computed" && "source" in zones.goal).toBe(false);
  });
});

describe("both recentResult and goalTime provided", () => {
  it("computes all seven zones, with recentResult (demonstrated fitness) taking precedence over goalTime for the six equivalency zones' source", () => {
    const zones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 2400 },
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(zones[key].state).toBe("computed");
      expect(computedZoneSource(zones[key])).toBe("recentResult");
    }
    expect(zones.goal.state).toBe("computed");
  });
});

describe("neither recentResult nor goalTime provided", () => {
  it("is valid input (no data to reject) and leaves everything blocked/unset, tagged reason: noInput", () => {
    const zones = calculateZones({});
    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      const zone = zones[key];
      expect(zone.state).toBe("blocked");
      expect(zone.state === "blocked" && zone.reason).toBe("noInput");
    }
    expect(zones.goal.state).toBe("unset");
  });
});

describe("invalid input — non-throwing", () => {
  it("rejects an implausible race time via ok:false rather than throwing", () => {
    expect(() =>
      calculate({ recentResult: { distance: "5k", timeSeconds: 60 } }),
    ).not.toThrow();

    const result = calculate({ recentResult: { distance: "5k", timeSeconds: 60 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.path).toContain("timeSeconds");
    }
  });

  it("rejects a malformed input shape via ok:false", () => {
    const result = calculate({ recentResult: { distance: "marathon" } });
    expect(result.ok).toBe(false);
  });
});

describe("low-VDOT rejection, not clamping (bug fix: a below-table VDOT must never be clamped up to a faster pace)", () => {
  it("rejects a 5K in 40:00 (derives VDOT ~21.7, below VDOT_TABLE_MIN) via ok:false", () => {
    const result = calculate({
      recentResult: { distance: "5k", timeSeconds: 40 * 60 }, // 40:00
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.path).toBe("recentResult");
      expect(result.errors[0]!.message).toMatch(/VDOT/i);
    }
  });

  it("still returns ok:true for a VDOT essentially exactly at VDOT_TABLE_MIN (the boundary itself, not below it)", () => {
    // Derive a boundary-exact input the same way the round-trip block above
    // does: take the FIVE_K_TABLE row at VDOT_TABLE_MIN and convert its
    // sourced pace back into a race time via raceTimeFromPace, rather than
    // hand-computing a race time — this avoids fighting floating-point
    // noise right at the boundary `calculate()` now checks against.
    const boundaryRow = FIVE_K_TABLE.find((p) => p.vdot === VDOT_TABLE_MIN);
    if (!boundaryRow) {
      throw new Error(`no 5K row for VDOT_TABLE_MIN (${VDOT_TABLE_MIN}) in fixture`);
    }
    const raceTimeSeconds = raceTimeFromPace(DISTANCE_METERS["5k"], boundaryRow.value);

    const result = calculate({
      recentResult: { distance: "5k", timeSeconds: raceTimeSeconds },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zones.fiveK.state).toBe("computed");
    }
  });
});

describe("goal-time-derived low-VDOT fallback (#52, corrected by data-scientist review: the six equivalency zones block, but the whole call no longer rejects)", () => {
  // A marathon goal time slow enough to derive a sub-VDOT_TABLE_MIN VDOT,
  // but still within the plausibility bounds schema.ts already enforces
  // (2:01:00 .. 8:00:00) — this is the "slow-but-plausible" case the
  // guardrail exists for, not an already-rejected implausible time. Genuine
  // first-race beginner goals (e.g. a 5:00:00 marathon) land here.
  const MARATHON_METERS = DISTANCE_METERS.marathon;
  const MARATHON_MIN_SECONDS = 2 * 60 * 60 + 60; // schema.ts's plausibility floor
  const MARATHON_MAX_SECONDS = 8 * 60 * 60; // schema.ts's plausibility ceiling

  it("a marathon goal of 5:00:00 (derives a sub-VDOT_TABLE_MIN VDOT) still returns ok:true, with all six equivalency zones blocked (reason: goalVdotBelowTable) and goal computed via direct division", () => {
    const goalTimeSeconds = 5 * 60 * 60; // 5:00:00
    const result = calculate({
      goalTime: { distance: "marathon", timeSeconds: goalTimeSeconds },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      const zone = result.zones[key];
      expect(zone.state).toBe("blocked");
      expect(zone.state === "blocked" && zone.reason).toBe("goalVdotBelowTable");
    }

    expect(result.zones.goal.state).toBe("computed");
    const goal = computedGoal(result.zones.goal);
    expect(goal.label).toBe("marathon");
    // 5:00:00 marathon = 26.2188 mi => direct division, ~686 sec/mi (11:26/mi)
    const expectedPace = paceFromDirectDivision(MARATHON_METERS, goalTimeSeconds);
    expect(goal.paceSecPerMile).toBe(expectedPace);
  });

  it("still returns ok:true, with all six equivalency zones computed, for a goal-derived VDOT essentially exactly at VDOT_TABLE_MIN (the boundary itself, not below it)", () => {
    // Binary-search for the slowest (largest) integer marathon time whose
    // goal-derived VDOT is still >= VDOT_TABLE_MIN — the boundary itself,
    // mirroring the recentResult-path boundary test's structure but via
    // numeric search rather than a sourced table row (goalTime's distances,
    // marathon/half, aren't directly keyed in vdotTable.ts's tables the way
    // 5K is).
    const boundaryTimeSeconds = findBoundaryTimeSeconds(
      MARATHON_METERS,
      VDOT_TABLE_MIN,
      MARATHON_MIN_SECONDS,
      MARATHON_MAX_SECONDS,
    );

    const atBoundary = calculate({
      goalTime: { distance: "marathon", timeSeconds: boundaryTimeSeconds },
    });
    expect(atBoundary.ok).toBe(true);
    if (atBoundary.ok) {
      for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
        expect(atBoundary.zones[key].state).toBe("computed");
        expect(computedZoneSource(atBoundary.zones[key])).toBe("goalTime");
      }
    }

    // One second slower crosses just below VDOT_TABLE_MIN. The whole call
    // must NOT reject (#52 correction) — the six equivalency zones fall back
    // to blocked (reason: goalVdotBelowTable) instead of being clamped to a
    // faster-than-earned pace, while goal still computes.
    const justBelow = calculate({
      goalTime: { distance: "marathon", timeSeconds: boundaryTimeSeconds + 1 },
    });
    expect(justBelow.ok).toBe(true);
    if (justBelow.ok) {
      for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
        const zone = justBelow.zones[key];
        expect(zone.state).toBe("blocked");
        expect(zone.state === "blocked" && zone.reason).toBe("goalVdotBelowTable");
      }
      expect(justBelow.zones.goal.state).toBe("computed");
    }
  });
});

describe("invariants", () => {
  // Every VDOT in FIVE_K_TABLE (not just a 6-point sample) for better real
  // coverage — see the INTERVAL_TABLE/FIVE_K_TABLE tolerance comment below
  // for why widening this was safe to do only after loosening one specific
  // comparison.
  const allVdotRaceTimes = FIVE_K_TABLE.map((row) =>
    raceTimeFromPace(DISTANCE_METERS["5k"], row.value),
  );

  it.each(allVdotRaceTimes)(
    "pace ordering holds for a 5K result of %i seconds: interval <= 5K <= threshold <= easy < recovery",
    (raceTimeSeconds) => {
      const zones = calculateZones({
        recentResult: { distance: "5k", timeSeconds: raceTimeSeconds },
      });

      const interval = computedZone(zones.interval);
      const fiveK = computedZone(zones.fiveK);
      const threshold = computedZone(zones.threshold);
      const easy = computedZone(zones.easy);
      const recovery = computedZone(zones.recovery);

      // Interval vs 5K: the sourced INTERVAL_TABLE/FIVE_K_TABLE columns
      // themselves are not perfectly monotonic relative to each other at
      // the elite end — confirmed against the committed tables, Interval is
      // 1-2 sec/mile *slower* than 5K at VDOT 78, 79, 81, 82, 83, 84, and 85
      // (e.g. VDOT 84: Interval 248 vs 5K 246). This is real, sourced Daniels
      // data (not a bug in this codebase, and not something to "correct" by
      // changing the data), so the comparison tolerates it with a +2
      // sec/mile allowance rather than a strict <=. This slack is specific
      // to Interval-vs-5K only — every other comparison below stays exact.
      expect(interval).toBeLessThanOrEqual(fiveK + 2);
      // The sourced table itself has an occasional rounding tie between
      // adjacent columns at a given VDOT (e.g. VDOT 80's Interval and 5K
      // are both 257 sec/mi) — these comparisons are <=, not <, so the
      // invariant reflects the real data rather than an idealized strict
      // ordering. Recovery (VO2(v)-inversion at 59% VO2max) is always
      // strictly slower than Easy (~70% VO2max, empirically, per
      // vdotTable.ts) because 59% < ~70% at every VDOT in range — not
      // because of a fixed offset between them (there isn't one; the gap
      // varies by VDOT, see vdotTable.ts).
      expect(fiveK).toBeLessThanOrEqual(threshold);
      expect(threshold).toBeLessThanOrEqual(easy);
      expect(easy).toBeLessThan(recovery);
    },
  );

  it("a faster 10K result never produces a slower zone pace than a slower one", () => {
    const fasterZones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 2100 }, // 35:00
    });
    const slowerZones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 3000 }, // 50:00
    });

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(computedZone(fasterZones[key])).toBeLessThanOrEqual(computedZone(slowerZones[key]));
    }
  });
});

/**
 * Recovery pace: formula-derived (VO2(v)-inversion at 59% VO2max), not a
 * Daniels table value — see vdotTable.ts's comment above
 * `RECOVERY_VO2_PERCENT_OF_VDOT` for the full sourcing rationale (cited
 * Daniels E-range floor vs. our own table's empirical ~70% anchor vs. this
 * product's 59% convention).
 *
 * Two independent checks, deliberately not the same assertion twice:
 * 1. Spot-check against data-scientist's four closed-form reference values
 *    (computed independently via the same 59%-VO2max formula) — this
 *    validates the *constants* (59%, the VO2(v) coefficients) are wired up
 *    correctly.
 * 2. A round-trip through the VO2(v) equation and back, for an arbitrary
 *    velocity with no dependency on the 59% constant at all — this
 *    validates the *algebra* of the quadratic inversion itself, so it can't
 *    pass merely because a sign error happens to cancel out for one
 *    specific percent value.
 *
 * The "table-driven against sourced Daniels rows" describe block above
 * separately confirms `calculate()`'s production code path produces
 * Recovery values matching this same formula (within the round-trip
 * tolerance already used for every other zone there), across VDOT 30-85 —
 * so between that block and this one, both the formula's correctness and
 * calculate()'s use of it are covered.
 */
describe("Recovery pace formula (59% VO2max, VO2(v)-inversion)", () => {
  it.each([
    [30, 841], // 840.9s/mi
    [50, 566], // 566.3s/mi
    [70, 432], // 432.3s/mi
    [85, 369], // 369.4s/mi
  ])("VDOT %i solves to %i sec/mile at 59%% VO2max", (vdot, expectedPaceSecPerMile) => {
    const actual = paceFromVo2Percent(vdot, RECOVERY_VO2_PERCENT_OF_VDOT);
    expect(actual).toBeGreaterThanOrEqual(expectedPaceSecPerMile - 1);
    expect(actual).toBeLessThanOrEqual(expectedPaceSecPerMile + 1);
  });

  it("recovers the original velocity by round-tripping through VO2(v) and its inverse", () => {
    // Deliberately arbitrary velocities (m/min), unrelated to any VDOT or
    // percent — this validates the quadratic-formula algebra itself, not
    // the 59% product convention.
    for (const v of [150, 200, 220.7, 260, 310, 400]) {
      const vo2 = vo2FromVelocity(v);
      const a = 0.000104;
      const b = 0.182258;
      const c = -4.6 - vo2;
      const recoveredV = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      expect(recoveredV).toBeCloseTo(v, 6);
    }
  });
});
