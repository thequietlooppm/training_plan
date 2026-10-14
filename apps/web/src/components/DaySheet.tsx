import { resolvePaceTokens, type PaceZones } from "@training-plan/pace-zones";
import { addDays, findDay, type GeneratedPlan, type PlanInstanceDay } from "@training-plan/plan-instance";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { COMMITTED_PLAN_TEMPLATES, type RaceDistanceType } from "@training-plan/plan-templates";
import { useLocation, useNavigate } from "react-router-dom";
import { AllPaceZonesLink, EstimatedChip, PaceStrip } from "@/components/PaceStrip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isDeepLinkState, type DaySheetLocationState } from "@/lib/deep-link-state";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  dayTitle,
  formatDateLong,
  formatDateSpoken,
  formatMiles,
} from "@/lib/plan-date-format";

/** Side panel from this width up; bottom sheet below it (slice-1 spec C.2). */
export const SIDE_PANEL_QUERY = "(min-width: 768px)";

const RACE_LABELS: Record<RaceDistanceType, string> = {
  marathon: "Marathon",
  ten_mile: "10 mile",
};

function sheetTitle(day: PlanInstanceDay): string {
  if (day.dayType === "rest") return "Rest";
  if (day.isRaceDay) return "Race day";
  return dayTitle(day.description);
}

function raceLine(day: PlanInstanceDay, raceType: RaceDistanceType | undefined): string | null {
  if (!day.isRaceDay || day.distanceMiles === undefined) return null;
  const miles = formatMiles(day.distanceMiles);
  return raceType ? `${RACE_LABELS[raceType]} · ${miles}` : miles;
}

/** "14 mi", or "14 mi · 90 min" when the template also gives a duration. */
function plannedText(day: PlanInstanceDay): string | null {
  const parts: string[] = [];
  if (day.distanceMiles !== undefined) parts.push(formatMiles(day.distanceMiles));
  if (day.durationMinutes !== undefined) parts.push(`${day.durationMinutes} min`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function DayBody({
  day,
  zones,
  raceType,
}: {
  day: PlanInstanceDay;
  zones: PaceZones;
  raceType: RaceDistanceType | undefined;
}) {
  const isRun = day.dayType === "run";
  // Paces come only from the snapshot stored with the plan.
  const resolved = useMemo(
    () => (isRun ? resolvePaceTokens(day.description, zones) : null),
    [isRun, day.description, zones],
  );

  if (day.dayType === "rest") {
    return (
      <div className="grid gap-2 px-4 pb-4 text-sm">
        <p>Nothing scheduled today.</p>
        {day.description !== "Rest day" ? <p>{day.description}</p> : null}
      </div>
    );
  }

  // Strength / cross-training: the description only (FR11).
  if (!resolved) {
    return (
      <div className="px-4 pb-4 text-sm">
        <p>{day.description}</p>
      </div>
    );
  }

  // On race day the race line already carries the distance.
  const planned = day.isRaceDay ? null : plannedText(day);
  const race = raceLine(day, raceType);
  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 pb-4 text-sm">
      {race ? <p className="font-medium">{race}</p> : null}
      <p>
        {resolved.segments.map((segment, i) =>
          segment.kind === "pace" && segment.estimated ? (
            <span key={i}>
              {segment.text} <EstimatedChip />
            </span>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </p>
      {planned ? (
        <p className="flex gap-4">
          <span className="text-muted-foreground">Planned</span>
          <span className="font-medium">{planned}</span>
        </p>
      ) : null}
      <PaceStrip entries={resolved.entries} />
      <AllPaceZonesLink />
    </div>
  );
}

export interface DaySheetProps {
  plan: GeneratedPlan;
  /** The plan's stored pace snapshot. Never recomputed here. */
  zones: PaceZones;
  /** `YYYY-MM-DD`, already validated. */
  date: string;
  /** Local `YYYY-MM-DD`, injected. */
  today: string;
  onClose: () => void;
  /** Called after close so the caller can choose where focus returns. */
  onCloseFocus: (date: string) => void;
}

/**
 * The day detail `Sheet` over the calendar (slice-1 spec C.3 to C.5): a
 * bottom sheet below 768px, a right-hand panel above. Open state belongs to
 * the URL; Prev/Next navigate with `replace` so Back returns to the calendar.
 */
export function DaySheet({ plan, zones, date, today, onClose, onCloseFocus }: DaySheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const raceType = COMMITTED_PLAN_TEMPLATES.find(
    (t) => t.templateId === plan.templateId && t.templateVersion === plan.templateVersion,
  )?.raceDistanceType;
  const wide = useMediaQuery(SIDE_PANEL_QUERY);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const day = findDay(plan, date);

  function step(delta: -1 | 1) {
    const target = addDays(date, delta);
    if (!findDay(plan, target)) return;
    setAnnouncement(`Showing ${formatDateSpoken(target)}`);
    // `replace` gives the entry a new key, so remember a first-entry deep link
    // in state; Close then goes to "/" instead of leaving the app.
    const deepLink = location.key === "default" || isDeepLinkState(location.state);
    const state: DaySheetLocationState = { deepLink };
    navigate(`/day/${target}`, { replace: true, state });
  }

  const atFirst = date <= plan.startDate;
  const atLast = date >= plan.raceDate;

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Land on the title so a screen reader hears the workout first.
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus(date);
        }}
        className={[
          // prefers-reduced-motion: the slide distance becomes 0, leaving the fade.
          "motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:fade-in-0",
          wide
            ? "w-[420px] border-l sm:max-w-[420px] motion-reduce:data-[state=closed]:slide-out-to-right-0 motion-reduce:data-[state=open]:slide-in-from-right-0"
            : "max-h-[85svh] motion-reduce:data-[state=closed]:slide-out-to-bottom-0 motion-reduce:data-[state=open]:slide-in-from-bottom-0",
        ].join(" ")}
      >
        <div className="flex items-center gap-1 border-b px-2 py-1">
          {day ? (
            <>
              <Button
                type="button"
                variant="ghost"
                aria-label="Previous day"
                aria-disabled={atFirst}
                className="size-11 aria-disabled:opacity-40"
                onClick={() => (atFirst ? undefined : step(-1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="flex-1 text-center text-sm font-medium">{formatDateLong(date, today)}</span>
              <Button
                type="button"
                variant="ghost"
                aria-label="Next day"
                aria-disabled={atLast}
                className="size-11 aria-disabled:opacity-40"
                onClick={() => (atLast ? undefined : step(1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <span className="flex-1" />
          )}
          <SheetClose asChild>
            <Button type="button" variant="ghost" aria-label="Close" className="size-11">
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </div>
        <SheetHeader className="pb-0">
          <SheetTitle ref={titleRef} tabIndex={-1} className="text-xl outline-none">
            {day ? sheetTitle(day) : "Not in your plan"}
          </SheetTitle>
          <SheetDescription>
            {day
              ? `Week ${day.weekIndex} of ${plan.totalWeeks} · ${day.phase}`
              : "There's no workout on that date."}
          </SheetDescription>
        </SheetHeader>
        {day ? (
          <DayBody day={day} zones={zones} raceType={raceType} />
        ) : (
          <div className="px-4 pb-4">
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Back to calendar
            </Button>
          </div>
        )}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </SheetContent>
    </Sheet>
  );
}
