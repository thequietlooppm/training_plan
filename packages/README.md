# packages

Code shared across platforms — the API contract, domain types, and validation
rules that the web app and (later) the native iOS/Android apps all depend on.

`packages/plan-templates/` — the Zod schema and loader for hand-authored plan
templates (see `docs/decisions/0005-plan-template-schema.md`) — is the first
package here.

`packages/pace-zones/` — the framework-free VDOT/Riegel-style pace-zone
calculator (#11): derives all 7 pace zones from a recent race result and/or
a goal time. See its own README for the output contract.

The next shared package is extracted the moment a second client (or a
standalone backend) needs the same types — don't let domain logic settle
inside `apps/web/` first.
