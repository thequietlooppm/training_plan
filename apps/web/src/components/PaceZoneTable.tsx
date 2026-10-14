import { formatPace, type PaceZones } from "@training-plan/pace-zones";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY,
  BLOCKED_EQUIVALENCY_ZONE_REFERENCE_COPY,
  GOAL_DERIVED_WARNING_COPY,
  GOAL_DERIVED_WARNING_REFERENCE_COPY,
  GOAL_TIME_REFERENCE_LINK_LABEL,
  GOAL_VDOT_BELOW_TABLE_ZONE_COPY,
  GOAL_VDOT_BELOW_TABLE_ZONE_REFERENCE_COPY,
  RECENT_RESULT_REFERENCE_LINK_LABEL,
  UNSET_GOAL_ZONE_COPY,
  UNSET_GOAL_ZONE_REFERENCE_COPY,
  ZONE_ORDER,
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

const RECENT_RESULT_SETUP_LINK_LABEL = "Add a recent result — jump to Recent race result section";
const GOAL_TIME_SETUP_LINK_LABEL = "Add a goal time — jump to Goal time section";

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
  variant,
}: {
  targetId: string;
  ariaLabel: string;
  children: string;
  variant: PaceZoneTableVariant;
}) {
  if (variant === "reference") {
    // No form on this page: the call to action is a real link to /setup.
    return (
      <Link
        to="/setup"
        aria-label={ariaLabel}
        className="inline py-3 underline underline-offset-2 hover:text-foreground"
      >
        {children}
      </Link>
    );
  }
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
 * `setup`: copy says "above" and jumps to the form fields (used on /setup).
 * `reference`: the `*_REFERENCE_COPY` strings, with links to /setup (/paces).
 */
export type PaceZoneTableVariant = "setup" | "reference";

/**
 * The #14 pace-reference table. Pure presentational: no data-fetching, no
 * form logic — just `zones` in, the full §7 table out. Fixed row order via
 * `ZONE_ORDER`; blocked/unset rows render real actionable copy with a
 * jump-link, never a bare "—"/"N/A" (§7.2).
 */
export function PaceZoneTable({
  zones,
  variant = "setup",
}: {
  zones: PaceZones;
  variant?: PaceZoneTableVariant;
}) {
  const reference = variant === "reference";
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
  const warningCopy = reference ? GOAL_DERIVED_WARNING_REFERENCE_COPY : GOAL_DERIVED_WARNING_COPY;
  const recentLabel = reference
    ? RECENT_RESULT_REFERENCE_LINK_LABEL
    : RECENT_RESULT_SETUP_LINK_LABEL;

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
              {warningCopy.before}
              <JumpLink
                variant={variant}
                targetId={RECENT_RESULT_JUMP_TARGET_ID}
                ariaLabel={recentLabel}
              >
                {warningCopy.jumpLinkText}
              </JumpLink>
              {warningCopy.after}
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
                    {isGoalDerivedRow ? <EstimatedBadge reference={reference} /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{zone.purpose}</p>
                </TableCell>
                <TableCell className="text-right align-top font-mono tabular-nums whitespace-normal">
                  {renderPaceCell(zone.id, zones, variant)}
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
function EstimatedBadge({ reference }: { reference: boolean }) {
  const tooltip = reference ? ESTIMATED_BADGE_TOOLTIP_REFERENCE_COPY : ESTIMATED_BADGE_TOOLTIP;
  return (
    <Badge
      title={tooltip}
      // Tempo `accent/chip-bg` tint (#FFEDD5) with `accent/hover` text
      // (#9A3412, 6.38:1) — a quiet, non-interactive chip, not a solid
      // `bg-primary` fill that reads as a button.
      className="border-warning/20 bg-warning-chip align-middle text-warning-chip-foreground"
    >
      <span>{ESTIMATED_BADGE_LABEL}</span>
      <span className="sr-only"> {tooltip}</span>
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

function renderPaceCell(zoneId: ZoneId, zones: PaceZones, variant: PaceZoneTableVariant) {
  const reference = variant === "reference";
  if (zoneId === "goal") {
    const goal = zones.goal;
    if (goal.state === "unset") {
      const unsetCopy = reference ? UNSET_GOAL_ZONE_REFERENCE_COPY : UNSET_GOAL_ZONE_COPY;
      return (
        <span className="text-sm italic text-muted-foreground">
          {unsetCopy.before}
          <JumpLink
            variant={variant}
            targetId={GOAL_TIME_JUMP_TARGET_ID}
            ariaLabel={reference ? GOAL_TIME_REFERENCE_LINK_LABEL : GOAL_TIME_SETUP_LINK_LABEL}
          >
            {unsetCopy.jumpLinkText}
          </JumpLink>
          {unsetCopy.after}
        </span>
      );
    }
    return formatPace(goal.paceSecPerMile);
  }

  const zone = zones[zoneId];
  if (zone.state === "blocked") {
    const belowTable = zone.reason === "goalVdotBelowTable";
    const copy = reference
      ? belowTable
        ? GOAL_VDOT_BELOW_TABLE_ZONE_REFERENCE_COPY
        : BLOCKED_EQUIVALENCY_ZONE_REFERENCE_COPY
      : belowTable
        ? GOAL_VDOT_BELOW_TABLE_ZONE_COPY
        : BLOCKED_EQUIVALENCY_ZONE_COPY;
    return (
      <span className="text-sm italic text-muted-foreground">
        {copy.before}
        <JumpLink
          variant={variant}
          targetId={RECENT_RESULT_JUMP_TARGET_ID}
          ariaLabel={reference ? RECENT_RESULT_REFERENCE_LINK_LABEL : RECENT_RESULT_SETUP_LINK_LABEL}
        >
          {copy.jumpLinkText}
        </JumpLink>
        {copy.after}
      </span>
    );
  }
  return formatPace(zone.paceSecPerMile);
}
