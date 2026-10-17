import { isoWeekday } from "@training-plan/plan-instance";

/**
 * Display formatting for plan dates. Everything is derived from the
 * `YYYY-MM-DD` string and `isoWeekday` (integer-day math in
 * `@training-plan/plan-instance`), never from `new Date("YYYY-MM-DD")`, so
 * a Saturday-night-UTC date can't shift a day. Weekdays are never taken
 * from the template's `dayOfWeek`.
 */

const WEEKDAYS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "Saturday, March 14": the spoken form, for live-region announcements. */
export function formatDateSpoken(date: string): string {
  const { month, day } = parts(date);
  return `${weekdayName(isoWeekday(date))}, ${MONTHS_LONG[month - 1] ?? ""} ${day}`;
}

/** `isoWeekday` value (1 = Mon ... 7 = Sun) to its full name. */
export function weekdayName(iso: number): string {
  return WEEKDAYS_LONG[iso - 1] ?? "";
}

export function weekdayShort(date: string): string {
  return weekdayName(isoWeekday(date)).slice(0, 3);
}

function parts(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split("-");
  return { year: Number(y), month: Number(m), day: Number(d) };
}

export function dayOfMonth(date: string): number {
  return parts(date).day;
}

/** "Mar" for `2026-03-09`. */
export function monthShort(date: string): string {
  return MONTHS_SHORT[parts(date).month - 1] ?? "";
}

/**
 * "Sun, May 17"; the year is appended only when it is not the current
 * year (`today` is the injected local date).
 */
export function formatDateLong(date: string, today: string): string {
  const { year, day } = parts(date);
  const base = `${weekdayShort(date)}, ${monthShort(date)} ${day}`;
  return year === parts(today).year ? base : `${base}, ${year}`;
}

/** "Mar 9–15", or "Mar 28–Apr 3" when the week crosses a month. */
export function formatWeekRange(start: string, end: string): string {
  const s = parts(start);
  const e = parts(end);
  return s.month === e.month
    ? `${monthShort(start)} ${s.day}–${e.day}`
    : `${monthShort(start)} ${s.day}–${monthShort(end)} ${e.day}`;
}

/** "5 mi", "26.2 mi", "10.5 mi": drops a trailing ".0". */
export function formatMiles(miles: number): string {
  const rounded = Math.round(miles * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} mi`;
}

/**
 * Short row title from the template's free-text description: the leading
 * clause, before a parenthetical or comma ("Group quality workout
 * (structured track or tempo session)" -> "Group quality workout").
 */
export function dayTitle(description: string): string {
  const head = description.split(/\s\(|,\s|;\s|\s–\s/)[0]?.trim();
  return head ? head : description;
}
