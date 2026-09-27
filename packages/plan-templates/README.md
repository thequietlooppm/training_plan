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
