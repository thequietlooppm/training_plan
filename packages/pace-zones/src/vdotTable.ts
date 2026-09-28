/**
 * Sourced Daniels VDOT reference data, in integer seconds per mile.
 *
 * Primary source: Jack Daniels' "VDOT" one-sheet,
 * https://www.sdtrackmag.com/DanielsOneSheet.pdf (read directly, text +
 * visual). Cross-checked against
 * https://www.brenoamelo.com/blog/vdot-pace-chart-printable, which cites
 * Daniels, J. *Daniels' Running Formula*, 4th ed., Human Kinetics.
 *
 * Each zone is its own sparse `{ vdot, value }[]` array, sorted by `vdot`,
 * rather than one row-object per integer VDOT. Two documented reasons this
 * matters:
 *
 * 1. VDOT 31/33/35/37/39/41/43 are simply absent from the primary source
 *    (confirmed by direct read, not an extraction gap) — 49 of the possible
 *    56 rows (30-85) are present. `calculator.ts`'s interpolation walks
 *    whatever points exist for a given zone, so a gap of 2 (30->32) is
 *    handled by the exact same code path as a gap of 1 (44->45). No zone
 *    array below assumes dense integer coverage.
 * 2. VDOT 66's Easy/Long cell reads 6:53/mi in the primary source, which
 *    breaks the monotonic pace trend every neighboring row follows
 *    (65 -> 6:40/mi, 67 -> 6:30/mi) - a near-certain misprint. That one point
 *    is dropped from the EASY array only (letting interpolation between 65
 *    and 67 derive it) while VDOT 66's Threshold/Interval/5K values, which
 *    are internally consistent, are kept in their arrays.
 *
 * VDOT 45 Threshold has a genuine 2-second discrepancy between the two
 * sources (7:25 primary vs 7:27 secondary) - this file uses 7:25 (445s),
 * from the primary source. `calculator.test.ts` uses a +/-2 sec/mile
 * tolerance against this table specifically to absorb that kind of
 * legitimate source-rounding drift without flapping on a real regression.
 *
 * Daniels' table has no 10K column at all (confirmed by direct read, not an
 * extraction gap). TEN_K below is sourced from the secondary source's 9
 * sparse anchor points (VDOT 30/35/40/45/50/55/60/65/70) instead - a known,
 * accepted v1 accuracy limitation: interpolation error over a 5-VDOT gap is
 * larger than the 1-2-VDOT gaps elsewhere in this file. Revisit if a fuller
 * 10K source turns up.
 *
 * Values below VDOT 30 or above VDOT 85 are not covered by any array here.
 * The two directions are handled differently, because they are not
 * symmetric safety-wise:
 * - Above VDOT 85: `calculator.ts`'s `interpolate()` clamps to the top
 *   boundary row rather than extrapolating. That's genuinely conservative —
 *   a faster-than-table runner gets a slower-than-deserved pace, never a
 *   faster one.
 * - Below VDOT 30 (i.e. below `VDOT_TABLE_MIN`): clamping up to the bottom
 *   boundary row would do the opposite — hand a runner paces *faster* than
 *   their demonstrated fitness supports, which is unsafe, not conservative.
 *   `calculator.ts`'s `calculate()` therefore rejects a below-`VDOT_TABLE_MIN`
 *   derived VDOT with `{ ok: false }` *before* any interpolation runs, rather
 *   than clamping it.
 */

export interface VdotPoint {
  vdot: number;
  /** Pace in integer seconds per mile. */
  value: number;
}

/** Daniels' "Easy/Long" column. VDOT 66 omitted - see header comment. */
export const EASY_TABLE: VdotPoint[] = [
  { vdot: 30, value: 736 }, // 12:16/mi
  { vdot: 32, value: 701 }, // 11:41/mi
  { vdot: 34, value: 669 }, // 11:09/mi
  { vdot: 36, value: 640 }, // 10:40/mi
  { vdot: 38, value: 614 }, // 10:14/mi
  { vdot: 40, value: 590 }, // 9:50/mi
  { vdot: 42, value: 568 }, // 9:28/mi
  { vdot: 44, value: 547 }, // 9:07/mi
  { vdot: 45, value: 538 }, // 8:58/mi
  { vdot: 46, value: 528 }, // 8:48/mi
  { vdot: 47, value: 519 }, // 8:39/mi
  { vdot: 48, value: 511 }, // 8:31/mi
  { vdot: 49, value: 502 }, // 8:22/mi
  { vdot: 50, value: 494 }, // 8:14/mi
  { vdot: 51, value: 487 }, // 8:07/mi
  { vdot: 52, value: 479 }, // 7:59/mi
  { vdot: 53, value: 472 }, // 7:52/mi
  { vdot: 54, value: 465 }, // 7:45/mi
  { vdot: 55, value: 458 }, // 7:38/mi
  { vdot: 56, value: 451 }, // 7:31/mi
  { vdot: 57, value: 445 }, // 7:25/mi
  { vdot: 58, value: 439 }, // 7:19/mi
  { vdot: 59, value: 433 }, // 7:13/mi
  { vdot: 60, value: 427 }, // 7:07/mi
  { vdot: 61, value: 421 }, // 7:01/mi
  { vdot: 62, value: 416 }, // 6:56/mi
  { vdot: 63, value: 410 }, // 6:50/mi
  { vdot: 64, value: 405 }, // 6:45/mi
  { vdot: 65, value: 400 }, // 6:40/mi
  // vdot 66 intentionally omitted - documented misprint, see header comment
  { vdot: 67, value: 390 }, // 6:30/mi
  { vdot: 68, value: 386 }, // 6:26/mi
  { vdot: 69, value: 381 }, // 6:21/mi
  { vdot: 70, value: 377 }, // 6:17/mi
  { vdot: 71, value: 372 }, // 6:12/mi
  { vdot: 72, value: 368 }, // 6:08/mi
  { vdot: 73, value: 364 }, // 6:04/mi
  { vdot: 74, value: 360 }, // 6:00/mi
  { vdot: 75, value: 356 }, // 5:56/mi
  { vdot: 76, value: 352 }, // 5:52/mi
  { vdot: 77, value: 348 }, // 5:48/mi
  { vdot: 78, value: 345 }, // 5:45/mi
  { vdot: 79, value: 341 }, // 5:41/mi
  { vdot: 80, value: 338 }, // 5:38/mi
  { vdot: 81, value: 334 }, // 5:34/mi
  { vdot: 82, value: 331 }, // 5:31/mi
  { vdot: 83, value: 328 }, // 5:28/mi
  { vdot: 84, value: 325 }, // 5:25/mi
  { vdot: 85, value: 321 }, // 5:21/mi
];

/** Daniels' "Threshold" column. */
export const THRESHOLD_TABLE: VdotPoint[] = [
  { vdot: 30, value: 618 }, // 10:18/mi
  { vdot: 32, value: 587 }, // 9:47/mi
  { vdot: 34, value: 560 }, // 9:20/mi
  { vdot: 36, value: 535 }, // 8:55/mi
  { vdot: 38, value: 513 }, // 8:33/mi
  { vdot: 40, value: 492 }, // 8:12/mi
  { vdot: 42, value: 472 }, // 7:52/mi
  { vdot: 44, value: 453 }, // 7:33/mi
  { vdot: 45, value: 445 }, // 7:25/mi (primary source; secondary reads 7:27)
  { vdot: 46, value: 437 }, // 7:17/mi
  { vdot: 47, value: 430 }, // 7:10/mi
  { vdot: 48, value: 422 }, // 7:02/mi
  { vdot: 49, value: 415 }, // 6:55/mi
  { vdot: 50, value: 411 }, // 6:51/mi
  { vdot: 51, value: 404 }, // 6:44/mi
  { vdot: 52, value: 398 }, // 6:38/mi
  { vdot: 53, value: 392 }, // 6:32/mi
  { vdot: 54, value: 386 }, // 6:26/mi
  { vdot: 55, value: 380 }, // 6:20/mi
  { vdot: 56, value: 375 }, // 6:15/mi
  { vdot: 57, value: 369 }, // 6:09/mi
  { vdot: 58, value: 364 }, // 6:04/mi
  { vdot: 59, value: 359 }, // 5:59/mi
  { vdot: 60, value: 354 }, // 5:54/mi
  { vdot: 61, value: 350 }, // 5:50/mi
  { vdot: 62, value: 345 }, // 5:45/mi
  { vdot: 63, value: 341 }, // 5:41/mi
  { vdot: 64, value: 336 }, // 5:36/mi
  { vdot: 65, value: 332 }, // 5:32/mi
  { vdot: 66, value: 328 }, // 5:28/mi
  { vdot: 67, value: 324 }, // 5:24/mi
  { vdot: 68, value: 320 }, // 5:20/mi
  { vdot: 69, value: 316 }, // 5:16/mi
  { vdot: 70, value: 313 }, // 5:13/mi
  { vdot: 71, value: 309 }, // 5:09/mi
  { vdot: 72, value: 305 }, // 5:05/mi
  { vdot: 73, value: 302 }, // 5:02/mi
  { vdot: 74, value: 299 }, // 4:59/mi
  { vdot: 75, value: 296 }, // 4:56/mi
  { vdot: 76, value: 292 }, // 4:52/mi
  { vdot: 77, value: 289 }, // 4:49/mi
  { vdot: 78, value: 286 }, // 4:46/mi
  { vdot: 79, value: 283 }, // 4:43/mi
  { vdot: 80, value: 281 }, // 4:41/mi
  { vdot: 81, value: 278 }, // 4:38/mi
  { vdot: 82, value: 275 }, // 4:35/mi
  { vdot: 83, value: 272 }, // 4:32/mi
  { vdot: 84, value: 270 }, // 4:30/mi
  { vdot: 85, value: 267 }, // 4:27/mi
];

/** Daniels' "Interval" column. */
export const INTERVAL_TABLE: VdotPoint[] = [
  { vdot: 30, value: 571 }, // 9:31/mi
  { vdot: 32, value: 539 }, // 8:59/mi
  { vdot: 34, value: 515 }, // 8:35/mi
  { vdot: 36, value: 491 }, // 8:11/mi
  { vdot: 38, value: 467 }, // 7:47/mi
  { vdot: 40, value: 451 }, // 7:31/mi
  { vdot: 42, value: 435 }, // 7:15/mi
  { vdot: 44, value: 418 }, // 6:58/mi
  { vdot: 45, value: 410 }, // 6:50/mi
  { vdot: 46, value: 402 }, // 6:42/mi
  { vdot: 47, value: 394 }, // 6:34/mi
  { vdot: 48, value: 386 }, // 6:26/mi
  { vdot: 49, value: 382 }, // 6:22/mi
  { vdot: 50, value: 374 }, // 6:14/mi
  { vdot: 51, value: 370 }, // 6:10/mi
  { vdot: 52, value: 366 }, // 6:06/mi
  { vdot: 53, value: 362 }, // 6:02/mi
  { vdot: 54, value: 354 }, // 5:54/mi
  { vdot: 55, value: 350 }, // 5:50/mi
  { vdot: 56, value: 346 }, // 5:46/mi
  { vdot: 57, value: 342 }, // 5:42/mi
  { vdot: 58, value: 334 }, // 5:34/mi
  { vdot: 59, value: 330 }, // 5:30/mi
  { vdot: 60, value: 326 }, // 5:26/mi
  { vdot: 61, value: 322 }, // 5:22/mi
  { vdot: 62, value: 318 }, // 5:18/mi
  { vdot: 63, value: 314 }, // 5:14/mi
  { vdot: 64, value: 310 }, // 5:10/mi
  { vdot: 65, value: 306 }, // 5:06/mi
  { vdot: 66, value: 300 }, // 5:00/mi
  { vdot: 67, value: 297 }, // 4:57/mi
  { vdot: 68, value: 293 }, // 4:53/mi
  { vdot: 69, value: 290 }, // 4:50/mi
  { vdot: 70, value: 286 }, // 4:46/mi
  { vdot: 71, value: 283 }, // 4:43/mi
  { vdot: 72, value: 280 }, // 4:40/mi
  { vdot: 73, value: 277 }, // 4:37/mi
  { vdot: 74, value: 274 }, // 4:34/mi
  { vdot: 75, value: 271 }, // 4:31/mi
  { vdot: 76, value: 268 }, // 4:28/mi
  { vdot: 77, value: 265 }, // 4:25/mi
  { vdot: 78, value: 263 }, // 4:23/mi
  { vdot: 79, value: 260 }, // 4:20/mi
  { vdot: 80, value: 257 }, // 4:17/mi
  { vdot: 81, value: 255 }, // 4:15/mi
  { vdot: 82, value: 252 }, // 4:12/mi
  { vdot: 83, value: 250 }, // 4:10/mi
  { vdot: 84, value: 248 }, // 4:08/mi
  { vdot: 85, value: 245 }, // 4:05/mi
];

/** Daniels' 5K-time column, converted to pace per mile. */
export const FIVE_K_TABLE: VdotPoint[] = [
  { vdot: 30, value: 592 }, // 9:52/mi
  { vdot: 32, value: 562 }, // 9:22/mi
  { vdot: 34, value: 534 }, // 8:54/mi
  { vdot: 36, value: 509 }, // 8:29/mi
  { vdot: 38, value: 487 }, // 8:07/mi
  { vdot: 40, value: 466 }, // 7:46/mi
  { vdot: 42, value: 447 }, // 7:27/mi
  { vdot: 44, value: 430 }, // 7:10/mi
  { vdot: 45, value: 422 }, // 7:02/mi
  { vdot: 46, value: 414 }, // 6:54/mi
  { vdot: 47, value: 406 }, // 6:46/mi
  { vdot: 48, value: 399 }, // 6:39/mi
  { vdot: 49, value: 392 }, // 6:32/mi
  { vdot: 50, value: 385 }, // 6:25/mi
  { vdot: 51, value: 379 }, // 6:19/mi
  { vdot: 52, value: 372 }, // 6:12/mi
  { vdot: 53, value: 366 }, // 6:06/mi
  { vdot: 54, value: 361 }, // 6:01/mi
  { vdot: 55, value: 355 }, // 5:55/mi
  { vdot: 56, value: 349 }, // 5:49/mi
  { vdot: 57, value: 344 }, // 5:44/mi
  { vdot: 58, value: 339 }, // 5:39/mi
  { vdot: 59, value: 334 }, // 5:34/mi
  { vdot: 60, value: 329 }, // 5:29/mi
  { vdot: 61, value: 324 }, // 5:24/mi
  { vdot: 62, value: 320 }, // 5:20/mi
  { vdot: 63, value: 315 }, // 5:15/mi
  { vdot: 64, value: 311 }, // 5:11/mi
  { vdot: 65, value: 307 }, // 5:07/mi
  { vdot: 66, value: 303 }, // 5:03/mi
  { vdot: 67, value: 299 }, // 4:59/mi
  { vdot: 68, value: 296 }, // 4:56/mi
  { vdot: 69, value: 292 }, // 4:52/mi
  { vdot: 70, value: 288 }, // 4:48/mi
  { vdot: 71, value: 285 }, // 4:45/mi
  { vdot: 72, value: 281 }, // 4:41/mi
  { vdot: 73, value: 278 }, // 4:38/mi
  { vdot: 74, value: 275 }, // 4:35/mi
  { vdot: 75, value: 271 }, // 4:31/mi
  { vdot: 76, value: 268 }, // 4:28/mi
  { vdot: 77, value: 265 }, // 4:25/mi
  { vdot: 78, value: 262 }, // 4:22/mi
  { vdot: 79, value: 259 }, // 4:19/mi
  { vdot: 80, value: 257 }, // 4:17/mi
  { vdot: 81, value: 254 }, // 4:14/mi
  { vdot: 82, value: 251 }, // 4:11/mi
  { vdot: 83, value: 249 }, // 4:09/mi
  { vdot: 84, value: 246 }, // 4:06/mi
  { vdot: 85, value: 244 }, // 4:04/mi
];

/**
 * 10K pace per mile, from the secondary source's 9 sparse anchor points
 * (VDOT 30/35/40/45/50/55/60/65/70) - Daniels' own table has no 10K column.
 * See header comment for the accuracy tradeoff this implies.
 */
export const TEN_K_TABLE: VdotPoint[] = [
  { vdot: 30, value: 616 }, // 10:16/mi
  { vdot: 35, value: 541 }, // 9:01/mi
  { vdot: 40, value: 483 }, // 8:03/mi
  { vdot: 45, value: 437 }, // 7:17/mi
  { vdot: 50, value: 399 }, // 6:39/mi
  { vdot: 55, value: 368 }, // 6:08/mi
  { vdot: 60, value: 342 }, // 5:42/mi
  { vdot: 65, value: 319 }, // 5:19/mi
  { vdot: 70, value: 299 }, // 4:59/mi
];

/**
 * Recovery pace, unlike the five zones above, is not read off a Daniels
 * table row — it's derived from the same VO2(v) equation `calculator.ts`
 * already uses for the recent-result -> VDOT step, inverted to solve for
 * velocity at a target %VO2max. Three separate claims, kept explicit and in
 * this order so a future reader doesn't conflate them:
 *
 * 1. Cited fact: Daniels' own methodology has no distinct, separately-named
 *    "Recovery" zone. His named zones are E (Easy/Long), M (Marathon), T
 *    (Threshold), I (Interval), and R (Repetition) — "Recovery" appears
 *    nowhere as one of his zone labels. Multiple convergent secondary
 *    sources describe his E-pace zone as spanning a %VO2max *range*, not a
 *    single point: ~59-74% (some editions ~70-79%). Sources: Coach Ray,
 *    "Jack Daniels' Running Intensity"
 *    (https://www.coachray.nz/2023/05/03/jack-daniels-running-intensity/),
 *    Shuichi Running, "Easy Run Training: Jack Daniels' E Pace & Heart Rate
 *    Zones" (https://shuichi-running.com/en/easy-run-training/), and
 *    Teesche's review of *Daniels' Running Formula*
 *    (https://www.teesche.com/bookshelf/jack_daniels_daniels_running_formula).
 *    No source assigns
 *    "recovery" its own distinct percentage — it's described only in prose
 *    as the slow end of easy effort.
 * 2. Empirical fact about our own data: this file's own sourced EASY_TABLE
 *    above, back-calculated through the VO2(v) equation for every row
 *    (invert VO2 -> velocity -> compare to the table's velocity), is
 *    internally consistent with a single ~70% VO2max anchor — not a range.
 *    Measured band: 69.86%-70.34% across VDOT 30-85, a very tight spread.
 *    This table and the cited 59-74% range in (1) come from two different
 *    sourcing lineages describing two different things (one edition's
 *    single-point table vs. a cross-edition range description) — not noise,
 *    and not in tension with each other.
 * 3. Product convention (explicitly ours, not Daniels-published): Recovery
 *    pace = the pace at 59% VO2max, i.e. Daniels' cited E-range floor from
 *    (1) — the most-repeated figure across sources, and the slowest end of
 *    the easy-effort continuum in mainstream coaching convention. Computed
 *    with the *same* VO2(v)-inversion mechanism Daniels uses to derive his
 *    own zone bounds (see `computeZoneValue`'s `vo2PercentOfVdot` branch in
 *    `calculator.ts`), not an offset from Easy.
 *
 * Because (2) and (3) come from different source lineages, the Easy-to-
 * Recovery gap is *not* constant across VDOT — it's roughly 35-105 sec/mile
 * depending on VDOT, wider for slower runners. That's an expected
 * consequence of the VO2-vs-velocity curve being quadratic, not a bug, and
 * it should never be described in UI copy or code comments as "N seconds
 * slower than Easy."
 */
export const RECOVERY_VO2_PERCENT_OF_VDOT = 0.59;

/**
 * Discriminated union for how a given equivalency zone's pace is derived
 * from a VDOT. `interpolateTable` covers the five sourced Daniels columns
 * above; `vo2PercentOfVdot` covers Recovery's VO2(v)-inversion path (see
 * comment above). Adding a future VDOT-derived zone means adding one case
 * here (if a genuinely new computation method is needed) and one entry to
 * `EQUIVALENCY_ZONE_DEFINITIONS` below — not new per-zone logic in
 * `calculator.ts`.
 */
export type ZoneComputation =
  | { method: "interpolateTable"; table: VdotPoint[] }
  | { method: "vo2PercentOfVdot"; percent: number };

/**
 * The six equivalency-zone ids that are always `computed`/`blocked`
 * together (see `EquivalencyZone` in `calculator.ts`). Deliberately
 * excludes `goal` — the goal zone is a direct time/distance division with
 * no VDOT involved at all, a fundamentally different input shape (a
 * distance+time the runner entered directly, not a VDOT-derived
 * equivalency), so it is not part of this table-driven config and is
 * computed separately in `calculator.ts`'s `computeGoalZone`.
 */
export type EquivalencyZoneId =
  | "recovery"
  | "easy"
  | "threshold"
  | "tenK"
  | "fiveK"
  | "interval";

/**
 * One computation definition per equivalency zone. A `Record` over the
 * fixed `EquivalencyZoneId` union (not an array) so TypeScript enforces that
 * every zone id has a definition — a missing entry is a compile error, not
 * a silent runtime gap. `calculator.ts`'s `computeEquivalencyZones` maps
 * over this once, generically, rather than hand-writing one branch per
 * zone. To add a future VDOT-derived zone: add its id to
 * `EquivalencyZoneId`, add one field to `PaceZones` in `calculator.ts`, and
 * add one entry here — no new function.
 */
export const EQUIVALENCY_ZONE_DEFINITIONS: Record<EquivalencyZoneId, ZoneComputation> = {
  recovery: { method: "vo2PercentOfVdot", percent: RECOVERY_VO2_PERCENT_OF_VDOT },
  easy: { method: "interpolateTable", table: EASY_TABLE },
  threshold: { method: "interpolateTable", table: THRESHOLD_TABLE },
  tenK: { method: "interpolateTable", table: TEN_K_TABLE },
  fiveK: { method: "interpolateTable", table: FIVE_K_TABLE },
  interval: { method: "interpolateTable", table: INTERVAL_TABLE },
};

/**
 * The lowest VDOT any interpolated equivalency zone's table actually
 * supports — derived from the tables themselves (each table's own first
 * point), not a hardcoded magic number, so this stays correct automatically
 * if a future zone's table starts at a different floor, with zero code
 * change anywhere that references this constant. `Math.max` picks the
 * *most restrictive* table's floor, since a VDOT below any one table's
 * start has nothing to interpolate against for that zone. Evaluates to 30
 * today, since every current table starts at VDOT 30.
 *
 * `calculator.ts`'s `calculate()` rejects a recent-result-derived VDOT below
 * this threshold outright (`{ ok: false }`) rather than letting it reach
 * `interpolate()`'s low-end clamp — see the header comment above and
 * `interpolate()`'s docstring for why clamping at the low end would be
 * unsafe rather than conservative.
 */
export const VDOT_TABLE_MIN = Math.max(
  ...Object.values(EQUIVALENCY_ZONE_DEFINITIONS)
    .filter(
      (c): c is Extract<ZoneComputation, { method: "interpolateTable" }> =>
        c.method === "interpolateTable",
    )
    .map((c) => c.table[0]!.vdot),
);
