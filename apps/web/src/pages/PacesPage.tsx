import { AlertTriangle, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { PaceZoneTable } from "@/components/PaceZoneTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CORRUPT_PLAN_NOTE } from "@/lib/calendar-copy";
import { formatDateLong } from "@/lib/plan-date-format";
import { useToday } from "@/lib/today";
import { useActivePlan } from "@/lib/use-plan";

/**
 * `/paces`: the plan's pace zones for lookup. The figures come from the pace
 * snapshot stored with the plan; nothing here calls `calculate()`.
 */
export function PacesPage() {
  const today = useToday();
  const active = useActivePlan();

  return (
    <main aria-busy={active.status === "loading"} className="mx-auto w-full max-w-2xl flex-1 p-6">
      {active.status === "loading" ? (
        <div className="grid gap-3" data-testid="paces-skeleton">
          <Skeleton className="h-9 w-56" />
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : null}

      {active.status === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Couldn&apos;t load your pace zones</AlertTitle>
          <AlertDescription>
            <Button type="button" variant="outline" onClick={active.retry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {active.status === "empty" || active.status === "corrupt" ? (
        <div className="grid gap-4">
          {active.status === "corrupt" ? (
            <Alert role="status">
              <Info aria-hidden="true" />
              <AlertDescription>{CORRUPT_PLAN_NOTE}</AlertDescription>
            </Alert>
          ) : null}
          <h1 className="text-2xl font-bold">No plan yet</h1>
          <p className="text-sm text-muted-foreground">
            Your pace zones appear here once you create a plan.
          </p>
          <Button asChild className="h-11 w-fit">
            <Link to="/setup">Set up plan</Link>
          </Button>
        </div>
      ) : null}

      {active.status === "ready" ? (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-bold">Your pace zones</h1>
            <p className="text-sm text-muted-foreground">
              For your race on {formatDateLong(active.stored.raceDate, today)}.
            </p>
          </div>
          <PaceZoneTable zones={active.stored.paceZones} variant="reference" />
        </div>
      ) : null}
    </main>
  );
}
