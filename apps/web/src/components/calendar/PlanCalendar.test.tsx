import { isoWeekday } from "@training-plan/plan-instance";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { PlanCalendar } from "@/components/calendar/PlanCalendar";
import { makePlan } from "@/test-fixtures";

afterEach(cleanup);

function renderCalendar(raceDate: string, today: string, revealDate?: string) {
  return render(
    <MemoryRouter>
      <PlanCalendar plan={makePlan(raceDate)} today={today} revealDate={revealDate} />
    </MemoryRouter>,
  );
}

function weekTrigger(n: number) {
  return screen.getByRole("button", { name: new RegExp(`^Week ${n} ·`) });
}

describe("PlanCalendar — Sunday race (Mon–Sun weeks), plan in progress", () => {
  // Sunday 2026-12-20 race; plan starts Mon 2026-08-17. Week 9 = Oct 12–18.
  const RACE = "2026-12-20";
  const TODAY = "2026-10-14"; // Wednesday of week 9 (Oct 12–18)

  it("shows the countdown, week/phase line and weeks-run line", () => {
    renderCalendar(RACE, TODAY);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("9 weeks to race day");
    expect(screen.getByText(/^Week 9 of 18 · /)).toBeDefined();
    expect(screen.getByText("Weeks run Monday to Sunday and end on race day.")).toBeDefined();
  });

  it("expands only the current week, in real date ranges with planned miles", () => {
    renderCalendar(RACE, TODAY);
    expect(weekTrigger(9).getAttribute("aria-expanded")).toBe("true");
    expect(weekTrigger(8).getAttribute("aria-expanded")).toBe("false");
    expect(weekTrigger(9).textContent).toContain("Oct 12–18");
    expect(weekTrigger(9).textContent).toMatch(/\d+(\.\d)? mi$/);
    expect(weekTrigger(18).textContent).toContain("Race week");
  });

  it("allows several weeks open at once (type=multiple)", () => {
    renderCalendar(RACE, TODAY);
    fireEvent.click(weekTrigger(8));
    expect(weekTrigger(8).getAttribute("aria-expanded")).toBe("true");
    expect(weekTrigger(9).getAttribute("aria-expanded")).toBe("true");
  });

  it("marks exactly one row as Today with aria-current and the visible word", () => {
    renderCalendar(RACE, TODAY);
    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute("data-date")).toBe(TODAY);
    expect(within(current[0] as HTMLElement).getByText("Today")).toBeDefined();
  });

  it("makes every day row a link to /day/:date named by its visible text", () => {
    renderCalendar(RACE, TODAY);
    const row = document.querySelector(`[data-date="${TODAY}"]`) as HTMLAnchorElement;
    expect(row.getAttribute("href")).toBe(`/day/${TODAY}`);
    expect(row.hasAttribute("aria-label")).toBe(false);
    const name = row.textContent ?? "";
    expect(name).toMatch(/^Wed 14 /);
    expect(screen.getByRole("link", { name: name })).toBe(row);
    // Seven rows in the open week.
    expect(document.querySelectorAll('a[data-date^="2026-10-"]').length).toBe(7);
  });

  it("labels rest days and long runs", () => {
    renderCalendar(RACE, TODAY);
    // Template week 9 has a rest day (Sun) and a long run (Sat).
    const sunday = document.querySelector('[data-date="2026-10-18"]') as HTMLElement;
    expect(sunday.textContent).toMatch(/Sun 18 Rest/);
    const saturday = document.querySelector('[data-date="2026-10-17"]') as HTMLElement;
    expect(within(saturday).getByText("Long")).toBeDefined();
  });

  it("shows the race-day block linking to the race date", () => {
    renderCalendar(RACE, TODAY);
    const block = screen.getByRole("link", { name: /^Race day Sun, Dec 20/ });
    expect(block.getAttribute("href")).toBe(`/day/${RACE}`);
  });

  it("reveals the week containing revealDate (deep link behind the sheet)", () => {
    renderCalendar(RACE, TODAY, "2026-09-02");
    expect(weekTrigger(3).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the Today pill when the current week is collapsed, and re-opens it", () => {
    renderCalendar(RACE, TODAY);
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    fireEvent.click(weekTrigger(9)); // collapse the current week
    const pill = screen.getByRole("button", { name: "Today" });
    fireEvent.click(pill);
    expect(weekTrigger(9).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("PlanCalendar — Wednesday race (Thu–Wed weeks)", () => {
  const RACE = "2026-12-16";
  const TODAY = "2026-10-14";

  it("is a Wednesday", () => {
    expect(isoWeekday(RACE)).toBe(3);
  });

  it("describes Thursday to Wednesday weeks and never Monday-start labels", () => {
    renderCalendar(RACE, TODAY);
    expect(screen.getByText("Weeks run Thursday to Wednesday and end on race day.")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("9 weeks to race day");
    expect(screen.getByText(/^Week 9 of 18 · /)).toBeDefined();
    expect(weekTrigger(9).textContent).toContain("Oct 8–14");
    expect(document.body.textContent).not.toMatch(/Week \d+, Monday/);
  });

  it("lists the current week's days Thu through Wed from the real dates", () => {
    renderCalendar(RACE, TODAY);
    const rows = Array.from(document.querySelectorAll('a[data-date^="2026-10-"]')).map(
      (a) => (a.textContent ?? "").slice(0, 6).trim(),
    );
    // Week 9 spans Oct 8–14 (Thu..Wed); the other open rows don't exist.
    expect(rows).toEqual(["Thu 8", "Fri 9", "Sat 10", "Sun 11", "Mon 12", "Tue 13", "Wed 14"]);
  });

  it("ends the race week on race day, with the race-day row last", () => {
    renderCalendar(RACE, TODAY);
    fireEvent.click(weekTrigger(18));
    const week = document.querySelectorAll('a[data-date^="2026-12-"]');
    const last = week[week.length - 1] as HTMLElement;
    expect(last.getAttribute("data-date")).toBe(RACE);
    expect(last.textContent).toMatch(/^Wed 16 /);
  });

  it("puts the long run on the weekday before the race weekday", () => {
    renderCalendar(RACE, TODAY);
    // Week 9 (Oct 8–14): template long run is the 6th day, i.e. Tue Oct 13.
    const tue = document.querySelector('[data-date="2026-10-13"]') as HTMLElement;
    expect(within(tue).getByText("Long")).toBeDefined();
    expect(tue.textContent).toMatch(/^Tue 13/);
  });
});

describe("PlanCalendar — not started", () => {
  // Race 2027-03-14 (Sunday) -> start Mon 2026-11-09... today is >0 days before it.
  const RACE = "2027-03-14";
  const TODAY = "2026-10-14";

  it("opens week 1, shows the start line, and no Today marker or pill", () => {
    renderCalendar(RACE, TODAY);
    expect(weekTrigger(1).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/^Starts Mon, Nov 9 · 18-week plan$/)).toBeDefined();
    expect(screen.queryByText(/^Week 1 of 18/)).toBeNull();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("21 weeks to race day");
  });

  it("appends the year when the start is not in the current year", () => {
    renderCalendar("2027-06-13", "2026-10-14");
    expect(screen.getByText(/^Starts Mon, Feb 8, 2027 · 18-week plan$/)).toBeDefined();
  });
});

describe("PlanCalendar — race countdown copy", () => {
  const RACE = "2026-12-20";
  it.each([
    ["2026-12-06", "2 weeks to race day"],
    ["2026-12-13", "1 week to race day"],
    ["2026-12-14", "Race week"],
    ["2026-12-19", "Race week"],
    ["2026-12-20", "Race day is today"],
  ])("on %s reads %s", (today, expected) => {
    renderCalendar(RACE, today);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(expected);
  });

  it("race week is always the last week, expanded when it is the current week", () => {
    renderCalendar(RACE, "2026-12-17");
    expect(weekTrigger(18).getAttribute("aria-expanded")).toBe("true");
    expect(weekTrigger(18).textContent).toContain("Dec 14–20");
  });
});

describe("PlanCalendar — post-race", () => {
  it("says when race day was and shows nothing else in the header", () => {
    renderCalendar("2026-12-20", "2026-12-25");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Race day was Sun, Dec 20");
    expect(screen.queryByText(/^Week \d+ of/)).toBeNull();
    expect(screen.queryByText(/Weeks run/)).toBeNull();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    // The final week is the one left open.
    expect(weekTrigger(18).getAttribute("aria-expanded")).toBe("true");
  });
});
