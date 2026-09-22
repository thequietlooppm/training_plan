import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHealth } from "@/lib/health";

// How long the loading state has to stay up before we tell the user we're
// still connecting. apps/api's dev deployment (Render free tier) spins down
// after 15 minutes idle and can take up to ~60s to wake on the next
// request — this is a UX affordance, not a fetch timeout: there is no
// client-side abort here, only an additional caption.
const STILL_CONNECTING_DELAY_MS = 3000;

export function HomePage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth({ signal }),
  });

  // Treat both the initial load and a manual refetch as "loading" — the
  // shell only has three states (loading/success/error), not a fourth
  // "stale success, refetching" state.
  const loading = query.fetchStatus === "fetching";

  const [stillConnecting, setStillConnecting] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setTimeout(() => {
      setStillConnecting(true);
    }, STILL_CONNECTING_DELAY_MS);

    return () => {
      clearTimeout(timer);
      // Reset for the next loading cycle (e.g. "Try again" after an error)
      // so a fresh attempt gets its own ~3s grace period rather than
      // inheriting the previous cycle's "still connecting" state.
      setStillConnecting(false);
    };
  }, [loading]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card
        aria-busy={loading}
        className="w-full max-w-sm items-center text-center"
      >
        <CardContent className="flex w-full flex-col items-center gap-3">
          {loading ? (
            <div className="flex w-full flex-col items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
              {stillConnecting ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Still connecting — waking up the API&hellip;
                </p>
              ) : null}
            </div>
          ) : query.status === "error" ? (
            <>
              <AlertTriangle
                aria-hidden="true"
                className="size-8 text-destructive"
              />
              <p className="font-bold">Can&apos;t reach the API</p>
              <p className="text-sm text-muted-foreground">
                Check that the API is running, then try again.
              </p>
              <Button onClick={() => query.refetch()}>Try again</Button>
            </>
          ) : query.status === "success" ? (
            <>
              <CheckCircle
                aria-hidden="true"
                className="size-8 text-green-600"
              />
              <p className="font-bold">Backend connected</p>
              <p className="text-sm text-muted-foreground">
                GET /health &rarr; {query.data.status}
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
