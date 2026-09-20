import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHealth } from "@/lib/health";

export function HomePage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  // Treat both the initial load and a manual refetch as "loading" — the
  // shell only has three states (loading/success/error), not a fourth
  // "stale success, refetching" state.
  const loading = query.fetchStatus === "fetching";

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
