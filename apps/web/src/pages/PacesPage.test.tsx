import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { PLAN_STORAGE_KEY, type PlanInstanceStore } from "@/lib/plan-store";
import { CORRUPT_PLAN_NOTE } from "@/pages/CalendarPage";
import { failingStore, makeStoredPlan } from "@/test-fixtures";
import { renderWithProviders } from "@/test-utils";

const RACE = "2026-12-16"; // a Wednesday

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

function renderPaces(store?: PlanInstanceStore) {
  return renderWithProviders(<App />, { route: "/paces", store });
}

describe("/paces", () => {
  it("shows the stored zones from the snapshot, with the race's real weekday", async () => {
    const stored = makeStoredPlan(RACE);
    stored.paceZones.easy = { state: "computed", paceSecPerMile: 777, source: "recentResult" };
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stored));
    renderPaces();
    expect(await screen.findByRole("heading", { level: 1, name: "Your pace zones" })).toBeDefined();
    expect(screen.getByText("For your race on Wed, Dec 16.")).toBeDefined();
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("12:57 /mi")).toBeDefined(); // snapshot value, not recomputed
  });

  it("shows the reference copy and Estimated treatment for a goal-derived snapshot", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(makeStoredPlan(RACE)));
    renderPaces();
    await screen.findByRole("table");
    const banner = screen.getAllByRole("status").find((el) => el.textContent?.includes("estimated from your goal time"));
    expect(banner).toBeDefined();
    expect(banner?.textContent).toContain("Create a new plan with a recent result for paces based on what you've actually run.");
    expect(banner?.textContent).not.toContain("above");
    const link = within(banner as HTMLElement).getByRole("link", {
      name: "Create a new plan with a recent result — go to plan setup",
    });
    expect(link.getAttribute("href")).toBe("/setup");
    expect(link.textContent).toBe("Create a new plan");
    expect(screen.getAllByText("Estimated").length).toBe(6);
    expect(screen.queryByText(/\babove\b/)).toBeNull();
    expect(screen.getAllByText(/Create a new plan with a recent result for more accurate paces/).length).toBeGreaterThan(0);
  });

  it("is reachable from the header nav", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(makeStoredPlan(RACE)));
    renderPaces();
    await screen.findByRole("table");
    const link = within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Pace zones" });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("shows the empty state with a link to /setup when there is no plan", async () => {
    renderPaces();
    expect(await screen.findByRole("heading", { level: 1, name: "No plan yet" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Set up plan" }).getAttribute("href")).toBe("/setup");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("adds the corrupt-plan note for a corrupt plan", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{nope");
    renderPaces();
    expect(await screen.findByText(CORRUPT_PLAN_NOTE)).toBeDefined();
    expect(screen.getByRole("link", { name: "Set up plan" })).toBeDefined();
  });

  it("shows an error state with Try again when the store fails", async () => {
    renderPaces(failingStore());
    expect(await screen.findByText("Couldn't load your pace zones")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("is aria-busy while loading", () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(makeStoredPlan(RACE)));
    renderPaces();
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("paces-skeleton")).toBeDefined();
  });
});
