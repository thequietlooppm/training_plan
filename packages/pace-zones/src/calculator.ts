import {
  DISTANCE_METERS,
  calculatorInputSchema,
  type CalculatorInput,
  type GoalTimeInput,
} from "./schema.js";
import {
  EQUIVALENCY_ZONE_DEFINITIONS,
  VDOT_TABLE_MIN,
  type EquivalencyZoneId,
  type VdotPoint,
  type ZoneComputation,
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
 * Clamps to the boundary point above the table's range rather than
 * extrapolating: a VDOT above `last.vdot` is genuinely conservative to clamp
 * (a faster-than-table runner gets a slower-than-deserved pace, never a
 * faster one). The `vdot <= first.vdot` branch below is *not* the mirror-image
 * safe case — clamping a below-range VDOT up to `first.value` would hand out
 * a pace *faster* than that runner's demonstrated fitness supports, which is
 * unsafe, not conservative. That's why it's not this function's job to
 * reject a below-range VDOT: `calculate()` already rejects any
 * recentResult-derived VDOT below `VDOT_TABLE_MIN` (see `vdotTable.ts`)
 * before `interpolate()` is ever called with it, so in practice this branch
 * is only ever reached at an exact boundary match (`vdot === first.vdot`),
 * never as a genuine clamp-up-from-below. It's kept as a `<=` (rather than
 * narrowed to `===`) for two reasons: correctness at the exact boundary
 * either way, and defensive robustness if a future zone's table ever starts
 * above `VDOT_TABLE_MIN` (per-zone floors are not currently enforced
 * upstream, only the table-wide minimum is).
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

/**
 * Inverts the same VO2(v) equation used above (`vo2 = -4.6 + 0.182258*v +
 * 0.000104*v^2`) to solve for velocity (meters/minute) given a target VO2
 * (ml/kg/min), rather than a lookup table. Used by `computeZoneValue`'s
 * `vo2PercentOfVdot` branch — currently only Recovery, see `vdotTable.ts`'s
 * comment above `RECOVERY_VO2_PERCENT_OF_VDOT` for why.
 *
 * Rearranged as a quadratic in `v`:
 *   0.000104*v^2 + 0.182258*v + (-4.6 - targetVo2) = 0
 * with `a = 0.000104`, `b = 0.182258`, `c = -4.6 - targetVo2`. Solved via
 * the quadratic formula, taking the `+` root:
 *   v = (-b + sqrt(b^2 - 4ac)) / (2a)
 *
 * This is guaranteed to be the correct, unique positive root for any
 * realistic VDOT, so there's no defensive handling below for a
 * negative-discriminant or negative-root case:
 * - `a = 0.000104 > 0` always.
 * - `targetVo2` is a positive percentage of a positive VDOT, so
 *   `c = -4.6 - targetVo2 < 0` always.
 * - Whenever `a > 0` and `c < 0`, `-4ac > 0`, so the discriminant
 *   `b^2 - 4ac` is strictly greater than `b^2` — always positive, never
 *   the negative-discriminant case a general quadratic solver has to guard.
 * - With the discriminant `> b^2`, `sqrt(discriminant) > |b|`, so the `+`
 *   root `(-b + sqrt(discriminant)) / (2a)` is always positive (a real
 *   velocity) and the `-` root would always be negative (physically
 *   meaningless) — so returning the `+` root is unconditionally correct
 *   here, not merely the common case.
 */
function velocityFromVo2(targetVo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - targetVo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/**
 * Dispatches a single equivalency zone's `ZoneComputation` (see
 * `vdotTable.ts`) into a pace value (seconds/mile, unrounded — the caller
 * rounds once via `roundHalfUp`). The two branches are the only two ways an
 * equivalency zone's pace gets derived from a VDOT today:
 * - `interpolateTable`: linear interpolation over a sourced Daniels column.
 * - `vo2PercentOfVdot`: invert the VO2(v) equation for velocity at a target
 *   %VO2max, then convert velocity to pace.
 */
function computeZoneValue(computation: ZoneComputation, vdot: number): number {
  switch (computation.method) {
    case "interpolateTable":
      return interpolate(computation.table, vdot);
    case "vo2PercentOfVdot": {
      const targetVo2 = computation.percent * vdot;
      const velocityMetersPerMinute = velocityFromVo2(targetVo2);
      return (MILE_METERS * 60) / velocityMetersPerMinute;
    }
  }
}

function paceSecPerMile(distanceMeters: number, timeSeconds: number): number {
  const miles = distanceMeters / MILE_METERS;
  return roundHalfUp(timeSeconds / miles);
}

/**
 * Every equivalency-zone id, in the same order `EQUIVALENCY_ZONE_DEFINITIONS`
 * declares them. Kept as a plain array (rather than re-deriving it from the
 * `Record` at runtime) so the `blocked` branch below doesn't need to iterate
 * anything to build its all-`blocked` result.
 */
const EQUIVALENCY_ZONE_IDS = Object.keys(
  EQUIVALENCY_ZONE_DEFINITIONS,
) as EquivalencyZoneId[];

/**
 * Takes an already-derived `vdot` (or `undefined` if no recent result was
 * provided) rather than a `RecentResultInput` — `calculate()` derives VDOT
 * itself (via `vdotFromRecentResult`) so it can validate it against
 * `VDOT_TABLE_MIN` and return `{ ok: false }` *before* this function, or
 * `interpolate()`, ever runs on an out-of-range value. This function no
 * longer knows how VDOT is derived from a race result at all.
 */
function computeEquivalencyZones(vdot: number | undefined): Pick<PaceZones, EquivalencyZoneId> {
  if (vdot === undefined) {
    // Each zone gets its own object literal, not a single object literal
    // shared by reference across all six keys — they're independent zones
    // that happen to share a state today, not aliases of each other.
    const zones = {} as Pick<PaceZones, EquivalencyZoneId>;
    for (const id of EQUIVALENCY_ZONE_IDS) {
      zones[id] = { state: "blocked" };
    }
    return zones;
  }

  const zones = {} as Pick<PaceZones, EquivalencyZoneId>;
  for (const id of EQUIVALENCY_ZONE_IDS) {
    zones[id] = {
      state: "computed",
      paceSecPerMile: roundHalfUp(computeZoneValue(EQUIVALENCY_ZONE_DEFINITIONS[id], vdot)),
    };
  }
  return zones;
}

/**
 * The goal zone is deliberately *not* one of the `EQUIVALENCY_ZONE_DEFINITIONS`
 * entries above, and never will be by adding a config entry alone: it's a
 * direct time/distance division with no VDOT involved at all, a
 * fundamentally different input shape (a distance+time the runner entered
 * directly, not a VDOT-derived equivalency). The config-driven refactor
 * above is about future *VDOT-derived* equivalency zones (e.g. from a
 * target/benchmark time feeding into VDOT) — not about generalizing this
 * path too.
 */
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

  // VDOT is derived here, once, rather than inside `computeEquivalencyZones`,
  // so it can be validated against `VDOT_TABLE_MIN` and rejected via
  // `{ ok: false }` *before* any zone math (interpolation or VO2(v)-inversion)
  // ever runs on it. See `vdotTable.ts`'s header comment and
  // `interpolate()`'s docstring for why a below-range VDOT must be rejected
  // outright rather than clamped up to the table's floor: clamping up would
  // hand the runner paces faster than their demonstrated fitness supports.
  let vdot: number | undefined;
  if (validated.recentResult) {
    const distanceMeters = DISTANCE_METERS[validated.recentResult.distance];
    vdot = vdotFromRecentResult(distanceMeters, validated.recentResult.timeSeconds);

    // Tiny epsilon, not a strict `<`, so a genuinely-at-the-boundary VDOT
    // (e.g. a recent result that round-trips to ~30.0000001 through
    // floating-point arithmetic) is never incorrectly rejected.
    if (vdot < VDOT_TABLE_MIN - 1e-6) {
      return {
        ok: false,
        errors: [
          {
            path: "recentResult",
            message: `This result derives a VDOT of ${vdot.toFixed(1)}, below the supported table range (VDOT ${VDOT_TABLE_MIN}+). Try a faster recent result, or a longer/more standard race distance.`,
          },
        ],
      };
    }
  }

  const zones: PaceZones = {
    ...computeEquivalencyZones(vdot),
    goal: computeGoalZone(validated.goalTime),
  };

  return { ok: true, zones };
}
