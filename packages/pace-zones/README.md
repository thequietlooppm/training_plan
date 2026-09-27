# @training-plan/pace-zones

Framework-free VDOT/Riegel-style pace-zone calculator (#11). Derives all 7
pace zones — Recovery, Easy, Threshold, 10K, 5K, Interval, and a Goal
zone — from a recent race result and/or a goal time. Pure, synchronous,
non-throwing arithmetic: no DOM, no network, no persistence.

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
type EquivalencyZone =
  | { state: "computed"; paceSecPerMile: number }
  | { state: "blocked" }; // no recent result provided yet

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
  whenever `recentResult` was provided (regardless of whether `goalTime`
  was also provided), and `blocked` — meaning "no recent result yet",
  never anything else — otherwise.
- The **goal zone** can only ever be `computed` or `unset`. It is
  `computed` whenever `goalTime` was provided, and `unset` — meaning "no
  goal time yet" — otherwise. `label` records which distance
  (`"marathon"` | `"half"`) the runner actually entered; it is not a fixed
  pair of always-present marathon+half slots.

Consumers get real type narrowing (`if (zone.state === "computed")`) and can
write an exhaustive `switch` per zone with no optional chaining and no
silent `undefined`. Because the domain-impossible combinations
("equivalency zone is unset", "goal zone is blocked") don't exist as types,
there is nothing to defensively handle for them.

### Providing both inputs

Providing both `recentResult` and `goalTime` is valid and expected: all 7
zones compute. Each zone family's state depends only on whether *its own*
input was provided — there's no shared "source" to reconcile between the
two.

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
- **VDOT → Easy/Threshold/10K/5K/Interval**: linear interpolation over the
  sourced VDOT tables in `vdotTable.ts`, uniformly for all five
  table-interpolated zones. Clamps at the table boundary (VDOT 30 / 85,
  narrower for the sparser 10K anchors) rather than extrapolating. Recovery
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
`calculator.ts`'s `computeEquivalencyZones` derives VDOT once per call, then
maps every entry in `EQUIVALENCY_ZONE_DEFINITIONS` through one generic
`computeZoneValue()` dispatcher — there's no per-zone function to write.

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
