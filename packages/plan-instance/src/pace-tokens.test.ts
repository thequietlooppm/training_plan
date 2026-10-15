import { resolvePaceTokens, type PaceZones } from "@training-plan/pace-zones";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { describe, expect, it } from "vitest";

const computed = (paceSecPerMile: number) =>
  ({ state: "computed", paceSecPerMile, source: "recentResult" }) as const;

// Every zone resolvable, so each token hit shows up in the output.
const ZONES: PaceZones = {
  recovery: computed(660),
  easy: computed(631),
  threshold: computed(425),
  tenK: computed(491),
  fiveK: computed(475),
  interval: computed(451),
  goal: { state: "computed", label: "marathon", paceSecPerMile: 549 },
};

/** The text each resolved pace was attached to (the token as written). */
function matchedTokens(description: string): string[] {
  // Marathon goal resolves MGP; a half goal resolves HMGP. Both are token hits.
  const half: PaceZones = { ...ZONES, goal: { state: "computed", label: "half", paceSecPerMile: 520 } };
  const hits: string[] = [];
  for (const zones of [ZONES, half]) {
    const { segments } = resolvePaceTokens(description, zones);
    segments.forEach((segment, i) => {
      const resolved = segment.kind === "pace";
      const notSet = segment.kind === "text" && segment.text === " (not set)";
      // The token as written is the segment before the " " separator (or "(not set)").
      if (resolved) hits.push(segments[i - 2]?.text ?? "");
      if (notSet) hits.push(segments[i - 1]?.text ?? "");
    });
  }
  return hits;
}

describe("pace tokens in the committed templates", () => {
  it("only the expected tokens resolve, so prose can never silently become a pace", () => {
    const hits = new Set<string>();
    for (const template of COMMITTED_PLAN_TEMPLATES) {
      for (const week of template.weeks) {
        for (const day of week.days) {
          for (const hit of matchedTokens(day.description)) hits.add(hit);
        }
      }
    }
    // A new template (or edit) that adds a token hit must be reviewed and listed here.
    expect([...hits].sort()).toEqual(["(HMGP)", "(MGP)", "10K pace", "5K pace", "MGP", "easy"].sort());
  });
});
