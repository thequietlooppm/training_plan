# apps/web

The training_plan web app — the first platform target.

**Scaffolded.** Vite + React + TypeScript, styled with Tailwind CSS and
shadcn/ui (Lucide for icons), with TanStack Query for server state — per
`docs/decisions/0002-web-app-stack.md`. It talks to `apps/api/` over HTTP.

Domain logic and the API contract that native clients will also use belong in
`../../packages/`, not here.
