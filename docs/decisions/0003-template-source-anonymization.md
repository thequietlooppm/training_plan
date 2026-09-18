# 3. Club plan template — source anonymization

Date: 2026-09-18
Status: Accepted

## Context

The first plan template (de-branded club-style marathon plan) is sourced from
a real running club's plan. The user is a standing member with legitimate
access, but the source material carries a "not for distribution" marking.
`docs/planning/product-brief.md` already specifies the template ships
de-branded — stripped of the club's name and any club-specific jargon,
presented generically — but that was a product/content decision, not yet a
standing rule for how the *team* handles the source material across every
artifact it produces (commits, code, docs, issues, comments, template data
files).

Confirmed directly by the user: this is not a one-time editorial pass on the
template text — it's a standing constraint for the duration of v1/MVP. Proper
branding of the source club's plan is an explicit, real *future* possibility
the product may pursue later, not ruled out permanently — just not now, and
not implicitly through a stray reference left in code, commits, or planning
docs.

Verified before this ADR was written: a full grep of tracked files, commit
messages, and git history turned up no reference to the club's name anywhere
in the repository. `plan_examples/` — which holds the actual source PDF — is
gitignored and has never been tracked. Nothing to remediate; this ADR exists
to keep it that way going forward, not to fix a leak.

## Decision

For as long as v1/MVP is the active scope (i.e., until a future, explicit
product decision to properly license/brand the source relationship —
superseding this ADR):

- **No club name, club branding, or club-specific jargon** appears in any
  artifact the team produces — source code, template data files, commit
  messages, PR descriptions, GitHub issues, code comments, design specs, ADRs,
  or test fixtures. The template is referred to generically (e.g. "the
  club-style marathon template") everywhere, including internally.
- The **source PDF/document itself stays out of version control** —
  `plan_examples/` (or wherever the runner keeps the raw source material)
  stays gitignored. Only the de-branded, hand-transcribed template content
  (freeform text + hand-set distance/duration per day, per the brief's
  workout-authoring model) is ever committed, as versioned files in
  `packages/` per `docs/decisions/0002-web-app-stack.md`.
- Whoever authors the template JSON/YAML is responsible for de-branding at
  transcription time — this is a manual, one-time editorial step per
  template, not an automated pipeline (there are only 2 hand-built templates
  for v1; general plan ingestion is explicitly out of scope).

## Consequences

- `@tech-lead` includes a check for club-identifying strings as part of
  reviewing any diff that touches template content or planning docs
  referencing the club plan — a lightweight review habit, not a CI gate (not
  worth automating for 2 hand-authored files at this volume; revisit if the
  template library grows).
- If the product later decides to properly brand/license the source
  relationship, that's a new product decision requiring its own ADR
  (superseding this one) before any club-identifying content is reintroduced
  into the codebase or its templates.
- No PII is involved here (a club's name/branding is not personal data), so
  this sits alongside — but is distinct from — the project's PII-isolation
  rules in `CLAUDE.md`. It's a source-material handling/IP-respect rule, not
  a privacy rule.
