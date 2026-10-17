/** Pad a single typed digit to two ("7" -> "07") for MM/SS on blur. */
export function padTwoDigits(value: string): string {
  return /^\d$/.test(value) ? `0${value}` : value;
}

