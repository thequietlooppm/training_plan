import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import {
  PLAN_CORRUPT_STORAGE_KEY,
  PLAN_STORAGE_KEY,
  type PlanInstanceStore,
} from "@/lib/plan-store";
import { CORRUPT_PLAN_NOTE } from "@/pages/CalendarPage";
import { failingStore, makeStoredPlan } from "@/test-fixtures";
import { renderWithProviders } from "@/test-utils";

// "Today" is fixed: Wed 2026-10-14. Only Date is faked so promises and
// waitFor keep working.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const RACE = "2026-12-16"; // Wednesday -> Thu–Wed weeks; week 9 = Oct 8–14

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

function savePlan(raceDate = RACE) {
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(makeStoredPlan(raceDate)));
}

function renderAt(route: string, store?: PlanInstanceStore) {
  return renderWithProviders(<App />, { route, store });
}

describe("calendar at /", () => {
  it("is aria-busy while the plan loads", () => {
    savePlan();
    renderAt("/");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("calendar-skeleton")).toBeDefined();
  });

  it("renders the saved plan on real dates", async () => {
    savePlan();
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" })).toBeDefined();
    expect(screen.getByText("Weeks run Thursday to Wednesday and end on race day.")).toBeDefined();
    expect(screen.getByText(/^Saved on this device/)).toBeDefined();
  });

  it("shows the empty state, with no redirect to /setup, when there is no plan", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "No plan yet" })).toBeDefined();
    const cta = screen.getByRole("link", { name: "Set up plan" });
    expect(cta.getAttribute("href")).toBe("/setup");
    expect(screen.queryByRole("heading", { name: "Set up your plan" })).toBeNull();
    expect(screen.queryByText(CORRUPT_PLAN_NOTE)).toBeNull();
  });

  it("shows the empty state plus the note for a corrupt plan, and keeps the bad value", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{definitely not a plan");
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "No plan yet" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe(CORRUPT_PLAN_NOTE);
    expect(screen.getByRole("link", { name: "Set up plan" })).toBeDefined();
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe("{definitely not a plan");
    expect(window.localStorage.getItem(PLAN_STORAGE_KEY)).toBeNull();
  });

  it("shows an error state with Try again when the store fails", async () => {
    renderAt("/", failingStore());
    expect(await screen.findByText("Couldn't load your plan")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it("header links to the plan and to /setup", async () => {
    renderAt("/");
    await screen.findByRole("heading", { level: 1 });
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Plan" }).getAttribute("href")).toBe("/");
    expect(within(nav).getByRole("link", { name: "New plan" }).getAttribute("href")).toBe("/setup");
  });
});

describe("/day/:date", () => {
  it("opens the day sheet for a date in the plan and expands its week", async () => {
    savePlan();
    renderAt("/day/2026-09-02"); // week 3 (Thu Aug 27 – Wed Sep 2)
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Wed, Sep 2 · Week 3 of 18/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /^Week 3 ·/, hidden: true }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("shows 'Not in your plan' for a valid date outside the plan", async () => {
    savePlan();
    renderAt("/day/2030-01-01");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Not in your plan")).toBeDefined();
    // Calendar is still there behind the sheet.
    expect(screen.getByRole("heading", { level: 1, hidden: true, name: "9 weeks to race day" })).toBeDefined();
  });

  it.each(["2026-13-40", "abc", "2026-02-30"])("redirects malformed date %s to /", async (bad) => {
    savePlan();
    renderAt(`/day/${bad}`);
    expect(await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("with no plan renders the empty state at /day/:date with no sheet and no redirect to /setup", async () => {
    renderAt("/day/2026-10-14");
    expect(await screen.findByRole("heading", { level: 1, name: "No plan yet" })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("with a corrupt plan renders the empty state with the note", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "[]");
    renderAt("/day/2026-10-14");
    expect(await screen.findByText(CORRUPT_PLAN_NOTE)).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closing a deep-linked sheet goes to / and focuses the heading", async () => {
    savePlan();
    renderAt("/day/2030-01-01");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to calendar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const heading = screen.getByRole("heading", { level: 1, name: "9 weeks to race day" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("focuses the heading once after Create, then not again after open row and close", async () => {
    savePlan();
    renderWithProviders(<App />, { route: { pathname: "/", state: { focusHeading: true } } });
    const heading = await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const spy = vi.spyOn(heading, "focus");

    const row = document.querySelector('[data-date="2026-10-13"]') as HTMLElement;
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Focus returns to the row, and the one-shot heading focus is not replayed.
    await waitFor(() => expect(document.activeElement).toBe(row));
    expect(spy).not.toHaveBeenCalled();
  });

  it("opening a row from the calendar shows that day", async () => {
    savePlan();
    renderAt("/");
    await screen.findByRole("heading", { level: 1 });
    const row = document.querySelector('[data-date="2026-10-13"]') as HTMLElement;
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Tue, Oct 13 · Week 9 of 18/)).toBeDefined();
  });
});

describe("post-race at /", () => {
  it("says when race day was", async () => {
    vi.setSystemTime(new Date(2026, 11, 20, 9, 0, 0));
    savePlan();
    renderAt("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Race day was Wed, Dec 16" }),
    ).toBeDefined();
  });
});
