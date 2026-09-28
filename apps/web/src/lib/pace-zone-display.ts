import type { GoalZone } from "@training-plan/pace-zones";

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

export const UNSET_GOAL_ZONE_COPY = {
  before: "Add a goal time ",
  jumpLinkText: "above",
  after: " to see this.",
} as const;
