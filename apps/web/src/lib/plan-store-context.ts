import { createContext } from "react";
import type { PlanInstanceStore } from "@/lib/plan-store";

export const PlanStoreContext = createContext<PlanInstanceStore | null>(null);
