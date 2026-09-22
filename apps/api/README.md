# apps/api

The training_plan backend — Fastify (TypeScript), ESM. See
`docs/decisions/0002-web-app-stack.md` for the stack decision.

Currently just a hello-world scaffold: `GET /health` → `{ "status": "ok" }`.

## Local development

```sh
pnpm --filter @training-plan/api dev
```

Copy `.env.example` to `.env` to override the defaults (port, host, the
comma-separated `apps/web` origin(s) allowed by CORS via `WEB_APP_ORIGIN`).
Defaults work out of the box for local dev without a `.env` file.

Server listens on `http://localhost:3001` by default.
