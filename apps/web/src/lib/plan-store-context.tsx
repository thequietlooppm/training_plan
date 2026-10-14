import { createContext, type ReactNode } from "react";
import type { PlanInstanceStore } from "@/lib/plan-store";

export const PlanStoreContext = createContext<PlanInstanceStore | null>(null);

/** Lets tests (or a future API-backed store) swap the store. */
export function PlanStoreProvider({
  store,
  children,
}: {
  store: PlanInstanceStore;
  children: ReactNode;
}) {
  return <PlanStoreContext.Provider value={store}>{children}</PlanStoreContext.Provider>;
}
