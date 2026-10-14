import type { PaceEntry } from "@training-plan/pace-zones";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ESTIMATED_BADGE_LABEL, ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY } from "@/lib/pace-zone-display";

/** The small "Estimated" chip shared by the strip and inline pace text. */
export function EstimatedChip() {
  return (
    <Badge
      title={ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY}
      className="border-warning/20 bg-warning-chip align-middle text-warning-chip-foreground"
    >
      <span>{ESTIMATED_BADGE_LABEL}</span>
      <span className="sr-only"> {ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY}</span>
    </Badge>
  );
}

/**
 * Compact pace reference: only the zones the day's text uses, with the
 * pace figures from the plan's stored snapshot (`entries` come from
 * `resolvePaceTokens`). Renders nothing when there are none.
 */
export function PaceStrip({ entries }: { entries: readonly PaceEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul aria-label="Pace reference" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {entries.map((entry) => (
        <li key={entry.key} className="flex items-center gap-2">
          <span>{entry.label}</span>
          <span className="font-mono tabular-nums">{entry.pace}</span>
          {entry.estimated ? <EstimatedChip /> : null}
        </li>
      ))}
    </ul>
  );
}

export function AllPaceZonesLink() {
  return (
    <Link to="/paces" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
      All pace zones →
    </Link>
  );
}
