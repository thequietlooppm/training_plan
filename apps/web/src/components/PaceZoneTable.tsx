import type { PaceZones } from "@training-plan/pace-zones";
import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BLOCKED_EQUIVALENCY_ZONE_COPY,
  UNSET_GOAL_ZONE_COPY,
  ZONE_ORDER,
  formatPace,
  goalZoneLabel,
  type ZoneId,
} from "@/lib/pace-zone-display";

/**
 * DOM contract this table's blocked/unset jump-links rely on (design spec
 * §7.2/§8): the page hosting this table must render an element with each of
 * these ids at the field the copy points to, so the jump-link has something
 * real to scroll to and focus. #12's `PlanSetupPage` is this table's only
 * consumer today, so the target is that page's own fields:
 * - `RECENT_RESULT_JUMP_TARGET_ID` → the Recent-result section's distance
 *   `Select` trigger.
 * - `GOAL_TIME_JUMP_TARGET_ID` → the Goal-time section's distance toggle
 *   (its first `RadioGroupItem`, "Half").
 */
export const RECENT_RESULT_JUMP_TARGET_ID = "recent-result-distance";
export const GOAL_TIME_JUMP_TARGET_ID = "goal-time-distance-half";

function jumpTo(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });
  target.focus();
}

function JumpLink({
  targetId,
  ariaLabel,
  children,
}: {
  targetId: string;
  ariaLabel: string;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={() => jumpTo(targetId)}
      aria-label={ariaLabel}
      className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * The #14 pace-reference table. Pure presentational: no data-fetching, no
 * form logic — just `zones` in, the full §7 table out. Fixed row order via
 * `ZONE_ORDER`; blocked/unset rows render real actionable copy with a
 * jump-link, never a bare "—"/"N/A" (§7.2).
 */
export function PaceZoneTable({ zones }: { zones: PaceZones }) {
  // Forces the live region's text to actually mutate on every new `zones`
  // value (a trailing zero-width space toggled on/off), rather than
  // re-rendering the literal same string, which some screen readers won't
  // re-announce. See design spec §4/§8: "Pace zones updated." is announced
  // on every successful (re)compute, not just the first.
  const announceParity = useRef(0);
  const [liveMessage, setLiveMessage] = useState("Pace zones updated.");

  useEffect(() => {
    announceParity.current = announceParity.current === 0 ? 1 : 0;
    setLiveMessage(`Pace zones updated.${announceParity.current ? "​" : ""}`);
  }, [zones]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <Table>
        <TableCaption className="sr-only">
          Your personal pace zones
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Zone</TableHead>
            <TableHead className="text-right">Pace</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ZONE_ORDER.map((zone) => (
            <TableRow key={zone.id}>
              <TableCell className="align-top whitespace-normal">
                <div className="font-medium text-foreground">
                  {zone.id === "goal" ? goalZoneLabel(zones.goal) : zone.label}
                </div>
                <p className="text-sm text-muted-foreground">{zone.purpose}</p>
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {renderPaceCell(zone.id, zones)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function renderPaceCell(zoneId: ZoneId, zones: PaceZones) {
  if (zoneId === "goal") {
    const goal = zones.goal;
    if (goal.state === "unset") {
      return (
        <span className="text-sm italic text-muted-foreground">
          {UNSET_GOAL_ZONE_COPY.before}
          <JumpLink
            targetId={GOAL_TIME_JUMP_TARGET_ID}
            ariaLabel="Add a goal time — jump to Goal time section"
          >
            {UNSET_GOAL_ZONE_COPY.jumpLinkText}
          </JumpLink>
          {UNSET_GOAL_ZONE_COPY.after}
        </span>
      );
    }
    return formatPace(goal.paceSecPerMile);
  }

  const zone = zones[zoneId];
  if (zone.state === "blocked") {
    return (
      <span className="text-sm italic text-muted-foreground">
        {BLOCKED_EQUIVALENCY_ZONE_COPY.before}
        <JumpLink
          targetId={RECENT_RESULT_JUMP_TARGET_ID}
          ariaLabel="Add a recent result — jump to Recent race result section"
        >
          {BLOCKED_EQUIVALENCY_ZONE_COPY.jumpLinkText}
        </JumpLink>
        {BLOCKED_EQUIVALENCY_ZONE_COPY.after}
      </span>
    );
  }
  return formatPace(zone.paceSecPerMile);
}
