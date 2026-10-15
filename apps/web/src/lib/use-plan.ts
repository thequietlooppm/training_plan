import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  materializePlan,
  type GeneratedPlan,
  type StoredPlanInstance,
} from "@training-plan/plan-instance";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { useContext, useMemo } from "react";
import {
  createLocalStoragePlanStore,
  type PlanInstanceStore,
  type PlanLoad,
} from "@/lib/plan-store";
import { PlanStoreContext } from "@/lib/plan-store-context";

export const PLAN_QUERY_KEY = ["plan-instance"] as const;

let defaultStore: PlanInstanceStore | null = null;

function usePlanStore(): PlanInstanceStore {
  const injected = useContext(PlanStoreContext);
  if (injected) return injected;
  defaultStore ??= createLocalStoragePlanStore();
  return defaultStore;
}

/** The raw stored-plan load, as a TanStack Query. */
export function usePlanLoad() {
  const store = usePlanStore();
  return useQuery<PlanLoad>({
    queryKey: PLAN_QUERY_KEY,
    queryFn: () => store.get(),
    // Local storage is the source of truth; never serve a stale copy.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useSavePlan() {
  const store = usePlanStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: StoredPlanInstance) => {
      await store.save(plan);
      return plan;
    },
    onSuccess: (plan) => {
      const next: PlanLoad = { status: "ok", value: plan };
      queryClient.setQueryData<PlanLoad>(PLAN_QUERY_KEY, next);
    },
  });
}

export type ActivePlan =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "empty" }
  | { status: "corrupt" }
  | { status: "ready"; stored: StoredPlanInstance; plan: GeneratedPlan };

/** The stored plan plus its regenerated dated days, or the reason there isn't one. */
export function useActivePlan(): ActivePlan {
  const query = usePlanLoad();
  const data = query.data;
  const result = useMemo<ActivePlan | null>(() => {
    if (!data) return null;
    if (data.status !== "ok") return { status: data.status };
    const template = COMMITTED_PLAN_TEMPLATES.find(
      (t) =>
        t.templateId === data.value.templateId &&
        t.templateVersion === data.value.templateVersion,
    );
    if (!template) return { status: "error", retry: () => {} };
    const materialized = materializePlan(data.value, template);
    if (!materialized.ok) return { status: "error", retry: () => {} };
    return { status: "ready", stored: data.value, plan: materialized.plan };
  }, [data]);

  if (query.status === "error") {
    return { status: "error", retry: () => void query.refetch() };
  }
  if (!result) return { status: "loading" };
  if (result.status === "error") return { status: "error", retry: () => void query.refetch() };
  return result;
}
