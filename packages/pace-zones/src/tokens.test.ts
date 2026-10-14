import { describe, expect, it } from "vitest";
import type { PaceZones } from "./calculator.js";
import { PACE_TOKEN_TABLE, resolvePaceTokens } from "./tokens.js";

const computed = (paceSecPerMile: number, source: "recentResult" | "goalTime" = "recentResult") =>
  ({ state: "computed", paceSecPerMile, source }) as const;

const MARATHON_ZONES: PaceZones = {
  recovery: computed(660),
  easy: computed(630),
  threshold: computed(425),
  tenK: computed(490),
  fiveK: computed(475),
  interval: computed(450),
  goal: { state: "computed", label: "marathon", paceSecPerMile: 549 },
};

const HALF_ZONES: PaceZones = {
  ...MARATHON_ZONES,
  goal: { state: "computed", label: "half", paceSecPerMile: 520 },
};

const NO_GOAL: PaceZones = { ...MARATHON_ZONES, goal: { state: "unset" } };

const ESTIMATED: PaceZones = {
  ...MARATHON_ZONES,
  easy: computed(630, "goalTime"),
  tenK: computed(490, "goalTime"),
};

describe("token table", () => {
  it("maps every token in calendar spec 5.3", () => {
    expect(PACE_TOKEN_TABLE).toEqual({
      easy: "easy",
      E: "easy",
      MGP: "marathonGoal",
      M: "marathonGoal",
      HMGP: "halfGoal",
      "10K pace": "tenK",
      "5K pace": "fiveK",
      TP: "threshold",
      threshold: "threshold",
      T: "threshold",
      interval: "interval",
      I: "interval",
    });
  });
});

describe("resolvePaceTokens", () => {
  it.each([
    ["8 miles easy", "8 miles easy (10:30 /mi)", "Easy"],
    ["6 E miles", "6 E (10:30 /mi) miles", "Easy"],
    ["4 miles at MGP", "4 miles at MGP (9:09 /mi)", "MGP"],
    ["4 miles at M", "4 miles at M (9:09 /mi)", "MGP"],
    ["3 x 1 mile at 10K pace", "3 x 1 mile at 10K pace (8:10 /mi)", "10K pace"],
    ["6 x 400 at 5K pace", "6 x 400 at 5K pace (7:55 /mi)", "5K pace"],
    ["20 min at TP", "20 min at TP (7:05 /mi)", "Threshold"],
    ["20 min at threshold", "20 min at threshold (7:05 /mi)", "Threshold"],
    ["20 min at T", "20 min at T (7:05 /mi)", "Threshold"],
    ["5 x 1K at interval", "5 x 1K at interval (7:30 /mi)", "Interval"],
    ["5 x 1K at I", "5 x 1K at I (7:30 /mi)", "Interval"],
  ])("resolves %j", (input, text, label) => {
    const result = resolvePaceTokens(input, MARATHON_ZONES);
    expect(result.text).toBe(text);
    expect(result.entries.map((e) => e.label)).toEqual([label]);
  });

  it("puts the pace after the closing paren of a parenthesised token", () => {
    const result = resolvePaceTokens(
      "10-12 mile long run, last 4 miles at marathon goal pace (MGP)",
      MARATHON_ZONES,
    );
    expect(result.text).toBe(
      "10-12 mile long run, last 4 miles at marathon goal pace (MGP) (9:09 /mi)",
    );
  });

  it("passes unknown text and lowercase-only word look-alikes through unchanged", () => {
    for (const input of ["Easy run", "Recovery run", "Rest day", "Yasso 800s (10 x 800m)", "3K at marathon goal pace"]) {
      const result = resolvePaceTokens(input, MARATHON_ZONES);
      expect(result.text).toBe(input);
      expect(result.entries).toEqual([]);
    }
  });

  it("does not match tokens inside longer words or hyphenated terms", () => {
    const result = resolvePaceTokens("MGP-based, easyish, Tempo, 10K paces, M5", MARATHON_ZONES);
    expect(result.text).toBe("MGP-based, easyish, Tempo, 10K paces, M5");
  });

  it("lists each zone once, in first-use order, and resolves every occurrence inline", () => {
    const result = resolvePaceTokens("2 mi easy, 4 mi at MGP, 1 mi easy", MARATHON_ZONES);
    expect(result.text).toBe(
      "2 mi easy (10:30 /mi), 4 mi at MGP (9:09 /mi), 1 mi easy (10:30 /mi)",
    );
    expect(result.entries.map((e) => `${e.label} ${e.pace}`)).toEqual([
      "Easy 10:30 /mi",
      "MGP 9:09 /mi",
    ]);
  });

  it("resolves the long fartlek description across HMGP, 10K and 5K", () => {
    const description =
      "Fartlek – 15 min warm-up, 10 min at half-marathon goal pace (HMGP), 2 min recovery, 3 x 5 min at 10K pace with 1 min recovery between reps, then 10 x 1 min at 5K pace";
    const result = resolvePaceTokens(description, HALF_ZONES);
    expect(result.text).toContain("(HMGP) (8:40 /mi)");
    expect(result.text).toContain("10K pace (8:10 /mi)");
    expect(result.text).toContain("5K pace (7:55 /mi)");
    expect(result.entries.map((e) => e.label)).toEqual(["HMGP", "10K pace", "5K pace"]);
  });

  describe("HMGP and MGP availability", () => {
    it("shows 'HMGP (not set)' with no strip entry when there is no half goal", () => {
      for (const zones of [MARATHON_ZONES, NO_GOAL]) {
        const result = resolvePaceTokens("10 min at HMGP", zones);
        expect(result.text).toBe("10 min at HMGP (not set)");
        expect(result.entries).toEqual([]);
      }
    });

    it("resolves HMGP only to a half-marathon goal", () => {
      const result = resolvePaceTokens("10 min at HMGP", HALF_ZONES);
      expect(result.text).toBe("10 min at HMGP (8:40 /mi)");
      expect(result.entries).toEqual([
        { key: "halfGoal", label: "HMGP", pace: "8:40 /mi", estimated: false },
      ]);
    });

    it("never shows a half goal pace as marathon goal pace", () => {
      const result = resolvePaceTokens("4 miles at MGP", HALF_ZONES);
      expect(result.text).toBe("4 miles at MGP (not set)");
      expect(result.entries).toEqual([]);
    });

    it("shows 'MGP (not set)' when no goal is set", () => {
      expect(resolvePaceTokens("4 miles at MGP", NO_GOAL).text).toBe("4 miles at MGP (not set)");
    });
  });

  it("leaves a token alone when its zone is blocked", () => {
    const blocked: PaceZones = {
      ...MARATHON_ZONES,
      easy: { state: "blocked", reason: "noInput" },
    };
    const result = resolvePaceTokens("8 miles easy", blocked);
    expect(result.text).toBe("8 miles easy");
    expect(result.entries).toEqual([]);
  });

  describe("Estimated flag", () => {
    it("flags goal-derived equivalency zones in entries and inline segments", () => {
      const result = resolvePaceTokens("8 miles easy, 3 x 1 mile at 10K pace, 2 mi at MGP", ESTIMATED);
      expect(result.entries.map((e) => [e.label, e.estimated])).toEqual([
        ["Easy", true],
        ["10K pace", true],
        ["MGP", false],
      ]);
      const paceSegments = result.segments.filter((s) => s.kind === "pace");
      expect(paceSegments.map((s) => s.estimated)).toEqual([true, true, false]);
    });

    it("does not flag recent-result zones", () => {
      const result = resolvePaceTokens("8 miles easy", MARATHON_ZONES);
      expect(result.entries[0]?.estimated).toBe(false);
    });
  });

  it("joins segments back to text", () => {
    const result = resolvePaceTokens("2 mi easy then 4 at MGP.", MARATHON_ZONES);
    expect(result.segments.map((s) => s.text).join("")).toBe(result.text);
  });
});
