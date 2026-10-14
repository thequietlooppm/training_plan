import { calculate } from "@training-plan/pace-zones";
import { parseStoredPlanInstance } from "@training-plan/plan-instance";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { PLAN_STORAGE_KEY, type PlanInstanceStore } from "@/lib/plan-store";
import { failingStore, makeStoredPlan } from "@/test-fixtures";
import { renderWithProviders } from "@/test-utils";

// jsdom lacks these; Radix RadioGroup/Select need no-op stubs (see
// PlanSetupPage.test.tsx).
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

// "Today" is Wed 2026-10-14. Only Date is faked.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const WED_RACE = "2026-12-16";
const SUN_RACE = "2026-12-20";

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

function setRaceDate(value: string) {
  fireEvent.change(document.getElementById("race-date")!, { target: { value } });
}

function fillGoalTime() {
  fireEvent.click(screen.getByRole("radio", { name: "Half" }));
  fireEvent.change(document.getElementById("goal-time-hours")!, { target: { value: "1" } });
  fireEvent.change(document.getElementById("goal-time-minutes")!, { target: { value: "45" } });
  fireEvent.change(document.getElementById("goal-time-seconds")!, { target: { value: "0" } });
}

function calculateZones() {
  fireEvent.click(screen.getByRole("button", { name: "Calculate my pace zones" }));
}

async function calculated(raceDate: string) {
  setRaceDate(raceDate);
  fillGoalTime();
  calculateZones();
  return screen.findByRole("button", { name: "Create my plan" });
}

function openSetup(store?: PlanInstanceStore) {
  return renderWithProviders(<App />, { route: "/setup", store });
}

const GOAL = { goalTime: { distance: "half" as const, timeSeconds: 6300 } };

describe("setup: Create my plan", () => {
  it("is not offered before Calculate", () => {
    openSetup();
    expect(screen.queryByRole("button", { name: "Create my plan" })).toBeNull();
  });

  it("shows the plan-shape line above the button, built from the generated plan (Wednesday race)", async () => {
    openSetup();
    const button = await calculated(WED_RACE);
    const line = screen.getByText(
      "Your plan weeks run Thursday to Wednesday and end on race day. Long runs fall on Tuesdays.",
    );
    expect(button.getAttribute("aria-describedby")).toContain(line.id);
    expect(line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/^Your plan is saved on this device only/)).toBeDefined();
  });

  it("reads Monday to Sunday and Saturdays for a Sunday race", async () => {
    openSetup();
    await calculated(SUN_RACE);
    expect(
      screen.getByText(
        "Your plan weeks run Monday to Sunday and end on race day. Long runs fall on Saturdays.",
      ),
    ).toBeDefined();
  });

  it("omits the plan-shape line for an empty race date and asks for one at Create", async () => {
    openSetup();
    fillGoalTime();
    calculateZones();
    const button = await screen.findByRole("button", { name: "Create my plan" });
    expect(screen.queryByText(/Your plan weeks run/)).toBeNull();

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByText("Enter your race date to create a plan.")).toBeDefined(),
    );
    const field = document.getElementById("race-date")!;
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field);
    expect(window.localStorage.getItem(PLAN_STORAGE_KEY)).toBeNull();
  });

  it("disables Create when inputs change after Calculate, until recalculated", async () => {
    openSetup();
    const button = await calculated(WED_RACE);
    expect((button as HTMLButtonElement).disabled).toBe(false);

    setRaceDate(SUN_RACE);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText("Calculate again to use your changes.")).toBeDefined();
    // The old results stay visible.
    expect(screen.getByText("Your pace zones")).toBeDefined();

    calculateZones();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("Calculate again to use your changes.")).toBeNull();
  });

  it("creates the plan with the frozen pace snapshot, goes to /, and focuses the page heading", async () => {
    openSetup();
    const button = await calculated(WED_RACE);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    const heading = await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" });
    await waitFor(() => expect(document.activeElement).toBe(heading));

    const loaded = parseStoredPlanInstance(window.localStorage.getItem(PLAN_STORAGE_KEY));
    expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") return;
    expect(loaded.value.raceDate).toBe(WED_RACE);
    expect(loaded.value.templateId).toBe("club-style-marathon");
    const expected = calculate(GOAL);
    expect(expected.ok).toBe(true);
    if (expected.ok) expect(loaded.value.paceZones).toEqual(expected.zones);
    expect(loaded.value.calculatorInput).toEqual(GOAL);
    // The current week is expanded.
    expect(screen.getByRole("button", { name: /^Week 9 ·/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("asks before replacing an existing plan, defaulting focus to Cancel", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(makeStoredPlan(WED_RACE)));
    openSetup();
    const button = await calculated(SUN_RACE);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Replace your current plan?")).toBeDefined();
    expect(
      within(dialog).getByText(
        "This replaces your plan for the race on Wed, Dec 16 with a new plan for Sun, Dec 20. This can't be undone.",
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));

    // Cancel keeps the old plan and stays on /setup.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "Set up your plan" })).toBeDefined();
    const kept = parseStoredPlanInstance(window.localStorage.getItem(PLAN_STORAGE_KEY));
    expect(kept.status === "ok" && kept.value.raceDate).toBe(WED_RACE);
    await waitFor(() => expect(document.activeElement).toBe(button));

    // Replace saves the new plan and navigates.
    fireEvent.click(button);
    const again = await screen.findByRole("alertdialog");
    fireEvent.click(within(again).getByRole("button", { name: "Replace plan" }));
    await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" });
    const replaced = parseStoredPlanInstance(window.localStorage.getItem(PLAN_STORAGE_KEY));
    expect(replaced.status === "ok" && replaced.value.raceDate).toBe(SUN_RACE);
  });

  it("treats a corrupt stored plan as no plan: no dialog, set-aside value kept", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{broken");
    openSetup();
    const button = await calculated(WED_RACE);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    await screen.findByRole("heading", { level: 1, name: "9 weeks to race day" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(window.localStorage.getItem("tp:plan-instance:corrupt")).toBe("{broken");
    expect(screen.queryByText(/couldn't read your saved plan/i)).toBeNull();
  });

  it("does not assume 'no plan' when the lookup fails: error, Try again, Create disabled", async () => {
    openSetup(failingStore());
    const button = await calculated(WED_RACE);
    expect(await screen.findByText("Couldn't check for an existing plan. Try again.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps entries and shows an alert when saving fails", async () => {
    const store: PlanInstanceStore = {
      get: async () => ({ status: "empty" }),
      save: () => Promise.reject(new Error("quota")),
      clear: async () => {},
    };
    openSetup(store);
    const button = await calculated(WED_RACE);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    expect(
      await screen.findByText("Couldn't create your plan. Your entries are still here — try again."),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Set up your plan" })).toBeDefined();
    expect((document.getElementById("race-date") as HTMLInputElement).value).toBe(WED_RACE);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("setup: race date validation", () => {
  it("rejects a past date at Calculate with the existing message", async () => {
    openSetup();
    setRaceDate("2026-10-13");
    fillGoalTime();
    calculateZones();
    expect(await screen.findByText("Race date can't be in the past.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Create my plan" })).toBeNull();
  });

  it("accepts race day today and any weekday (no Sunday rule)", async () => {
    openSetup();
    const button = await calculated("2026-10-14"); // today, a Wednesday
    expect(button).toBeDefined();
    expect(screen.queryByText(/Sunday/)).toBeNull();
    expect(screen.queryByText("Race date can't be in the past.")).toBeNull();
  });
});
