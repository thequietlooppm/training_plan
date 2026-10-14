/**
 * Formats seconds-per-mile as `"7:45 /mi"` — the one place any client
 * converts a raw `paceSecPerMile` number into user-facing text.
 *
 * Rounds the total first, then splits: splitting first and rounding the
 * seconds would produce `7:60` for 479.6. Stored snapshots are whole
 * seconds already (`.int()`); the rounding guards fresh `calculate()` output.
 */
export function formatPace(paceSecPerMile: number): string {
  const total = Math.round(paceSecPerMile);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /mi`;
}
