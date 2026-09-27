# 5. Plan template schema

Date: 2026-09-27
Status: Accepted

## Context

The first hand-built plan template (the de-branded club-style marathon plan)
needs a shared, validating schema before it can be authored, per
`docs/decisions/0002-web-app-stack.md`'s "versioned JSON/YAML data files with
a shared validating schema" line and `docs/decisions/0003-template-source-
anonymization.md`'s de-branding requirement. This schema is a "schema that's
expensive to change later" per `CLAUDE.md`'s ADR trigger list: once a real
plan instance (#13) is persisted referencing a `templateId`/`templateVersion`,
the shape that instance was generated from can't be silently changed out from
under it.

## Decision

### Package

A new workspace package, `packages/plan-templates/` (`@training-plan/plan-
templates`), holds the Zod schema, the authored template content, and a
colocated vitest validation test — matching the `lint`/`typecheck`/`test`/
`build` script convention already used by `apps/web` and `apps/api`, so the
existing recursive CI step (`pnpm -r --if-present run ...`) picks it up with
zero workflow changes.

### Schema shape

**Plan level:** `templateId` (string slug), `templateVersion` (positive
int), `title` (de-branded display name), `raceDistanceType` (`'marathon' |
'ten_mile'` — generic across this template and the future MCR-style
ten-mile template), `totalWeeks`, `weeks` (forward-indexed `1..totalWeeks`
from plan start — not a race countdown, since the countdown is trivially
`totalWeeks - weekIndex` and duplicating it would be a second source of
truth).

**Week level:** `weekIndex`, `phase` (`'base' | 'build' | 'peak' | 'taper'`),
`isCutbackWeek?` (boolean), `days` (exactly 7, Monday-start, race day =
Sunday of the final week).

**Day level:** `dayOfWeek` (explicit `'mon'..'sun'` enum, not inferred from
array position, though the schema also enforces the two stay in sync — belt
and suspenders against off-by-one authoring errors), `dayType` (`'run' |
'rest' | 'strength' | 'cross_training'`), `workoutTag?` (`'long_run' |
'quality' | 'recovery' | 'easy' | 'race_pace'`, hand-set at transcription
time, never parsed out of `description`), `description` (freeform pace-zone
shorthand exactly as real plans write it — no structured multi-segment
workout representation), `distanceMiles?` (miles only, no unit field for
v1), `durationMinutes?` (optional, display-only, never used in volume math).

Two rules are enforced by `.superRefine()`, not left to authoring
convention, because they're load-bearing for downstream code:

1. **`distanceMiles` is required whenever `dayType === 'run'`.** This is what
   lets a future plan-instance feature (#13) derive weekly and peak-week
   mileage by summing `distanceMiles` across a week's run days, instead of
   trusting an author to keep a derived number in sync by hand.
2. **`workoutTag` is rejected on non-run days**, and **each week's 7 `days`
   must appear in exact `mon..sun` order.** Both are cheap, real validation
   at the schema boundary rather than trusting every template file to get it
   right — CLAUDE.md's "explicit input validation... rather than trusting
   the caller" applies to hand-authored data files, not just runtime
   requests.

### Peak week is derived, not authored

There is deliberately no `isPeakWeek` flag. Peak-week volume is computed by
summing each week's `distanceMiles` across `run` days and taking the max —
the same mechanism `distanceMiles`-required-on-run-days exists to support.
A hand-maintained flag is a second source of truth that can silently drift
from the actual day data as a template is edited, and — once a version is
pinned to real plan instances — can't be quietly corrected after the fact
without the same "never edit a referenced version in place" problem the
versioning policy below exists to prevent. Deriving it from the data that's
already required to be accurate removes the drift risk entirely instead of
just documenting it away.

`isCutbackWeek`, by contrast, stays a hand-authored flag: whether a week is a
periodization stepback is a judgment call about training structure, not a
value mechanically derivable from a single field the way peak volume is —
there's no equivalent "sum this column" rule for it.

### Estimated vs. sourced distances (transcription record)

`distanceMiles` is schema-required on every `run` day, but a number of
source-table entries specified a workout only by description or duration —
not an explicit mileage figure. Every number the source *did* give is
transcribed as-is or converted directly (each Saturday long-run range taken
at its midpoint, "8 miles easy," "10-mile fartlek workout," "5-mile
fartlek," and "3K at marathon goal pace" via km→mi). The entries below are
the only `distanceMiles` values with no source figure to transcribe, and the
estimate applied to each — recorded here, not just in the PR description, so
the distinction survives past review and sets the precedent `#10`'s
transcription should follow:

- **Recurring "Group quality workout" days** (Mon/Wed across most weeks) —
  source gives only "structured track or tempo session," no distance;
  estimated at **6 miles**.
- **Recurring "Recovery run" days** (Tue/Thu, and Monday in weeks 6, 8,
  10–15) — source gives only a duration (45 minutes, or a 45–60 minute
  range), no distance; estimated at **5 miles**.
- **Week 16 Wed, "8 x 1000m repeats"** — source names the interval structure,
  not a total session distance; estimated at **7 miles**.
- **Week 16 Thu, "Easy run"** — no distance given; estimated at **5 miles**.
- **Week 17 Mon, the multi-segment fartlek workout** — source describes
  pace/duration segments, not a total distance; estimated at **7 miles**
  (~65 minutes).
- **Week 17 Wed, "Yasso 800s (10 x 800m)"** — named-workout structure only,
  no total distance; estimated at **8 miles**.
- **Week 18 Tue, "Diagonal sprints"** — no distance given; estimated at
  **3 miles**.
- **Week 18 Sat, "30-minute easy shake-out run"** — duration given, not
  distance; estimated at **3 miles**.

Week 18 Sun ("Marathon race day") uses **26.2 miles** — the standard
marathon distance, not an estimate.

If a future edit changes the estimation policy (e.g. once real pace-zone
data lets a "6-mile tempo" be sized more precisely), update this list along
with the template file.

### `distanceMiles` is a planning estimate, not a completion record

Every `distanceMiles` value above — sourced or estimated — reflects only
what the day's `description` states, with no implied warm-up, cooldown, or
extra mileage added on top of a stated segment. Week 18 Monday's "3K at
marathon goal pace" is deliberately left at **1.9 miles** (the prescribed
segment, converted directly) rather than padded up toward the ~6-mile
figure used for an unspecified recovery/quality day — inflating a number
the source actually gave us to match an estimate for days where the source
gave us nothing would make the sourced value *less* accurate, not more
consistent.

This field exists to drive the plan template's own volume math (peak-week
detection, FR6) before any workout has happened — it is a planning number,
not a prediction of what a runner's watch will show. Once Strava activity
sync (#19) lands, a plan instance's *actual* completed distance for a given
day comes from the synced activity, which supersedes this field for
anything downstream of "did the workout happen and how far was it" —
`distanceMiles` is never reconciled against a synced activity, and a
runner's real warm-up/cooldown miles are expected to show up there, not
here.

### Versioning policy

Both a filename convention (`<templateId>.v<N>.json`) and internal fields
(`templateId`, `templateVersion`) exist together: the filename is for repo/
review organization, the internal fields are the runtime contract a plan
instance actually reads and stores. `src/templates.test.ts` asserts the two
never drift, and separately asserts `templateId`+`templateVersion` pairs are
unique across every committed template file — both by scanning
`src/templates/` directly, so a future second template (e.g. the ten-mile
template) is covered automatically without editing the test.

**Once any real plan instance references a given `templateId` +
`templateVersion`, that file is never edited in place again** — not even a
typo fix. A correction ships as a new version (`v2`, `v3`, ...). Before any
real instance exists referencing a version, editing that version's file in
place is fine. This matters because a plan instance is expected to store the
exact `templateId`/`templateVersion` it was generated from (#13); silently
changing what that pinned version means out from under an existing instance
would be worse than the small cost of a new file per fix.

## Consequences

- `#10` (a second, ten-mile-distance template) reuses this schema and
  package unchanged — confirmed generic by `raceDistanceType` — as a second
  `src/templates/*.json` file, no schema change expected.
- `#13` (plan instances) can safely sum `distanceMiles` for volume math
  without a second, hand-maintained "peak week" signal to keep in sync, and
  can pin a `templateId`+`templateVersion` pair knowing this package's test
  suite guarantees that pair is unique and immutable once referenced (the
  immutability itself is a process rule this ADR establishes, not something
  the test can enforce mechanically — there's no way for `src/templates.test.ts`
  to know which versions a live plan instance references).
- Content-accuracy is **not** covered by `schema.parse()` succeeding —
  structural validity says nothing about whether a mileage number was
  transcribed correctly from the source material. That risk is mitigated by
  a manual read-through against the source as part of PR review, not by
  tooling.
- Adding a genuinely new day type, phase, or workout tag later is a schema
  change to this package, reviewed the same way any other shared-package
  change is — not a per-template decision.
