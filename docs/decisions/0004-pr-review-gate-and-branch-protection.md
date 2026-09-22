# 4. PR review gate and branch protection on `main`

Date: 2026-09-20
Status: Accepted

## Context

`CLAUDE.md` already states the rule: "Don't merge to main without: green CI +
tech-lead review + the change matching the plan on the issue." Nothing on the
GitHub repo (`thequietlooppm/training_plan`, private) technically enforces
this today. Every commit so far — both ADRs, the product brief, the
requirements doc, the subagent scaffolding — landed via direct push to `main`,
no PR, no review. That was reasonable for solo docs work, but it means the
rule in `CLAUDE.md` is a convention only, not a gate — a future run (human or
agent) can `git push origin main` and skip review entirely, including for
real application code.

An outside reviewer (human or another agent) is about to start reviewing code
before it merges, starting with issue #5's scaffold. For that to mean
anything, a PR has to be the *only* path to `main`, and it has to be a place
a reviewer can actually see the diff and leave a verdict GitHub tracks.

**Attempted and blocked:** `gh api repos/.../branches/main/protection`
(both `GET` and `PUT`) returns:

```
403: "Upgrade to GitHub Pro or make this repository public to enable this
feature." (also true of the newer repository-rulesets API)
```

This repo is a private repo under a free personal GitHub account
(`thequietlooppm`). Both classic branch protection and the newer rulesets
feature require **GitHub Pro** for private repos on the free plan, or the
repo being **public**. There is no third way to technically block direct
pushes to `main` on a private free-tier repo. I confirmed this by calling the
API directly, not by reading docs — the 403 above is the actual, current
response for this account.

## Decision

Two options were on the table, and neither was mine to pick silently (one was
a recurring cost, the other a visibility change to product code):

| Option | Cost | Effect |
|---|---|---|
| A. Upgrade `thequietlooppm` to GitHub Pro | $4/month | Unlocks branch protection + rulesets on the private repo, no visibility change. |
| **B. Make the repo public — chosen, 2026-09-20** | $0 | Unlocks the same features immediately, no subscription. Trades away privacy of the source. |

**The user chose Option B.** The repo was made public
(`gh repo edit thequietlooppm/training_plan --visibility public
--accept-visibility-change-consequences`), verified live via
`gh repo view --json isPrivate,visibility` → `{"isPrivate": false, "visibility":
"PUBLIC"}`. Before this, a check for anything that shouldn't be public found
no secrets or `.env` files tracked (only `.env.example` files with variable
names, no values) and no club-identifying content per ADR 0003 — no blocker.

Branch protection on `main` was then applied and verified live by reading it
back via the API (not just assumed from the `PUT` response):

```
PUT /repos/thequietlooppm/training_plan/branches/main/protection
{
  "required_status_checks": null,          # revisit once issue #6 (CI) lands — see below
  "enforce_admins": true,                  # the owner's own account cannot bypass this either
  "required_pull_request_reviews": {
    "required_approving_review_count": 0   # see "Why 0" below — not a typo
  },
  "restrictions": null
}
```

Confirmed live via `GET /repos/thequietlooppm/training_plan/branches/main/protection`:
`enforce_admins.enabled: true`, `required_pull_request_reviews
.required_approving_review_count: 0`, `allow_force_pushes.enabled: false`,
`allow_deletions.enabled: false`. Direct pushes to `main` — including from the
repo owner's own account — are now blocked; a PR is the only path in.

- **`enforce_admins: true`** is the actual point of this whole change: it
  means direct pushes to `main` are blocked for *everyone*, including the
  repo owner's own account and any agent pushing under that account's
  credentials (which is all of them here — swe, tech-lead, deploy-engineer
  all operate as the same GitHub identity in this environment). Without a PR,
  nothing reaches `main`, full stop.
- **`required_approving_review_count: 0`, not 1** — this is the resolved
  answer to the "who approves" question, and it's deliberately *not* a
  GitHub-native required-approval gate. GitHub does not let a PR's author
  approve their own PR (the "Approve" option is disabled in the UI, and the
  API rejects it) — it counts only "Comment" or "Request changes" from the
  author. Because this repo has exactly one real GitHub identity
  (`thequietlooppm`) and every PR — whether opened by swe, tech-lead, or
  deploy-engineer — is authored under that same identity, setting a required
  approval count of 1 would make every PR permanently unapprovable through
  GitHub's own UI: the one human account that exists is always the author.
  Adding a second GitHub account purely to click "Approve" is more
  process than a solo project needs right now.
  - So the technical gate is "a PR must exist and CI must be green"; the
    *review* itself — human judgment, or an AI agent's findings — is a
    process step enforced by discipline and `CLAUDE.md`, not by a GitHub
    button. Concretely: an agent (via `/code-review`, or the cloud
    multi-agent "ultra" review) posts findings as PR review comments; the
    user reads them and either asks for changes or merges. The user's own
    GitHub account is the one that ends up clicking "Merge," always — but
    that's a discretionary call informed by the review, not a required
    approval GitHub enforces structurally.
  - Revisit this the moment a second real reviewer (human) has their own
    GitHub account on the repo — at that point, set
    `required_approving_review_count: 1` for real, since self-approval
    stops being the only option.
- **`required_status_checks: null` for now** — there is no CI workflow yet
  (tracked separately as issue #6). The moment issue #6 lands a GitHub
  Actions workflow, this field should be updated to require that workflow's
  job(s) by name, so a red pipeline blocks merge exactly as `CLAUDE.md`
  requires — not just "a PR exists."

### Update, 2026-09-21 — `required_status_checks` is no longer a placeholder

Issue #6's CI workflow merged to `main` (PR #43, merge commit `7b587e6`). Per
tech-lead's plan on that issue, the check-run name was confirmed live against
that merge commit — `gh api repos/.../commits/7b587e6.../check-runs` returned
exactly one check run, `name: "ci"`, `conclusion: "success"` — before trusting
it, not assumed from the workflow YAML's `job.name` alone (a push-triggered
run on `main` is a distinct event from the PR's `pull_request`-triggered run,
so this had to be checked for real).

Branch protection was updated (full replace, since the API's `PUT` isn't a
patch — every other existing setting was re-sent unchanged, not dropped):

```
PUT /repos/thequietlooppm/training_plan/branches/main/protection
{
  "required_status_checks": { "strict": false, "contexts": ["ci"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "restrictions": null
}
```

Confirmed live via a fresh `GET` afterward: `required_status_checks.contexts:
["ci"]`, `enforce_admins.enabled: true` and the rest unchanged from before.
`strict: false` (not requiring the branch to be up to date with `main` before
merge) — kept simple for now; revisit if stale-branch merges start causing
problems.

Sanity-checked end to end with a real throwaway PR (#44, closed and its
branch deleted immediately after, no debris left): opened against `main`
while `ci` was still running, and `gh api .../pulls/44` reported
`mergeable_state: "blocked"` — correctly refused to merge. Once `ci`
completed (`conclusion: "success"`), the same PR reported
`mergeable_state: "unstable"`, `mergeable: true` (`"unstable"` here only
reflects an unrelated, non-required check — an external code-review
automation — still running; it doesn't gate merging). Confirmed both
directions: blocked while `ci` is pending, mergeable once `ci` is green.

### Docs changes go through PRs too, going forward

Once `enforce_admins: true` is live, there is no carve-out available anyway —
direct pushes to `main` are blocked for everything, including docs, because
GitHub branch protection doesn't distinguish by path without the more complex
rulesets path-filter feature (not worth the complexity at this scale). I
recommend embracing that rather than fighting it: docs/planning changes
should go through the same `<issue-number>-short-slug` branch + PR flow
`CLAUDE.md` already prescribes for code, just lightweight — open the PR,
skim the diff, merge it yourself, no multi-day review cycle expected for a
docs-only change. This is a real change to how every prior commit in this
project has landed (all docs work so far was a direct push), and it's worth
being explicit that it now applies to docs too, not just app code.

## Consequences

- The repo is now **public**. Anyone can read the source, fork it, and see
  issues/PRs/commit history. Nothing currently in the repo was found to need
  redacting first (see the secrets/club-content check above), but this is a
  standing fact to keep in mind for anything committed from here on —
  there's no private fallback unless a future ADR reverses this one.
- `main` now has **real technical enforcement**: direct pushes are rejected
  for everyone, including the repo owner's own account
  (`enforce_admins: true`). Every change — docs included — needs a branch +
  PR; there's no more "direct push because it's just a docs edit."
- The "approval" gate is process, not a GitHub-enforced button, for as long
  as this is a one-human-identity repo. Re-evaluate
  `required_approving_review_count` if a second reviewer with their own
  GitHub account joins.
- `required_status_checks` is now enforced (`contexts: ["ci"]`, as of
  2026-09-21) — a red or pending `ci` run blocks merge, not just a missing PR.
- CODEOWNERS was deliberately not added — it only does anything once branch
  protection can require code-owner review, and with one identity in the
  repo it would just point back at the same account. Revisit alongside the
  approval-count question above.
