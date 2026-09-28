import type { GoalZone, PaceZones } from "@training-plan/pace-zones";

/**
 * Shared, format-agnostic display helpers for the 7 pace zones (#14) —
 * zone order, one-line "what it's for" captions, pace formatting, and the
 * blocked/unset row copy. `PaceZoneTable.tsx` (the full-page table, built
 * now) and any future compact/inline variant (calendar day-detail, not
 * built now — see design spec §7.4) both import from here, so the pace
 * format, the zone order, and the "why is this blocked" wording can never
 * drift between the two surfaces.
 *
 * See `docs/design/plan-setup-flow.md` §7 for the source spec this mirrors.
 */

/** Every zone id, `PaceZones`'s own declared field order (§7.1) — one
 * source of truth, not a second invented ordering. */
export type ZoneId =
  | "recovery"
  | "easy"
  | "threshold"
  | "tenK"
  | "fiveK"
  | "interval"
  | "goal";

export interface ZoneMeta {
  id: ZoneId;
  label: string;
  /** One-line "what this zone is for" caption (§7.3). */
  purpose: string;
}

/**
 * Fixed row order + label + purpose caption per §7.3. `goal`'s `label` here
 * is the generic fallback ("Goal") — the actual rendered label depends on
 * whether/what distance a goal time was entered for; see `goalZoneLabel()`
 * below.
 */
export const ZONE_ORDER: ZoneMeta[] = [
  {
    id: "recovery",
    label: "Recovery",
    purpose: "Easiest effort — recovery days and warm-up/cooldown.",
  },
  {
    id: "easy",
    label: "Easy",
    purpose: "Comfortable, conversational — most of your weekly mileage.",
  },
  {
    id: "threshold",
    label: "Threshold",
    purpose: "Sustained \"comfortably hard\" — tempo runs.",
  },
  {
    id: "tenK",
    label: "10K",
    purpose: "Hard, sustained race effort.",
  },
  {
    id: "fiveK",
    label: "5K",
    purpose: "Faster than 10K — short, hard repeats.",
  },
  {
    id: "interval",
    label: "Interval",
    purpose: "Fastest repeatable pace, with recovery between reps.",
  },
  {
    id: "goal",
    label: "Goal",
    purpose: "Your target race pace.",
  },
];

/**
 * Formats seconds-per-mile as `"7:45 /mi"` — the one place this repo
 * converts a raw `paceSecPerMile` number into user-facing text. Callers
 * never do their own `Math.floor(x / 60)` string-building.
 */
export function formatPace(paceSecPerMile: number): string {
  const minutes = Math.floor(paceSecPerMile / 60);
  const seconds = paceSecPerMile % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /mi`;
}

/**
 * The goal row's label depends on which distance (if any) a goal time was
 * entered for (§7.3: "Goal — Marathon / Goal — Half / Goal (when unset)").
 */
export function goalZoneLabel(goal: GoalZone): string {
  if (goal.state === "unset") {
    return "Goal";
  }
  return goal.label === "marathon" ? "Goal — Marathon" : "Goal — Half";
}

/**
 * Blocked/unset row copy (§7.2) — real, actionable microcopy, never a bare
 * "N/A" or "—". The "above" segment is rendered as a real jump-link by the
 * table component; these strings are the surrounding sentence.
 */
export const BLOCKED_EQUIVALENCY_ZONE_COPY = {
  before: "Add a recent result ",
  jumpLinkText: "above",
  after: " to see this.",
} as const;

/**
 * Blocked-equivalency-zone copy for the `reason: "goalVdotBelowTable"` case
 * (#52 amendment) — a goal time *was* given, but its derived VDOT was too
 * low to use for the six equivalency zones (the `goal` zone itself is still
 * shown as a real computed pace elsewhere in the same table; this is not a
 * total-failure state). Distinct from `BLOCKED_EQUIVALENCY_ZONE_COPY`
 * (`reason: "noInput"`), which still applies when no goal time was given at
 * all. Copy is tech-lead's call, informed by data-scientist review — keep
 * verbatim.
 */
export const GOAL_VDOT_BELOW_TABLE_ZONE_COPY = {
  before: "Your goal time doesn't support estimating this pace. Add a recent result ",
  jumpLinkText: "above",
  after: " to see it.",
} as const;

export const UNSET_GOAL_ZONE_COPY = {
  before: "Add a goal time ",
  jumpLinkText: "above",
  after: " to see this.",
} as const;

/** The six equivalency-zone ids, `ZONE_ORDER` minus `goal` — `goal` has no
 * `source` concept (§7.2/§7.3), so callers checking for a goal-derived
 * fallback need this list, not the full `ZONE_ORDER`. */
export const EQUIVALENCY_ZONE_IDS = ZONE_ORDER.map((zone) => zone.id).filter(
  (id): id is Exclude<ZoneId, "goal"> => id !== "goal",
);

/**
 * True when any equivalency zone's `source` is `"goalTime"` (issue #52) —
 * i.e. a goal time was provided with no recent result, and the six
 * equivalency zones were derived from it as a fallback rather than staying
 * `blocked`. Drives the section-level warning banner (§7.2) — computed once
 * per render, not per row, since the banner is section-level, not per-row.
 */
export function hasGoalDerivedEquivalencyZone(zones: PaceZones): boolean {
  return EQUIVALENCY_ZONE_IDS.some((id) => {
    const zone = zones[id];
    return zone.state === "computed" && zone.source === "goalTime";
  });
}

/**
 * Goal-derived-fallback warning banner copy (§6.3/§7.2, issue #52,
 * data-scientist-authored — verbatim, do not rewrite). Rendered once, above
 * all seven rows, whenever `hasGoalDerivedEquivalencyZone` is true. "above"
 * is a real jump-link to the Recent-result section, same target as
 * `BLOCKED_EQUIVALENCY_ZONE_COPY`'s.
 */
export const GOAL_DERIVED_WARNING_COPY = {
  before:
    "These paces are estimated from your goal time, not a race you've run. " +
    "If that goal is ambitious, expect all of them — especially Interval " +
    "and 5K — to run faster than your current fitness supports. Add a " +
    "recent result ",
  jumpLinkText: "above",
  after: " for paces based on what you've actually run.",
} as const;

/** "Estimated" badge label + tooltip/accessible-name copy (§6.3/§7.2, issue
 * #52, verbatim) — rendered on each of the six equivalency-zone rows whose
 * `source` is `"goalTime"`. Not a jump-link (unlike the banner above): the
 * badge is non-interactive by design (§7.2's "Badge tooltip:
 * recommendation" — a native `title` + `sr-only` span, no new dependency,
 * no new tab stop), so this is plain text, not a `{before, jumpLinkText,
 * after}` triple. */
export const ESTIMATED_BADGE_LABEL = "Estimated";
export const ESTIMATED_BADGE_TOOLTIP =
  "Estimated from your goal time — not a demonstrated result. Add a recent result above for more accurate paces.";
