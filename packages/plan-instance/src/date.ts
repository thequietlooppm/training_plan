/**
 * Date math with no dependency and no timezone sensitivity.
 *
 * A calendar date is a local `YYYY-MM-DD` string. It is converted to an
 * integer "epoch day" (days since 1970-01-01) via `Date.UTC`, all arithmetic
 * is on integers, and day-of-week comes from UTC getters. We never call
 * `new Date("YYYY-MM-DD")` nor read local-time getters, so results are
 * identical under every TZ and across DST transitions.
 */

const MS_PER_DAY = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a valid `YYYY-MM-DD`, or `null` if malformed or not a real date. */
export function toEpochDay(date: string): number | null {
  const m = typeof date === "string" ? DATE_RE.exec(date) : null;
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  // Round-trip check rejects 2027-02-30, month 13, etc. (Date.UTC rolls over).
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return ms / MS_PER_DAY;
}

export function isValidDateString(date: string): boolean {
  return toEpochDay(date) !== null;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function fromEpochDay(epochDay: number): string {
  const d = new Date(epochDay * MS_PER_DAY);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

function mustEpochDay(date: string): number {
  const e = toEpochDay(date);
  if (e === null) throw new RangeError(`Invalid calendar date: ${date}`);
  return e;
}

export function addDays(date: string, days: number): string {
  return fromEpochDay(mustEpochDay(date) + days);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return mustEpochDay(to) - mustEpochDay(from);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const dow = new Date(mustEpochDay(date) * MS_PER_DAY).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 7 : dow;
}

export function isSunday(date: string): boolean {
  return isoWeekday(date) === 7;
}
