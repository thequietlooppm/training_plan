import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import type { PlanInstanceStore } from "@/lib/plan-store";
import { PlanStoreProvider } from "@/lib/PlanStoreProvider";

/**
 * Renders under a fresh QueryClient, a MemoryRouter at `route`, and
 * (optionally) an injected plan store. With no `store` the default
 * localStorage store is used, which is what most tests want (jsdom's
 * `localStorage` is real).
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", store }: { route?: string | { pathname: string; state?: unknown }; store?: PlanInstanceStore } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapped = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(store ? <PlanStoreProvider store={store}>{wrapped}</PlanStoreProvider> : wrapped);
}
