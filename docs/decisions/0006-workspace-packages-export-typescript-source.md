# 6. Workspace packages export TypeScript source; apps/api is bundled

Date: 2026-09-28
Status: Accepted

## Context

`packages/pace-zones` and `packages/plan-templates` are private, unpublished
pnpm workspace packages (`"private": true`, version `0.0.0`). Their only
consumers are other members of this repo. `apps/web` consumes them now, and
`apps/api` will consume them from #13 (generate a personalized plan instance
from a template plus derived paces).

Originally both packages pointed `main`/`types`/`exports` at `dist/*.js`. CI
runs `typecheck` before `build`, and `dist/` is gitignored, so on a fresh
checkout `tsc` in `apps/web` failed with **TS2307** ("Cannot find module
'@training-plan/pace-zones'" / "'@training-plan/plan-templates'"), and vitest
failed with "Failed to resolve import". Locally it only passed if someone had
already built the packages. The failure came up again and again during review
of PR #53 and PR #54.

The fix in #54 (pace-zones) and PR #53 (plan-templates) repointed every
entry at source. `packages/plan-templates/package.json` now has `.` →
`src/index.ts` and `./load` → `src/load.ts`, with the same `types`/`import`
pair for each. That works for every consumer that transpiles TypeScript:
`tsc` (with `moduleResolution: NodeNext`), Vite, vitest, and `tsx`.

It does **not** work for plain Node. `apps/api` builds with
`tsc -p tsconfig.build.json` (emitting `apps/api/src` only) and runs
`node dist/index.js`, both in `package.json#start` and in the `Dockerfile`
`CMD` that the Render free-tier dev service (`render.yaml`) runs. When #13
adds the first `import ... from "@training-plan/..."` to `apps/api`, the
compiled `dist/index.js` will resolve to a `.ts` file at runtime and crash.
Typecheck, tests, and `tsx watch` dev all stay green, so the first place the
failure shows up is the deployed service.

Node's own type stripping doesn't save us either. The packages use
NodeNext-style `./schema.js` specifiers that point at `.ts` files, and Node
doesn't rewrite those. It also only strips syntax, and we don't want
production to depend on a TS subset rule.

There is one more wrinkle. `loadCommittedPlanTemplates()` (`src/load.ts`)
finds templates with `readdirSync(dirname(import.meta.url) + "/templates")`,
so it depends on its own file location at runtime. Anything that moves or
bundles `load.ts` changes what that path means.

## Options considered

1. **Run the API from source with `tsx` in production** (`CMD ["tsx",
   "apps/api/src/index.ts"]`, or `node --import tsx`). This is the smallest
   change, and `load.ts` works as-is. The downsides: `tsx` (and its esbuild
   service process) becomes a production runtime dependency, every cold start
   transpiles the whole import graph, and module-resolution mistakes still
   only show up at runtime. That last one is the exact class of bug this ADR
   exists to close. The Render free tier spins the service down when idle,
   so cold starts are the normal case, and it caps memory at 512 MB.
2. **Conditional exports: a custom `source` condition → `src`, `default` →
   `dist`, plus a build step per package.** Plain Node would get `dist`, and
   tooling configured with the custom condition (tsconfig `customConditions`,
   Vite/vitest `resolve.conditions`) would get `src`. The costs: two
   resolution paths, where tests and typecheck run against `src` and
   production runs against a separately compiled `dist`. Every tool needs the
   condition wired in, the build must be topologically ordered, and
   `plan-templates`' `cp -r src/templates dist/templates` step has to keep
   working. This reintroduces "built vs. not built" state, which is what
   caused the TS2307 failure in the first place.
3. **Keep source exports, and bundle `apps/api` into a single ESM file with
   esbuild.** Workspace packages are inlined at build time. Third-party
   packages that `apps/api` declares stay external and resolve from
   `node_modules` as they do today. Production still runs plain
   `node apps/api/dist/index.js`.
4. **A build step per package, with no source exports.** This is the
   original setup, and it's what broke fresh-checkout CI. Rejected on
   evidence.

## Decision

**Option 3.** Workspace packages keep exporting TypeScript source
(`types` + `import` → `src/*.ts`), and nothing in `packages/*` is built. The
Node-running consumer compiles them in:

- `apps/api`'s `build` becomes an esbuild bundle of `src/index.ts`, with
  `--bundle --platform=node --format=esm --target=node22 --sourcemap`. The
  output replaces `tsc` emit at the same path, `dist/index.js`.
- Mark as external exactly the packages listed in `apps/api/package.json`'s
  `dependencies`. Use a short `apps/api/build.mjs` that reads them and passes
  them to esbuild's `external` option. Don't use `--packages=external`,
  because that would also externalize `@training-plan/*` and defeat the
  purpose. Everything else, meaning the workspace packages and any transitive
  dependency `apps/api` doesn't declare itself (for example `zod`, unless
  #13 adds it directly), is bundled.
- Use esbuild directly, not tsup. esbuild is already in the lockfile as
  `tsx`'s and Vite's transformer (0.28.x, and allow-listed in
  `pnpm-workspace.yaml`). That means dev (`tsx watch`) and the production
  build transpile with the same engine, and we avoid adding a
  maintenance-mode wrapper for about 15 lines of config. Add `esbuild` as
  an explicit `devDependency` of `apps/api` rather than relying on it
  coming in transitively.
- `tsc --noEmit` stays the type gate, and CI already runs it before `build`.
  esbuild does not typecheck.
- `start` and the `Dockerfile` `CMD` add `--enable-source-maps`, so stack
  traces point at `.ts` lines. Otherwise they are unchanged: `node
  apps/api/dist/index.js`.

**Templates in the API come from `COMMITTED_PLAN_TEMPLATES`**, the root
export built on static JSON imports (`src/committed.ts`), **not from the
`./load` subpath**. esbuild inlines those JSON imports and validates them
through `planTemplateSchema` at module load, so the bundle does no
filesystem I/O and has no path that depends on `import.meta.url`. Web and
API then read templates through one mechanism. `committed.ts`'s file-count
test, which checks that the JSON files on disk match the static imports,
already guards the one place the two can drift (#10, the MCR 10-mile
template). This removes `./load`'s only planned runtime consumer.

### Why this beats the alternatives on a free-tier Render deploy

- **Resolution failures move to build time.** If `apps/api` imports
  something esbuild can't resolve, `docker build` (and CI's `build` step)
  fails. With tsx at runtime, the Render service would start and then crash
  or fail health checks. This is the deciding factor: the TS2307 saga was
  a failure that appeared later than it should have, and this option makes
  that class of failure fail earlier.
- **Cold starts and memory.** The free tier spins down when idle, so most
  first requests are cold starts. Bundling means one pre-transpiled file,
  with no transform hook, no esbuild child process, and no per-module
  transpile at boot. That leaves more of the 512 MB cap for the app.
- **One resolution path.** Unlike option 2, tests, typecheck, dev, and
  production all read the same `src/` files. No `dist/` in `packages/*`
  can go stale, and there's no custom condition for every tool to agree on.
- **No new cost.** The build tooling is free and already installed. The
  image and deploy flow (`render.yaml`, `scripts/deploy-dev.sh`) are
  unchanged. It also carries over to Fly.io later: a single bundled file
  makes a slimmer runtime stage possible without any change here.

### Costs we accept

- `apps/api` owns a small build script instead of plain `tsc` emit.
- Bundled code needs source maps to debug. We mitigate that with
  `--enable-source-maps`.
- If a future bundled dependency is CJS-only and uses `require` or
  `__dirname`, it needs either an esbuild `banner` with `createRequire` or
  to be added to `apps/api`'s `dependencies` so it stays external. We'll
  handle that case by case.
- Any future workspace package that reads files relative to its own
  location, the way `load.ts` does, won't work once bundled. The rule for
  `packages/*` is: **ship data as static imports, not runtime `fs` reads.**

## Consequences

- **Rule for `packages/*`:** exports point at `src/*.ts`. Packages have no
  `build` script and no `dist/`, and they don't depend on runtime
  filesystem layout. Any consumer that runs under plain Node (today only
  `apps/api`) must bundle them in. Native iOS/Android don't import these
  packages. They consume the OpenAPI contract (ADR 0002), so this rule
  doesn't affect them.
- **Follow-up in #13, before `apps/api`'s first workspace import:**
  1. Replace `apps/api`'s `build` script with the esbuild bundle described
     above (`apps/api/build.mjs`), add `esbuild` as a devDependency, and
     add `--enable-source-maps` to `start` and the `Dockerfile` `CMD`.
  2. Add `@training-plan/plan-templates` and `@training-plan/pace-zones` to
     `apps/api`'s `dependencies` (`workspace:*`), and import templates from
     `COMMITTED_PLAN_TEMPLATES`.
  3. Add a CI smoke check: after `build`, run `node apps/api/dist/index.js`
     (or `docker build` plus a boot with `/health`). This proves the
     bundle starts under plain Node, not just that it compiles.
  4. Move the FR7 race-date rule out of `apps/web` and into `packages/`
     when the API starts persisting race dates (this was already flagged in
     the PR #53 review). This ADR makes that move cheap.
- **Cleanup, either in #13 or as a chore:** delete the now-unused `build`
  scripts and `tsconfig.build.json` in `packages/pace-zones` and
  `packages/plan-templates`. Also remove or retire the `./load` subpath and
  `src/load.ts`, keeping it only if a test or repo script still needs it,
  and label it test/tooling-only. Update `packages/plan-templates/README.md`,
  which still describes `./load` as `dist/load.js`.
- **The `Dockerfile` is otherwise already compatible.** The `deps` stage
  copies `packages/` in full, so the bundler can see workspace sources in the
  `build` stage.
- **Revisit** if a workspace package is ever published to a registry, or
  if a second Node-running app appears that can't bundle. In either case,
  option 2 (conditional exports with `default` → `dist`) is the fallback.
