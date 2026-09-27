import { describe, expect, it } from "vitest";
import { calculate, type EquivalencyZone, type GoalZone, type PaceZones } from "./calculator.js";
import { DISTANCE_METERS } from "./schema.js";
import {
  EASY_TABLE,
  FIVE_K_TABLE,
  INTERVAL_TABLE,
  RECOVERY_OFFSET_SECONDS_PER_MILE,
  TEN_K_TABLE,
  THRESHOLD_TABLE,
  type VdotPoint,
} from "./vdotTable.js";

const MILE_METERS = 1609.344;

/** Convert a sourced pace/mile table value back into a race time, seconds. */
function raceTimeFromPace(distanceMeters: number, paceSecPerMile: number): number {
  const miles = distanceMeters / MILE_METERS;
  return Math.round(paceSecPerMile * miles);
}

function computedZone(zone: EquivalencyZone): number {
  if (zone.state !== "computed") {
    throw new Error(`expected a computed zone, got '${zone.state}'`);
  }
  return zone.paceSecPerMile;
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
        expect(computedZone(zones.recovery)).toBe(
          computedZone(zones.easy) + RECOVERY_OFFSET_SECONDS_PER_MILE,
        );
      }
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
  it("computes the six equivalency zones and leaves goal unset", () => {
    const zones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 2400 }, // 40:00
    });

    expect(zones.recovery.state).toBe("computed");
    expect(zones.easy.state).toBe("computed");
    expect(zones.threshold.state).toBe("computed");
    expect(zones.tenK.state).toBe("computed");
    expect(zones.fiveK.state).toBe("computed");
    expect(zones.interval.state).toBe("computed");
    expect(zones.goal.state).toBe("unset");
  });
});

describe("FR5 — goal-time-only", () => {
  it("computes the goal zone directly and leaves the other six blocked", () => {
    const zones = calculateZones({
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });

    expect(zones.recovery.state).toBe("blocked");
    expect(zones.easy.state).toBe("blocked");
    expect(zones.threshold.state).toBe("blocked");
    expect(zones.tenK.state).toBe("blocked");
    expect(zones.fiveK.state).toBe("blocked");
    expect(zones.interval.state).toBe("blocked");
    expect(zones.goal.state).toBe("computed");

    const goal = computedGoal(zones.goal);
    expect(goal.label).toBe("marathon");
    // 4:00:00 marathon = 26.2188 mi => ~549 sec/mi (9:09/mi)
    expect(goal.paceSecPerMile).toBeGreaterThanOrEqual(545);
    expect(goal.paceSecPerMile).toBeLessThanOrEqual(555);
  });

  it("is a direct division, not equivalency-derived — ignores VDOT tables entirely", () => {
    // An implausibly slow-for-its-VDOT-equivalent goal marathon pace should
    // still compute directly, since the goal zone never touches the VDOT
    // path at all.
    const zones = calculateZones({
      goalTime: { distance: "half", timeSeconds: 3 * 60 * 60 }, // slow half
    });
    const goal = computedGoal(zones.goal);
    expect(goal.label).toBe("half");
    // 3:00:00 half = 13.1094... mi => ~824 sec/mi
    expect(goal.paceSecPerMile).toBeGreaterThanOrEqual(820);
    expect(goal.paceSecPerMile).toBeLessThanOrEqual(828);
  });
});

describe("both recentResult and goalTime provided", () => {
  it("computes all seven zones", () => {
    const zones = calculateZones({
      recentResult: { distance: "10k", timeSeconds: 2400 },
      goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 },
    });

    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(zones[key].state).toBe("computed");
    }
    expect(zones.goal.state).toBe("computed");
  });
});

describe("neither recentResult nor goalTime provided", () => {
  it("is valid input (no data to reject) and leaves everything blocked/unset", () => {
    const zones = calculateZones({});
    for (const key of ["recovery", "easy", "threshold", "tenK", "fiveK", "interval"] as const) {
      expect(zones[key].state).toBe("blocked");
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

describe("invariants", () => {
  const sampleVdotRaceTimes = [30, 40, 50, 60, 70, 80].map((vdot) => {
    const row = FIVE_K_TABLE.find((p) => p.vdot === vdot);
    if (!row) throw new Error(`no 5K row for VDOT ${vdot} in fixture`);
    return raceTimeFromPace(DISTANCE_METERS["5k"], row.value);
  });

  it.each(sampleVdotRaceTimes)(
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

      // The sourced table itself has an occasional rounding tie between
      // adjacent columns at a given VDOT (e.g. VDOT 80's Interval and 5K
      // are both 257 sec/mi) — these comparisons are <=, not <, so the
      // invariant reflects the real data rather than an idealized strict
      // ordering. Recovery is always strictly slower than Easy since it is
      // defined as Easy + a fixed positive offset (see vdotTable.ts).
      expect(interval).toBeLessThanOrEqual(fiveK);
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
