# @training-plan/pace-zones

Framework-free VDOT/Riegel-style pace-zone calculator (#11, amended by #52).
Derives all 7 pace zones — Recovery, Easy, Threshold, 10K, 5K, Interval, and
a Goal zone — from a recent race result and/or a goal time. When only a goal
time is provided, the six equivalency zones fall back to a VDOT derived from
that goal time (#52) rather than staying blocked — see "Output contract"
below for the `source` tag this produces and the stated limitation that goes
with it. Pure, synchronous, non-throwing arithmetic: no DOM, no network, no
persistence.

Consumed directly by `apps/web` (#12's submit handler, #14's display) —
called client-side, not over the network. See
`docs/decisions/0005-plan-template-schema.md`-style reasoning docs for the
sourcing of the reference data in `src/vdotTable.ts`.

## Contents

- `src/schema.ts` — Zod schemas for the two inputs (`recentResult`,
  `goalTime`) plus the shared distance/plausibility-bounds constants. Zod is
  used only on input, not output — see "Why no Zod on the output" below.
- `src/vdotTable.ts` — sourced Daniels VDOT lookup data (Easy/Threshold/
  Interval/5K/10K), with citations and documented gaps/corrections; the
  Recovery-pace formula and its sourcing rationale; and
  `EQUIVALENCY_ZONE_DEFINITIONS`, the config-driven map each equivalency
  zone's pace computation is defined in. See the file's header comment for
  the two source URLs, the VDOT 66 Easy misprint, and the VDOT 45 Threshold
  cross-source discrepancy, and the comment above
  `RECOVERY_VO2_PERCENT_OF_VDOT` for Recovery's sourcing.
- `src/calculator.ts` — the pure `calculate()` entry point: VDOT derivation,
  table interpolation/VO2(v)-inversion dispatch, goal-pace division,
  zone-state assembly.
- `src/index.ts` — the public barrel export. Import from here, not from the
  individual source files.

## Usage

```ts
import { calculate } from "@training-plan/pace-zones";

const result = calculate({
  recentResult: { distance: "10k", timeSeconds: 2400 }, // 40:00
  goalTime: { distance: "marathon", timeSeconds: 4 * 60 * 60 }, // 4:00:00
});

if (!result.ok) {
  // result.errors: { path: string; message: string }[]
  // Show inline form errors — calculate() never throws.
} else {
  // result.zones: PaceZones
}
```

Either `recentResult`, `goalTime`, both, or neither may be provided —
`calculate()` accepts loosely-typed input (e.g. straight out of a form) and
validates it internally with Zod before any zone math runs.

## Output contract

`calculate()` returns:

```ts
type CalculateResult =
  | { ok: true; zones: PaceZones }
  | { ok: false; errors: { path: string; message: string }[] };
```

`ok: false` means the input itself was rejected — most commonly an
implausible race time (see the plausibility bounds table in `schema.ts`).
This is a distinct situation from a zone being "not yet computed"; invalid
input never becomes a zone state.

`PaceZones` has exactly 7 fixed keys, each independently typed:

```ts
type EquivalencyZoneSource = "recentResult" | "goalTime";

type EquivalencyZone =
  | { state: "computed"; paceSecPerMile: number; source: EquivalencyZoneSource }
  | { state: "blocked" }; // neither a recent result nor a goal time provided yet

type GoalZone =
  | { state: "computed"; label: "marathon" | "half"; paceSecPerMile: number }
  | { state: "unset" }; // no goal time provided yet

interface PaceZones {
  recovery: EquivalencyZone;
  easy: EquivalencyZone;
  threshold: EquivalencyZone;
  tenK: EquivalencyZone;
  fiveK: EquivalencyZone;
  interval: EquivalencyZone;
  goal: GoalZone;
}
```

The two zone families are deliberately different types, not one shared
3-state union:

- An **equivalency zone** (`recovery`/`easy`/`threshold`/`tenK`/`fiveK`/
  `interval`) can only ever be `computed` or `blocked`. It is `computed`
  whenever `recentResult` **or** `goalTime` was provided, and `blocked` —
  meaning "neither was provided yet", never anything else — only when both
  are absent. A `computed` zone always carries a `source` field
  (`"recentResult"` | `"goalTime"`) recording which input actually drove
  the derivation:
  - `source: "recentResult"` — derived from a demonstrated race result,
    exactly as before #52.
  - `source: "goalTime"` — derived (#52) from a VDOT computed off the goal
    time instead, as a **fallback only used when no `recentResult` was
    provided**. This is the same VDOT-derivation math, run on an
    aspirational target rather than a demonstrated performance — see
    "Goal-derived fallback (#52)" below for the caveat that must ship
    alongside any UI that surfaces it.
  - `recentResult` always wins when both are provided: the six equivalency
    zones' `source` is `"recentResult"` in that case, never `"goalTime"`.
- The **goal zone** can only ever be `computed` or `unset`. It is
  `computed` whenever `goalTime` was provided, and `unset` — meaning "no
  goal time yet" — otherwise. `label` records which distance
  (`"marathon"` | `"half"`) the runner actually entered; it is not a fixed
  pair of always-present marathon+half slots. The goal zone has **no**
  `source` field — unlike the six equivalency zones, it only ever has one
  possible source (the goal time itself), so the field would carry no
  information.

Consumers get real type narrowing (`if (zone.state === "computed")`) and can
write an exhaustive `switch` per zone with no optional chaining and no
silent `undefined`. Because the domain-impossible combinations
("equivalency zone is unset", "goal zone is blocked") don't exist as types,
there is nothing to defensively handle for them.

### Goal-derived fallback (#52)

When `goalTime` is provided and `recentResult` is not, the six equivalency
zones are derived from a VDOT computed off the goal time — via the exact
same distance+time → VDOT transform used for a recent result — rather than
staying `blocked`. Every equivalency zone gets this fallback uniformly;
there is no per-zone exclusion by distance-similarity to the goal, because
VDOT is a single unified aerobic-capacity number in Daniels' model — there
is no principled basis for trusting it for, say, Threshold but not Interval.

**Stated limitation (accepted v1 gap, not solved by this package):** the
goal-time fallback cannot detect an *optimistic-but-plausible* (not absurd —
implausible times are already rejected by `schema.ts`'s bounds) goal time,
because there is nothing to cross-check it against when no recent result
exists. A runner whose goal is a stretch, not a realistic near-term target,
will get all six equivalency zones — especially Interval and 5K — skewed
faster than their current fitness actually supports, with no way for this
package to detect that from a goal time alone. Any caller rendering these
values must carry a visible caveat that they are aspirational, not
demonstrated (tracked in `apps/web` via #12/#14, driven by this `source`
field) — this package cannot express that caveat itself, only tag the data
so a caller can.

### Providing both inputs

Providing both `recentResult` and `goalTime` is valid and expected: all 7
zones compute, with the six equivalency zones' `source` always
`"recentResult"` in that case (demonstrated fitness beats an aspirational
target) — `goalTime`-derived is only ever a fallback for when no
`recentResult` exists. The `goal` zone is unaffected either way, since it is
never VDOT-derived.

### Providing neither input

Providing neither `recentResult` nor `goalTime` is also valid (there's no
invalid data to reject, just none supplied) — every equivalency zone is
`blocked` and `goal` is `unset`.

## Units

All paces are **integer seconds per mile**, rounded once (round-half-up)
inside this package. This package never parses or formats `"H:MM:SS"`
strings in either direction:

- Callers (e.g. #12's form) are responsible for parsing a typed time into
  integer seconds *before* calling `calculate()`.
- Callers (e.g. #14's display) are responsible for formatting the returned
  `paceSecPerMile` back into a display string.

This keeps the function itself framework-free and keeps rounding in exactly
one place, so two different screens can never disagree about the same
zone's displayed pace because they each rounded independently.

## Algorithm summary

- **Recent race result → VDOT**: Daniels & Gilbert's two continuous
  equations (no lookup table in this step).
- **Goal time → VDOT, as a fallback (#52)**: the exact same
  distance+time → VDOT transform above, reused as-is on the goal time's
  distance+time, only when no `recentResult` was provided. Nothing about
  the transform itself is specific to a "recent result" — it is a generic
  distance+time → VDOT function, so applying it to an aspirational target
  instead of a demonstrated one is arithmetically identical; only the
  *interpretation* differs (see "Goal-derived fallback (#52)" above).
- **VDOT → Easy/Threshold/10K/5K/Interval**: linear interpolation over the
  sourced VDOT tables in `vdotTable.ts`, uniformly for all five
  table-interpolated zones, regardless of whether that VDOT came from a
  recent result or, as a fallback, a goal time. The two out-of-range
  directions are handled differently, not symmetrically: above the table's
  top boundary (VDOT 85, narrower for the sparser 10K anchors),
  `interpolate()` clamps to the boundary row rather than extrapolating —
  genuinely conservative, since it can only make the pace slower than a
  faster-than-table runner's real fitness. Below the table's bottom
  boundary (VDOT 30, i.e. below `VDOT_TABLE_MIN`), clamping would do the
  opposite — hand out a pace *faster* than the runner's demonstrated
  fitness supports — so `calculate()` rejects a below-`VDOT_TABLE_MIN` VDOT
  outright, via `{ ok: false }`, before interpolation ever runs on it. This
  guardrail applies to **both** paths that can produce a VDOT (#52): a
  below-range `recentResult`-derived VDOT is rejected with `path:
  "recentResult"`, and a below-range `goalTime`-derived VDOT (only reached
  when no `recentResult` was provided) is rejected the same way with `path:
  "goalTime"` and a message reworded to point at the goal time rather than
  a race result — without this, a slow-but-plausible goal time would
  otherwise reach `interpolate()` with an out-of-range VDOT and get clamped
  up to the table floor, handing out a faster-than-earned pace, the exact
  failure mode this guardrail exists to prevent on either input. Recovery
  is derived differently — see below.
- **Goal time → goal pace**: a direct division
  (`goalTimeSeconds / (goalDistanceMeters / 1609.344)`) — no VDOT involved.
  This is why a goal zone is never "equivalency-derived": it doesn't share
  any code path with the six equivalency zones above, and is deliberately
  not part of the config-driven table described below.
- **Recovery** is the pace at **59% VO2max** — Daniels' cited E-pace-zone
  floor (his own methodology has no distinct "Recovery" sub-zone; see below)
  — solved from the same `VO2(v)` equation used in the recent-result → VDOT
  step above, inverted for velocity, rather than an offset from Easy. See
  `vdotTable.ts`'s comment above `RECOVERY_VO2_PERCENT_OF_VDOT` for the full,
  three-part sourcing rationale (cited fact / our own table's empirical
  anchor / this product's convention) and why the Easy-to-Recovery gap is
  *not* constant across VDOT.

### Config-driven zone computation

Each of the six equivalency zones' pace-from-VDOT logic is one entry in
`EQUIVALENCY_ZONE_DEFINITIONS` (`vdotTable.ts`), not a hand-written case in
`calculator.ts`. A zone's `ZoneComputation` is either `{ method:
"interpolateTable", table }` (the five sourced Daniels columns) or `{
method: "vo2PercentOfVdot", percent }` (Recovery's VO2(v)-inversion path).
`calculator.ts`'s `calculate()` derives VDOT (and which input produced it,
i.e. `source` — #52) once per call, then `computeEquivalencyZones` maps
every entry in `EQUIVALENCY_ZONE_DEFINITIONS` through one generic
`computeZoneValue()` dispatcher, tagging each result with that same
`source` — there's no per-zone function to write, and `computeEquivalencyZones`
itself has no notion of *how* the VDOT it was handed was derived.

Adding a future VDOT-derived equivalency zone (e.g. from a target/benchmark
time) means: add its id to `EquivalencyZoneId`, add one field to `PaceZones`,
and add one entry to `EQUIVALENCY_ZONE_DEFINITIONS` — no new computation
function, and no change to `computeEquivalencyZones` itself. The `goal` zone
is intentionally excluded from this table (see `computeGoalZone`'s comment
in `calculator.ts`): it's a direct time/distance division with no VDOT
involved, a fundamentally different input shape than the other six.

"Riegel" in the issue title refers to Riegel's race-time-prediction power
law, a different tool that predicts a race time at a different *distance*
and has no concept of a training-intensity zone — it plays no role in this
package's runtime path.

## Why no Zod on the output

Zod is used on the two *inputs* because they come from a loosely-typed form
(#12). The output is produced entirely by this package's own trusted code,
never parsed from an untrusted source, so it's a plain TypeScript type
(`PaceZones`), not a runtime-validated schema. Revisit only if this
computation ever moves server-side and crosses the REST/OpenAPI wire (see
ADR 0002) — it does not today; `calculate()` is called directly from
`apps/web`.

## Local development

```sh
pnpm --filter @training-plan/pace-zones test
pnpm --filter @training-plan/pace-zones build
```
