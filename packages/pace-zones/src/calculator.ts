import {
  DISTANCE_METERS,
  calculatorInputSchema,
  type CalculatorInput,
  type GoalTimeInput,
  type RecentResultInput,
} from "./schema.js";
import {
  EASY_TABLE,
  FIVE_K_TABLE,
  INTERVAL_TABLE,
  RECOVERY_OFFSET_SECONDS_PER_MILE,
  TEN_K_TABLE,
  THRESHOLD_TABLE,
  type VdotPoint,
} from "./vdotTable.js";

/**
 * The pure VDOT/Riegel-style pace-zone calculator (#11). Framework-free:
 * no DOM, no network, no persistence, no string parsing/formatting of
 * "H:MM:SS" in either direction — callers pass and receive integer
 * seconds-per-mile only. See `packages/pace-zones/README.md` for the full
 * output contract.
 *
 * "VDOT/Riegel" names two different tools, only one of which is actually
 * used at runtime:
 * - VDOT (Daniels & Gilbert, 1979) drives every equivalency zone below —
 *   both the race-result -> VDOT step and the VDOT -> zone-pace step.
 * - Riegel's power-law race-time-prediction model predicts a race time at
 *   a *different distance*, not a training intensity — it has no concept
 *   of Threshold/Interval/Recovery. It plays no role in this file; it is
 *   named here only because the issue title mentions it as the standard
 *   alternative worth knowing about.
 */

/** One statute mile, in meters — this package's only distance conversion. */
const MILE_METERS = 1609.344;

export interface ValidationError {
  /** Dot-joined path into the input, e.g. "recentResult.timeSeconds". */
  path: string;
  message: string;
}

/**
 * An equivalency zone (recovery/easy/threshold/tenK/fiveK/interval) can only
 * ever be `computed` (a recent result was provided) or `blocked` (it
 * wasn't) — never `unset`, which is the goal zone's vocabulary. Splitting
 * this from `GoalZone` below, rather than sharing one generic 3-state union,
 * makes "equivalency zone is unset" and "goal zone is blocked" unrepresentable
 * in the type system, since neither combination can ever actually occur.
 */
export type EquivalencyZone =
  | { state: "computed"; paceSecPerMile: number }
  | { state: "blocked" };

/**
 * The goal zone can only ever be `computed` (a goal time was provided) or
 * `unset` (it wasn't) — never `blocked`. `label` records which distance the
 * runner actually entered a goal for; there is no permanent unused slot for
 * the distance they didn't enter.
 */
export type GoalZone =
  | { state: "computed"; label: "marathon" | "half"; paceSecPerMile: number }
  | { state: "unset" };

export interface PaceZones {
  recovery: EquivalencyZone;
  easy: EquivalencyZone;
  threshold: EquivalencyZone;
  tenK: EquivalencyZone;
  fiveK: EquivalencyZone;
  interval: EquivalencyZone;
  goal: GoalZone;
}

export type CalculateResult =
  | { ok: true; zones: PaceZones }
  | { ok: false; errors: ValidationError[] };

/** Round-half-up to the nearest integer. All inputs here are positive. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Linear interpolation over a sparse, ascending-by-`vdot` point set. Works
 * identically regardless of the gap between neighboring points (a gap of 2
 * is handled by the same code path as a gap of 1) since it walks whatever
 * points exist rather than assuming dense integer coverage — see
 * `vdotTable.ts`'s header comment for why several zones have real gaps.
 *
 * Clamps to the boundary point outside the table's range rather than
 * extrapolating: clamping only ever makes the output *more* conservative
 * (slower for the fast end, less aggressive for the slow end), never more
 * aggressive, in either direction.
 */
function interpolate(points: VdotPoint[], vdot: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    throw new Error("interpolate() requires a non-empty point set");
  }

  if (vdot <= first.vdot) return first.value;
  if (vdot >= last.vdot) return last.value;

  for (let i = 0; i < points.length - 1; i++) {
    const lower = points[i]!;
    const upper = points[i + 1]!;
    if (vdot === lower.vdot) return lower.value;
    if (vdot > lower.vdot && vdot < upper.vdot) {
      const fraction = (vdot - lower.vdot) / (upper.vdot - lower.vdot);
      return lower.value + fraction * (upper.value - lower.value);
    }
  }

  // Unreachable given the bounds checks above, but keeps the function total.
  return last.value;
}

/**
 * Recent race result -> VDOT, via Daniels & Gilbert's two continuous
 * equations (Daniels, J. *Daniels' Running Formula*, 4th ed., Human
 * Kinetics). No lookup table involved in this step.
 */
function vdotFromRecentResult(distanceMeters: number, timeSeconds: number): number {
  const t = timeSeconds / 60; // duration, minutes
  const v = distanceMeters / t; // velocity, meters/minute

  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pct =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t);

  return vo2 / pct;
}

function paceSecPerMile(distanceMeters: number, timeSeconds: number): number {
  const miles = distanceMeters / MILE_METERS;
  return roundHalfUp(timeSeconds / miles);
}

function computeEquivalencyZones(
  recentResult: RecentResultInput | undefined,
): Pick<PaceZones, "recovery" | "easy" | "threshold" | "tenK" | "fiveK" | "interval"> {
  if (!recentResult) {
    const blocked: EquivalencyZone = { state: "blocked" };
    return {
      recovery: blocked,
      easy: blocked,
      threshold: blocked,
      tenK: blocked,
      fiveK: blocked,
      interval: blocked,
    };
  }

  const distanceMeters = DISTANCE_METERS[recentResult.distance];
  const vdot = vdotFromRecentResult(distanceMeters, recentResult.timeSeconds);

  const easyPace = roundHalfUp(interpolate(EASY_TABLE, vdot));
  // Recovery is not a Daniels table value — see vdotTable.ts's header
  // comment. Both operands are already-rounded integers, so no further
  // rounding is needed for the sum.
  const recoveryPace = easyPace + RECOVERY_OFFSET_SECONDS_PER_MILE;

  return {
    recovery: { state: "computed", paceSecPerMile: recoveryPace },
    easy: { state: "computed", paceSecPerMile: easyPace },
    threshold: {
      state: "computed",
      paceSecPerMile: roundHalfUp(interpolate(THRESHOLD_TABLE, vdot)),
    },
    tenK: {
      state: "computed",
      paceSecPerMile: roundHalfUp(interpolate(TEN_K_TABLE, vdot)),
    },
    fiveK: {
      state: "computed",
      paceSecPerMile: roundHalfUp(interpolate(FIVE_K_TABLE, vdot)),
    },
    interval: {
      state: "computed",
      paceSecPerMile: roundHalfUp(interpolate(INTERVAL_TABLE, vdot)),
    },
  };
}

function computeGoalZone(goalTime: GoalTimeInput | undefined): GoalZone {
  if (!goalTime) {
    return { state: "unset" };
  }

  const distanceMeters = DISTANCE_METERS[goalTime.distance];
  return {
    state: "computed",
    label: goalTime.distance,
    paceSecPerMile: paceSecPerMile(distanceMeters, goalTime.timeSeconds),
  };
}

/**
 * Derive all 7 pace zones from a recent race result and/or a goal time.
 * Non-throwing: invalid input (e.g. an implausible race time) is rejected
 * before any zone math runs and reported via `{ ok: false, errors }`, never
 * thrown — callers (starting with #12's form submit handler) need to show
 * inline errors without a try/catch around a pure function.
 *
 * Providing only `recentResult` computes the six equivalency zones and
 * leaves `goal` `unset` (FR4). Providing only `goalTime` computes `goal`
 * and leaves the six equivalency zones `blocked` (FR5). Providing both
 * computes all seven — each zone family's state depends only on whether
 * *its own* input was provided. Providing neither is valid (not invalid
 * data, just none supplied) and leaves everything blocked/unset.
 */
export function calculate(input: unknown): CalculateResult {
  const parsed = calculatorInputSchema.safeParse(input);
  if (!parsed.success) {
    const errors: ValidationError[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { ok: false, errors };
  }

  const validated: CalculatorInput = parsed.data;

  const zones: PaceZones = {
    ...computeEquivalencyZones(validated.recentResult),
    goal: computeGoalZone(validated.goalTime),
  };

  return { ok: true, zones };
}
