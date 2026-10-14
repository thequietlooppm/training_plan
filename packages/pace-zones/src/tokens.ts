import type { PaceZones } from "./calculator.js";
import { formatPace } from "./format.js";

/**
 * Pace-token substitution for workout descriptions (training-calendar §5.3).
 *
 * Template descriptions name paces with short tokens ("last 4 miles at MGP").
 * `resolvePaceTokens` appends the runner's pace after each recognised token
 * and reports which zones the text used, so a client can show a compact
 * pace strip with only those zones. It reads a `PaceZones` value (the
 * snapshot frozen with the plan) and never calls `calculate()`.
 *
 * Matching is case-sensitive and whole-word: `easy`, `threshold` and
 * `interval` are lowercase words, so a title like "Easy run" is left alone.
 * Unknown text passes through unchanged. A token whose zone has no pace
 * (blocked) is left unchanged and not listed. `MGP` resolves only to a
 * marathon goal and `HMGP` only to a half-marathon goal; otherwise the token
 * reads "(not set)" inline and is not listed. (A half goal pace is never
 * shown as marathon goal pace: that would prescribe a too-fast pace.)
 */

export type PaceTokenKey =
  | "easy"
  | "threshold"
  | "tenK"
  | "fiveK"
  | "interval"
  | "marathonGoal"
  | "halfGoal";

/** Full name shown in the pace strip. */
const LABELS: Record<PaceTokenKey, string> = {
  easy: "Easy",
  threshold: "Threshold",
  tenK: "10K pace",
  fiveK: "5K pace",
  interval: "Interval",
  marathonGoal: "MGP",
  halfGoal: "HMGP",
};

/** Template token -> zone. The single source of truth for the mapping. */
export const PACE_TOKEN_TABLE: Readonly<Record<string, PaceTokenKey>> = {
  easy: "easy",
  E: "easy",
  MGP: "marathonGoal",
  M: "marathonGoal",
  HMGP: "halfGoal",
  "10K pace": "tenK",
  "5K pace": "fiveK",
  TP: "threshold",
  threshold: "threshold",
  T: "threshold",
  interval: "interval",
  I: "interval",
};

// Longest alternatives first so "HMGP" wins over "MGP" and "10K pace" over "T".
const TOKEN_ALTERNATION = Object.keys(PACE_TOKEN_TABLE)
  .sort((a, b) => b.length - a.length)
  .join("|");
// A parenthesised token "(MGP)" matches as a pair; otherwise a bare whole word.
const TOKEN_PATTERN = `\\((${TOKEN_ALTERNATION})\\)|(?<![\\w-])(${TOKEN_ALTERNATION})(?![\\w-])`;

export interface PaceEntry {
  key: PaceTokenKey;
  /** Strip label, e.g. "Easy", "MGP", "10K pace". */
  label: string;
  /** Formatted pace, e.g. "10:30 /mi". */
  pace: string;
  /** True when the zone was derived from a goal time (`source: "goalTime"`). */
  estimated: boolean;
}

export type PaceSegment =
  | { kind: "text"; text: string }
  | { kind: "pace"; text: string; estimated: boolean };

export interface ResolvedPaceText {
  /** The description with paces inserted; equals the joined segments. */
  text: string;
  /** The same text split so a client can style the inserted paces. */
  segments: PaceSegment[];
  /** One entry per zone the description references, in first-use order. */
  entries: PaceEntry[];
}

interface Found {
  pace: string;
  estimated: boolean;
}

function lookup(key: PaceTokenKey, zones: PaceZones): Found | null {
  if (key === "marathonGoal" || key === "halfGoal") {
    const goal = zones.goal;
    const wanted = key === "marathonGoal" ? "marathon" : "half";
    if (goal.state !== "computed" || goal.label !== wanted) return null;
    return { pace: formatPace(goal.paceSecPerMile), estimated: false };
  }
  const zone = zones[key];
  if (zone.state !== "computed") return null;
  return { pace: formatPace(zone.paceSecPerMile), estimated: zone.source === "goalTime" };
}

export function resolvePaceTokens(description: string, zones: PaceZones): ResolvedPaceText {
  const segments: PaceSegment[] = [];
  const entries: PaceEntry[] = [];
  const seen = new Set<PaceTokenKey>();
  let cursor = 0;

  const pushText = (text: string) => {
    if (text) segments.push({ kind: "text", text });
  };

  for (const match of description.matchAll(new RegExp(TOKEN_PATTERN, "g"))) {
    const whole = match[0];
    const key = PACE_TOKEN_TABLE[match[1] ?? match[2] ?? ""];
    if (!key) continue;
    const found = lookup(key, zones);
    const isGoalToken = key === "marathonGoal" || key === "halfGoal";
    if (!found && !isGoalToken) continue; // blocked zone: leave the text alone

    pushText(description.slice(cursor, match.index));
    cursor = match.index + whole.length;
    pushText(whole);

    if (!found) {
      pushText(" (not set)");
      continue;
    }
    // "(MGP)" -> "(MGP) (9:09 /mi)"; bare "MGP" -> "MGP (9:09 /mi)".
    pushText(" ");
    segments.push({ kind: "pace", text: `(${found.pace})`, estimated: found.estimated });

    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ key, label: LABELS[key], pace: found.pace, estimated: found.estimated });
    }
  }
  pushText(description.slice(cursor));

  return { text: segments.map((s) => s.text).join(""), segments, entries };
}
