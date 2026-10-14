import {
  currentWeek,
  defaultOpenWeekIndex,
  findDay,
  planState,
  planWeekShape,
  weekPlannedMiles,
  weekProgress,
  type GeneratedPlan,
  type PlanInstanceDay,
} from "@training-plan/plan-instance";
import { ChevronRight, Flag } from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dayOfMonth,
  dayTitle,
  formatDateLong,
  formatMiles,
  formatWeekRange,
  weekdayName,
  weekdayShort,
} from "@/lib/plan-date-format";
import { countdownHeading } from "@/lib/calendar-copy";

function weekValue(weekIndex: number): string {
  return `week-${weekIndex}`;
}

function DayRow({ day, today }: { day: PlanInstanceDay; today: string }) {
  const isToday = day.date === today;
  const isRest = day.dayType === "rest";
  const title = isRest ? "Rest" : dayTitle(day.description);
  return (
    <li>
      <Link
        to={`/day/${day.date}`}
        data-date={day.date}
        aria-current={isToday ? "date" : undefined}
        className={[
          "flex min-h-11 items-center gap-2 rounded-md border-l-4 px-3 py-2 text-sm hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          isToday ? "border-l-primary bg-accent/50 font-medium" : "border-l-transparent",
          isRest ? "text-muted-foreground" : "",
        ].join(" ")}
      >
        <span className="w-14 shrink-0">
          {weekdayShort(day.date)} {dayOfMonth(day.date)}
        </span>{" "}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {day.isRaceDay ? <Flag aria-hidden="true" className="size-4 text-primary" /> : null}
          <span>{title}</span>
          {day.workoutTag === "long_run" ? (
            <>
              {" "}
              <Badge variant="outline">Long</Badge>
            </>
          ) : null}
          {isToday ? (
            <>
              {" "}
              <Badge>Today</Badge>
            </>
          ) : null}
        </span>{" "}
        {day.distanceMiles !== undefined ? (
          <span className="shrink-0">{formatMiles(day.distanceMiles)}</span>
        ) : null}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export interface PlanCalendarProps {
  plan: GeneratedPlan;
  /** Local `YYYY-MM-DD`, injected. */
  today: string;
  /** When set (e.g. `/day/:date`), the week containing this date is expanded. */
  revealDate?: string;
}

/**
 * The calendar body: countdown header, stacked week accordion over the
 * plan's real date ranges, and the pinned race-day block. Weekdays always
 * come from the real dates, never the template's `dayOfWeek`.
 */
export const PlanCalendar = forwardRef<HTMLHeadingElement, PlanCalendarProps>(
  function PlanCalendar({ plan, today, revealDate }, headingRef) {
    const state = planState(plan, today);
    const shape = useMemo(() => planWeekShape(plan), [plan]);
    const revealWeek = revealDate ? findDay(plan, revealDate)?.weekIndex : undefined;
    const withWeek = (open: string[], week: number | undefined) =>
      week === undefined || open.includes(weekValue(week)) ? open : [...open, weekValue(week)];
    const [openWeeks, setOpenWeeks] = useState<string[]>(() =>
      withWeek([weekValue(defaultOpenWeekIndex(plan, today))], revealWeek),
    );
    const [scrollToToday, setScrollToToday] = useState(false);

    // Adjust state during render when the revealed week changes (React's
    // "adjusting state when a prop changes" pattern), instead of an effect.
    const [prevRevealWeek, setPrevRevealWeek] = useState(revealWeek);
    if (revealWeek !== prevRevealWeek) {
      setPrevRevealWeek(revealWeek);
      setOpenWeeks(withWeek(openWeeks, revealWeek));
    }

    useEffect(() => {
      if (revealDate === undefined) return;
      document.querySelector(`[data-date="${revealDate}"]`)?.scrollIntoView?.({ block: "center" });
    }, [revealDate, openWeeks]);

    const thisWeek = state === "in_progress" ? currentWeek(plan, today) : undefined;
    const todayDay = state === "in_progress" ? findDay(plan, today) : undefined;

    // Today pill: only once the plan has started, and only when today's row
    // is not in view. A collapsed current week means the row is not in the
    // DOM at all; when it is open we ask IntersectionObserver (if present).
    const todayWeekOpen = thisWeek ? openWeeks.includes(weekValue(thisWeek.weekIndex)) : false;
    const [rowOutOfView, setRowOutOfView] = useState(false);
    const todayDate = todayDay?.date;
    useEffect(() => {
      if (!todayDate || !todayWeekOpen || typeof IntersectionObserver === "undefined") return;
      const row = document.querySelector(`[data-date="${todayDate}"]`);
      if (!row) return;
      const observer = new IntersectionObserver(([entry]) => {
        setRowOutOfView(entry ? !entry.isIntersecting : false);
      });
      observer.observe(row);
      return () => observer.disconnect();
    }, [todayDate, todayWeekOpen]);
    const offscreen = Boolean(todayDay) && (!todayWeekOpen || rowOutOfView);

    useEffect(() => {
      if (!scrollToToday || !todayDay) return;
      const row = document.querySelector(`[data-date="${todayDay.date}"]`);
      if (row) {
        row.scrollIntoView?.({ block: "center" });
        // The pill unmounts once the row is in view; keep keyboard focus.
        (row as HTMLElement).focus({ preventScroll: true });
        // oxlint-disable-next-line react/set-state-in-effect -- clears one-shot scroll request after DOM commit
        setScrollToToday(false);
      }
    }, [scrollToToday, todayDay, openWeeks]);

    function jumpToToday() {
      if (!thisWeek) return;
      const value = weekValue(thisWeek.weekIndex);
      setOpenWeeks((open) => (open.includes(value) ? open : [...open, value]));
      setScrollToToday(true);
    }

    const raceDay = findDay(plan, plan.raceDate);
    const raceDateLabel = formatDateLong(plan.raceDate, today);
    const progress = weekProgress(plan, today);

    return (
      <div className="grid gap-4">
        {offscreen ? (
          <div className="sticky top-2 z-10 flex justify-end">
            <Button type="button" size="sm" onClick={jumpToToday}>
              Today
            </Button>
          </div>
        ) : null}

        <header className="grid gap-1">
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none">
            {countdownHeading(plan, today)}
          </h1>
          {state === "not_started" ? (
            <p className="text-sm text-muted-foreground">
              Starts {formatDateLong(plan.startDate, today)} · {plan.totalWeeks}-week plan
            </p>
          ) : state === "in_progress" ? (
            <p className="text-sm text-muted-foreground">
              {progress.label} · {thisWeek?.phase}
            </p>
          ) : null}
          {state !== "finished" ? (
            <p className="text-sm text-muted-foreground">
              Weeks run {weekdayName(shape.firstWeekday)} to {weekdayName(shape.lastWeekday)} and end
              on race day.
            </p>
          ) : null}
        </header>

        <Accordion type="multiple" value={openWeeks} onValueChange={setOpenWeeks}>
          {plan.weeks.map((week) => {
            const isRaceWeek = week.weekIndex === plan.totalWeeks;
            return (
              <AccordionItem key={week.weekIndex} value={weekValue(week.weekIndex)}>
                <AccordionTrigger className="min-h-11 items-center">
                  <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      Week {week.weekIndex} · {formatWeekRange(week.startDate, week.endDate)}
                      {isRaceWeek ? " · Race week" : ""}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      {formatMiles(weekPlannedMiles(week))}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="grid gap-1">
                    {week.days.map((day) => (
                      <DayRow key={day.date} day={day} today={today} />
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {raceDay ? (
          <Link
            to={`/day/${plan.raceDate}`}
            className="flex min-h-11 items-center gap-3 rounded-lg border-2 border-primary p-4 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Flag aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="grid">
              <span className="text-xs font-semibold tracking-wide uppercase">Race day</span>
              <span className="text-sm">
                {raceDateLabel} · {dayTitle(raceDay.description)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
          </Link>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Saved on this device. Clearing your browser data removes it.
        </p>
      </div>
    );
  },
);
