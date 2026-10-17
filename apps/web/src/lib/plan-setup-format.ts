/** Pad a single typed digit to two ("7" -> "07") for MM/SS on blur. */
export function padTwoDigits(value: string): string {
  return /^\d$/.test(value) ? `0${value}` : value;
}

/**
 * "2026-10-18" -> "Sunday, October 18, 2026". Parsed as calendar-date
 * integer parts and formatted in UTC, never `new Date("YYYY-MM-DD")` parsed
 * in local time, so the weekday can't shift with the viewer's timezone.
 * Returns "" for empty or non-existent dates (e.g. 2026-02-31).
 */
export function formatLongDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
