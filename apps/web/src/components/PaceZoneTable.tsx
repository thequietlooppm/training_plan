import type { PaceZones } from "@training-plan/pace-zones";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  ESTIMATED_BADGE_LABEL,
  ESTIMATED_BADGE_TOOLTIP,
  GOAL_DERIVED_WARNING_COPY,
  GOAL_VDOT_BELOW_TABLE_ZONE_COPY,
  UNSET_GOAL_ZONE_COPY,
  ZONE_ORDER,
  formatPace,
  goalZoneLabel,
  hasGoalDerivedEquivalencyZone,
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

/**
 * `display: inline` + block-axis `padding` (not `inline-flex`/`min-h-*`,
 * which are atomic inline boxes that grow the surrounding line box and
 * force this link onto its own line — §8 requires ≥44px tap height without
 * breaking inline text flow). A plain `inline` element's padding extends
 * its hit-testable/paint area without affecting line-box height, which is
 * exactly what a same-line ≥44px-tall text link needs: `py-3` (12px top +
 * bottom) added to `text-sm`'s 20px line-height clears the 44px floor.
 */
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
      className="inline py-3 underline underline-offset-2 hover:text-foreground"
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

  const goalDerived = hasGoalDerivedEquivalencyZone(zones);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      {goalDerived ? (
        <Alert variant="warning" role="status" className="mb-4">
          <Info aria-hidden="true" />
          <AlertDescription>
            {/*
              A single `<p>`, not bare text nodes — `AlertDescription` is
              itself `display: grid` (so it can stack multiple block
              children with `gap-1`), which blockifies *any* direct child,
              including this text/JumpLink/text run: three siblings would
              each become their own grid item/row, which is what forced the
              jump-link onto its own line with stray vertical gaps around
              it. Wrapping them in one `<p>` (the pattern this primitive's
              own `[&_p]:leading-relaxed` selector already expects) makes
              the paragraph the sole grid item, so the JumpLink is back to
              being an ordinary inline-flow descendant instead of a grid
              item, and lays out on the same line as its surrounding text.
            */}
            <p>
              {GOAL_DERIVED_WARNING_COPY.before}
              <JumpLink
                targetId={RECENT_RESULT_JUMP_TARGET_ID}
                ariaLabel="Add a recent result — jump to Recent race result section"
              >
                {GOAL_DERIVED_WARNING_COPY.jumpLinkText}
              </JumpLink>
              {GOAL_DERIVED_WARNING_COPY.after}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
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
          {ZONE_ORDER.map((zone) => {
            const isGoalDerivedRow = isGoalDerivedEquivalencyRow(zone.id, zones);
            return (
              <TableRow key={zone.id}>
                <TableCell className="align-top whitespace-normal">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {zone.id === "goal" ? goalZoneLabel(zones.goal) : zone.label}
                    {isGoalDerivedRow ? <EstimatedBadge /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{zone.purpose}</p>
                </TableCell>
                <TableCell className="text-right align-top font-mono tabular-nums whitespace-normal">
                  {renderPaceCell(zone.id, zones)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

/**
 * "Estimated" badge on a goal-derived equivalency row (§7.2). Non-
 * interactive (plain `span`, not a link/button) — the fuller explanation
 * reaches screen-reader users via the `sr-only` span and mouse users via
 * the native `title` attribute, per the spec's explicit call against a
 * focusable `Tooltip` (no new Radix dependency, no new per-row tab stop).
 */
function EstimatedBadge() {
  return (
    <Badge title={ESTIMATED_BADGE_TOOLTIP} className="align-middle">
      <span>{ESTIMATED_BADGE_LABEL}</span>
      <span className="sr-only"> {ESTIMATED_BADGE_TOOLTIP}</span>
    </Badge>
  );
}

/** True for an equivalency-zone row whose pace was derived from the goal
 * time as a fallback (§7.2, issue #52) — never true for the `goal` row
 * itself, which has no `source` concept (§7.2/§7.3). */
function isGoalDerivedEquivalencyRow(zoneId: ZoneId, zones: PaceZones): boolean {
  if (zoneId === "goal") {
    return false;
  }
  const zone = zones[zoneId];
  return zone.state === "computed" && zone.source === "goalTime";
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
    const copy =
      zone.reason === "goalVdotBelowTable"
        ? GOAL_VDOT_BELOW_TABLE_ZONE_COPY
        : BLOCKED_EQUIVALENCY_ZONE_COPY;
    return (
      <span className="text-sm italic text-muted-foreground">
        {copy.before}
        <JumpLink
          targetId={RECENT_RESULT_JUMP_TARGET_ID}
          ariaLabel="Add a recent result — jump to Recent race result section"
        >
          {copy.jumpLinkText}
        </JumpLink>
        {copy.after}
      </span>
    );
  }
  return formatPace(zone.paceSecPerMile);
}
