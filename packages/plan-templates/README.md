# @training-plan/plan-templates

Shared, versioned plan-template schema and hand-authored template content.
Consumed by `apps/api` (and, later, `apps/web`) to personalize a template
into a real plan instance. See `docs/decisions/0005-plan-template-schema.md`
for the schema shape and versioning policy.

## Contents

- `src/schema.ts` — the Zod schema (`planTemplateSchema`) and inferred
  TypeScript types for a plan template: plan → week → day.
- `src/templates/*.json` — hand-transcribed, de-branded template content
  (see `docs/decisions/0003-template-source-anonymization.md`). Each file is
  named `<templateId>.v<N>.json`; `src/templates.test.ts` enforces that the
  filename and the file's internal `templateId`/`templateVersion` fields
  never drift.
- `src/templates.test.ts` — validates every committed template file against
  the schema and checks `templateId`+`templateVersion` uniqueness.
- `src/load.ts` (`loadCommittedPlanTemplates()`) — Node-only loader (`fs`,
  `import.meta.url`) that scans `src/templates/*.json` at runtime. For
  `apps/api` and any future server-side consumer. Import it from the
  `@training-plan/plan-templates/load` subpath — **never** from the bare
  `@training-plan/plan-templates` specifier.
- `src/committed.ts` (`COMMITTED_PLAN_TEMPLATES`) — browser-safe
  (Vite-bundleable) alternative for `apps/web`, built from **static** JSON
  imports rather than a directory scan (a runtime `fs` scan can't run in a
  browser bundle). Each import is validated through `planTemplateSchema` at
  module-load time, same as `load.ts`.

## Why the Node-only loader is not in the default export

`package.json`'s `exports` map has two entries:

- `"."` (`dist/index.js`) — the default `@training-plan/plan-templates`
  specifier. `apps/web` imports this. It must stay browser-safe: no
  `node:fs`, `node:path`, or `node:url` anywhere in its import graph, because
  Vite only *warns* (doesn't fail the build) when it externalizes a Node
  builtin for the browser — the page ships and throws on mount at runtime
  instead of failing CI. This already happened once (#53): `index.ts` briefly
  re-exported `loadCommittedPlanTemplates` from `load.js`, which pulled
  `node:fs` into `apps/web`'s bundle and crashed `/setup` before React could
  mount, despite green typecheck/lint/test/build.
- `"./load"` (`dist/load.js`) — the Node-only `loadCommittedPlanTemplates()`,
  for `apps/api` and other server-side consumers. Import it as
  `@training-plan/plan-templates/load`.

**`src/index.ts` (the `"."` barrel) must never re-export anything from
`load.ts`.** `src/browser-entry.test.ts` statically walks `index.ts`'s import
graph and fails the test suite if a `node:` builtin (or `load.ts` itself)
becomes reachable from it again.

## Adding a new committed template — two places, not one

`loadCommittedPlanTemplates()` (`load.ts`) auto-discovers any new file
dropped into `src/templates/`, but `COMMITTED_PLAN_TEMPLATES`
(`committed.ts`) does **not** — it's a fixed list of static imports, which is
what makes it safe to bundle for the browser. Adding a new template (e.g.
#10's MCR 10-mile plan) requires touching **both**:

1. `src/templates/<templateId>.v<N>.json` — the new template content.
2. `src/committed.ts` — add the `with { type: "json" }` import for the new
   file and its entry in the `COMMITTED_PLAN_TEMPLATES` array.

Forgetting step 2 doesn't fail loudly anywhere by default — the new template
is fully valid and picked up by `load.ts` and `templates.test.ts`, it just
never appears in `apps/web`'s template picker. `committed.test.ts` guards
against this by asserting `COMMITTED_PLAN_TEMPLATES.length` matches the
number of files in `src/templates/` — if that test starts failing after
adding a template, this is why.

## Versioning

Once any real plan instance references a `templateId`+`templateVersion`,
that file is never edited in place again — a fix or content change ships as
a new version (`v2`, `v3`, ...), never an in-place edit of a referenced
version.

## Local development

```sh
pnpm --filter @training-plan/plan-templates test
pnpm --filter @training-plan/plan-templates build
```
