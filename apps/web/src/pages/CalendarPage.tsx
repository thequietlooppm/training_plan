import { isValidDateString } from "@training-plan/plan-instance";
import { AlertTriangle, Info } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { DaySheet } from "@/components/DaySheet";
import { PlanCalendar } from "@/components/calendar/PlanCalendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/lib/today";
import { useActivePlan } from "@/lib/use-plan";

export const CORRUPT_PLAN_NOTE =
  "We couldn't read your saved plan, so it isn't shown. It was set aside, not deleted. Create a new plan to continue.";

/** Navigation state set by "Create my plan" so the calendar heading takes focus. */
export interface CalendarLocationState {
  focusHeading?: boolean;
}

/** `/` and `/day/:date`. A malformed `:date` redirects to `/`. */
export function CalendarRoute() {
  const { date } = useParams();
  if (date !== undefined && !isValidDateString(date)) {
    return <Navigate to="/" replace />;
  }
  return <CalendarPage selectedDate={date} />;
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-3" data-testid="calendar-skeleton">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ corrupt, headingRef }: { corrupt: boolean; headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="grid gap-4">
      {corrupt ? (
        <Alert role="status">
          <Info aria-hidden="true" />
          <AlertDescription>{CORRUPT_PLAN_NOTE}</AlertDescription>
        </Alert>
      ) : null}
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
        No plan yet
      </h1>
      <p className="text-sm text-muted-foreground">
        Enter your race date and a recent result or goal time to get a plan on real dates.
      </p>
      <Button asChild className="h-11 w-fit">
        <Link to="/setup">Set up plan</Link>
      </Button>
    </div>
  );
}

export function CalendarPage({ selectedDate }: { selectedDate?: string }) {
  const today = useToday();
  const active = useActivePlan();
  const location = useLocation();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const focusRequested = (location.state as CalendarLocationState | null)?.focusHeading === true;
  const ready = active.status === "ready";
  useEffect(() => {
    if (focusRequested && ready) {
      headingRef.current?.focus();
      // One-shot: consume the state so Back/reload don't refocus the heading.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [focusRequested, ready, navigate, location.pathname]);

  function closeSheet() {
    // `key === "default"` means this is the first entry (deep link): there
    // is nothing in-app to go back to.
    if (location.key !== "default") navigate(-1);
    else navigate("/", { replace: true });
  }

  /** Radix restores focus on close; we choose the target: the day's row, else the heading. */
  function focusAfterClose(date: string) {
    const row = document.querySelector<HTMLElement>(`[data-date="${date}"]`);
    (row ?? headingRef.current)?.focus();
  }

  return (
    <main
      aria-busy={active.status === "loading"}
      className="mx-auto w-full max-w-2xl flex-1 p-6"
    >
      {active.status === "loading" ? <CalendarSkeleton /> : null}

      {active.status === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Couldn&apos;t load your plan</AlertTitle>
          <AlertDescription>
            <Button type="button" variant="outline" onClick={active.retry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {active.status === "empty" || active.status === "corrupt" ? (
        <EmptyState corrupt={active.status === "corrupt"} headingRef={headingRef} />
      ) : null}

      {active.status === "ready" ? (
        <>
          <PlanCalendar
            ref={headingRef}
            plan={active.plan}
            today={today}
            revealDate={selectedDate}
          />
          {selectedDate ? (
            <DaySheet
              plan={active.plan}
              zones={active.stored.paceZones}
              date={selectedDate}
              today={today}
              onClose={closeSheet}
              onCloseFocus={focusAfterClose}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
