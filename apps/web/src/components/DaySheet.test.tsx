import { formatPace } from "@training-plan/pace-zones";
import type { PlanInstanceDay } from "@training-plan/plan-instance";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { PLAN_STORAGE_KEY } from "@/lib/plan-store";
import { makePlan, makeStoredPlan } from "@/test-fixtures";
import { renderWithProviders } from "@/test-utils";

// "Today" is Wed 2026-10-14; the race is Wed 2026-12-16, so plan weeks run Thu to Wed.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const RACE = "2026-12-16";
const PLAN = makePlan(RACE);
const ALL_DAYS = PLAN.weeks.flatMap((w) => w.days);

const GOAL_ONLY = makeStoredPlan(RACE); // zones derived from the goal -> "Estimated"
const RECENT_RESULT = makeStoredPlan(RACE, undefined, {
  recentResult: { distance: "10k", timeSeconds: 45 * 60 },
  goalTime: { distance: "marathon", timeSeconds: 3.5 * 3600 },
});

function dayWhere(predicate: (d: PlanInstanceDay) => boolean): PlanInstanceDay {
  const found = ALL_DAYS.find(predicate);
  if (!found) throw new Error("no matching day in fixture plan");
  return found;
}

const mgpDay = dayWhere((d) => / MGP$/.test(d.description) && !d.isRaceDay);
const easyDay = dayWhere((d) => d.dayType === "run" && /^\d+ miles easy$/.test(d.description));
const restDay = dayWhere((d) => d.dayType === "rest");
const strengthDay = dayWhere((d) => d.dayType === "strength" || d.dayType === "cross_training");
const raceDay = dayWhere((d) => d.isRaceDay);

function stubWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  stubWide(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  // @ts-expect-error restore the jsdom default (no matchMedia)
  delete window.matchMedia;
});

function open(date: string, stored = GOAL_ONLY, route = `/day/${date}`) {
  window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stored));
  renderWithProviders(<App />, { route });
  return screen.findByRole("dialog");
}

function snapshotPace(stored: typeof GOAL_ONLY, key: "easy" | "goal"): string {
  const zone = stored.paceZones[key];
  if (zone.state !== "computed") throw new Error("fixture zone not computed");
  return formatPace(zone.paceSecPerMile);
}

describe("day sheet content", () => {
  it("run day: title, week line, resolved description, Planned distance, pace strip", async () => {
    const dialog = await open(mgpDay.date);
    const mgp = snapshotPace(GOAL_ONLY, "goal");
    expect(within(dialog).getByRole("heading", { name: /long run/i })).toBeDefined();
    expect(within(dialog).getByText(`Week ${mgpDay.weekIndex} of 18 · ${mgpDay.phase}`)).toBeDefined();
    expect(dialog.textContent).toContain(`at MGP (${mgp})`);
    expect(within(dialog).getByText("Planned")).toBeDefined();
    expect(within(dialog).getByText(`${mgpDay.distanceMiles} mi`)).toBeDefined();
    const link = within(dialog).getByRole("link", { name: /All pace zones/ });
    expect(link.getAttribute("href")).toBe("/paces");
  });

  it("rest day: 'Rest', nothing scheduled, no distance, no pace strip", async () => {
    const dialog = await open(restDay.date);
    expect(within(dialog).getByRole("heading", { name: "Rest" })).toBeDefined();
    expect(within(dialog).getByText("Nothing scheduled today.")).toBeDefined();
    expect(within(dialog).queryByText("Planned")).toBeNull();
    expect(within(dialog).queryByRole("list", { name: "Pace reference" })).toBeNull();
    expect(within(dialog).queryByRole("link", { name: /All pace zones/ })).toBeNull();
  });

  it("strength / cross-training day: description only, no distance, strip or /paces link", async () => {
    const dialog = await open(strengthDay.date);
    expect(within(dialog).getAllByText(strengthDay.description).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("Planned")).toBeNull();
    expect(within(dialog).queryByRole("list", { name: "Pace reference" })).toBeNull();
    expect(within(dialog).queryByRole("link", { name: /All pace zones/ })).toBeNull();
  });

  it("race day: 'Race day' title, Marathon line, and the race's real weekday", async () => {
    const dialog = await open(raceDay.date);
    expect(within(dialog).getByRole("heading", { name: "Race day" })).toBeDefined();
    expect(within(dialog).getByText("Marathon · 26.2 mi")).toBeDefined();
    expect(within(dialog).getByText("Wed, Dec 16")).toBeDefined();
  });

  it("date outside the plan: 'Not in your plan' with no stepper; Back to calendar closes", async () => {
    const dialog = await open("2030-01-01");
    expect(within(dialog).getByRole("heading", { name: "Not in your plan" })).toBeDefined();
    expect(within(dialog).getByText("There's no workout on that date.")).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Previous day" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to calendar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is a bottom sheet below 768px and a right panel from 768px", async () => {
    const narrow = await open(easyDay.date);
    expect(narrow.className).toContain("bottom-0");
    cleanup();
    stubWide(true);
    const wide = await open(easyDay.date);
    expect(wide.className).toContain("right-0");
  });
});

describe("pace strip", () => {
  it("shows only the zones the day's text references", async () => {
    const dialog = await open(easyDay.date);
    const strip = within(dialog).getByRole("list", { name: "Pace reference" });
    expect(within(strip).getAllByRole("listitem")).toHaveLength(1);
    expect(strip.textContent).toContain("Easy");
    expect(strip.textContent).not.toContain("MGP");
    expect(strip.textContent).not.toContain("Threshold");
  });

  it("uses the stored snapshot, not a recomputation", async () => {
    const edited = structuredClone(GOAL_ONLY);
    edited.paceZones.easy = { state: "computed", paceSecPerMile: 777, source: "recentResult" };
    const dialog = await open(easyDay.date, edited);
    expect(within(dialog).getAllByText("12:57 /mi").length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/\(12:57 \/mi\)/)).toBeDefined();
  });

  it("shows the Estimated chip when the snapshot is goal-derived", async () => {
    const dialog = await open(easyDay.date, GOAL_ONLY);
    const strip = within(dialog).getByRole("list", { name: "Pace reference" });
    expect(within(strip).getByText("Estimated")).toBeDefined();
  });

  it("shows no Estimated chip for a recent-result snapshot", async () => {
    const dialog = await open(easyDay.date, RECENT_RESULT);
    expect(within(dialog).queryByText("Estimated")).toBeNull();
  });
});

describe("Prev / Next", () => {
  it("is aria-disabled at the first plan day and does not navigate", async () => {
    const dialog = await open(PLAN.startDate);
    const prev = within(dialog).getByRole("button", { name: "Previous day" });
    expect(prev.getAttribute("aria-disabled")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Next day" }).getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(prev);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByText(/^Week 1 of 18/)).toBeDefined();
  });

  it("is aria-disabled on race day and does not navigate", async () => {
    const dialog = await open(RACE);
    const next = within(dialog).getByRole("button", { name: "Next day" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(within(dialog).getByRole("heading", { name: "Race day" })).toBeDefined();
  });

  it("steps by one real date, announces it, keeps focus on the button, and uses replace", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(GOAL_ONLY));
    renderWithProviders(<App />, { route: "/" });
    await screen.findByRole("heading", { level: 1 });
    // Tue Oct 13 -> Wed Oct 14 -> Thu Oct 15
    fireEvent.click(document.querySelector('[data-date="2026-10-13"]') as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    const next = within(dialog).getByRole("button", { name: "Next day" });
    next.focus();
    fireEvent.click(next);
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Wed, Oct 14")).toBeDefined());
    expect(within(screen.getByRole("dialog")).getByRole("status").textContent).toBe("Showing Wednesday, October 14");
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Thu, Oct 15")).toBeDefined());
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Previous day" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Wed, Oct 14")).toBeDefined());

    // Replace: one Close returns to the calendar, not back through every stepped day.
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { level: 1, name: "9 weeks to race day" })).toBeDefined();
  });
});

describe("focus", () => {
  it("moves initial focus to the title, not Close", async () => {
    const dialog = await open(easyDay.date);
    const title = within(dialog).getByRole("heading", { level: 2 });
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("returns focus to the originating row on Esc", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(GOAL_ONLY));
    renderWithProviders(<App />, { route: "/" });
    await screen.findByRole("heading", { level: 1 });
    const row = document.querySelector('[data-date="2026-10-13"]') as HTMLElement;
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("has a named dialog and 44px-class controls", async () => {
    const dialog = await open(easyDay.date);
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    for (const name of ["Previous day", "Next day", "Close"]) {
      expect(within(dialog).getByRole("button", { name }).className).toContain("size-11");
    }
  });
});
