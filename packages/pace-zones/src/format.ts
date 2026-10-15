import type { ValidationError } from "./calculator.js";
import type { RecentResultDistance } from "./schema.js";

/**
 * Formats whole seconds as `m:ss` under an hour and `h:mm:ss` otherwise.
 * Never emits raw seconds. Non-finite or negative input is clamped to 0:00.
 */
export function formatDuration(totalSeconds: number): string {
  const t = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

const DISTANCE_LABELS: Record<RecentResultDistance, string> = {
  "5k": "5K",
  "10k": "10K",
  "15k": "15K",
  "10_mile": "10 mile",
  half: "half marathon",
  marathon: "marathon",
};

const GENERIC = "Check this time and try again.";

/**
 * Runner-facing English text for a `calculate()` validation error, built from
 * the error's code and data (never from `message`). Shared so web, iOS and
 * Android show the same copy. Times use h:mm:ss / m:ss only.
 */
export function describeValidationError(error: ValidationError): string {
  const { code, distance, valueSeconds, minSeconds, maxSeconds } = error;
  switch (code) {
    case "result_time_implausible":
    case "goal_time_implausible": {
      if (
        distance === undefined ||
        valueSeconds === undefined ||
        minSeconds === undefined ||
        maxSeconds === undefined
      ) {
        return GENERIC;
      }
      const label = DISTANCE_LABELS[distance];
      const kind = code === "goal_time_implausible" ? "goal time" : "time";
      return `A ${label} ${kind} of ${formatDuration(valueSeconds)} must be between ${formatDuration(minSeconds)} and ${formatDuration(maxSeconds)}.`;
    }
    case "result_below_vdot_floor":
      return "That time is slower than our pace tables cover. Try a more recent or longer race result.";
    default:
      return GENERIC;
  }
}
