import { isSunday, toEpochDay } from "./date.js";

export type RaceDateErrorCode = "invalid_format" | "invalid_date" | "in_past" | "not_sunday";

export interface RaceDateError {
  code: RaceDateErrorCode;
  message: string;
}

export type RaceDateResult = { ok: true; raceDate: string } | { ok: false; error: RaceDateError };

/**
 * Validates a race date. `today` is injected (local `YYYY-MM-DD`, built by
 * the caller) because this package never reads the clock. Race day itself may
 * be today. Sunday-only is a deliberate restriction for this slice: the only
 * template places race day on the Sunday ending its final Monday-start week.
 */
export function validateRaceDate(raceDate: string, today: string): RaceDateResult {
  const fail = (code: RaceDateErrorCode, message: string): RaceDateResult => ({
    ok: false,
    error: { code, message },
  });
  if (typeof raceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
    return fail("invalid_format", "Enter the race date as YYYY-MM-DD.");
  }
  const race = toEpochDay(raceDate);
  if (race === null) return fail("invalid_date", "That date does not exist.");
  const now = toEpochDay(today);
  if (now === null) throw new RangeError("`today` must be a valid YYYY-MM-DD date");
  if (race < now) return fail("in_past", "The race date must be today or later.");
  if (!isSunday(raceDate)) {
    return fail("not_sunday", "For now, plans support races held on a Sunday.");
  }
  return { ok: true, raceDate };
}
