# apps/api container image — built from the repo root (not apps/api/ alone).
#
# This is a pnpm workspace. `apps/api` doesn't import from `packages/*` yet,
# but ADR 0002 puts real shared domain code there imminently — building the
# image from `apps/api/` alone would work today and break silently the first
# time it does. Building from the repo root keeps the workspace lockfile,
# `pnpm-workspace.yaml`, and `packages/*` reachable so that stays true.
#
# Used by render.yaml (dockerContext: ., dockerfilePath: ./Dockerfile) for
# the training-plan-api-dev Render Web Service. Not used for apps/web, which
# is a static build deployed to Cloudflare Pages instead (see
# docs/decisions/0002-web-app-stack.md).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- deps: install only what apps/api needs (+ its workspace deps, once
# packages/* is non-empty), not the whole monorepo (apps/web's React/Vite/
# Tailwind toolchain has no business in this image). `--frozen-lockfile`
# still validates against every workspace member's package.json, so every
# member's manifest has to be present even though only @training-plan/api's
# subgraph gets installed.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @training-plan/api...

# --- build: compile TypeScript to dist/ via the existing build script.
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @training-plan/api build

# --- runtime: run the compiled output directly out of the pnpm workspace
# install (symlinked node_modules and all) rather than hand-rolling a
# production-only prune — this is a free-tier dev image, not a
# size-optimized prod one; correctness of pnpm's workspace symlinks beats a
# smaller image here.
FROM build AS runtime
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
