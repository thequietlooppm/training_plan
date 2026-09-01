# apps/web

The training_plan web app — the first platform target.

**Not scaffolded yet.** The stack (framework, backend, data store) is decided
during planning of the first web issue and recorded in
`docs/decisions/0002-web-app-stack.md`. Once that ADR is Accepted, `@swe`
scaffolds the app here.

Domain logic and the API contract that native clients will also use belong in
`../../packages/`, not here.
