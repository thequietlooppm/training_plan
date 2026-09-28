import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the bug that shipped a broken `/setup` page: the
 * default "." export (`index.ts`) is what `apps/web` imports as the bare
 * `@training-plan/plan-templates` specifier, and it must stay Vite-bundleable
 * for the browser. `load.ts` (and anything that imports it) is Node-only
 * (`node:fs`, `node:path`, `node:url`) and must only be reachable via the
 * dedicated `@training-plan/plan-templates/load` subpath — never from here.
 *
 * This walks the real import graph rooted at `index.ts` (following relative
 * `./*.js` specifiers, which under NodeNext map back to the `.ts` source
 * files) and fails loudly if any file it transitively pulls in imports a
 * `node:` builtin. A previous version of this bug passed typecheck/lint/test/
 * build — Vite only *warns* on externalizing `node:fs` for the browser, so CI
 * stayed green while the page crashed on mount at runtime. This test is a
 * static check, not a browser run, but it catches the specific mistake (a
 * barrel re-export change) that caused the runtime crash, before it ships.
 */

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const NODE_BUILTIN_SPECIFIER_PATTERN = /from\s+["'](node:[a-z/-]+)["']/g;
const RELATIVE_IMPORT_PATTERN = /from\s+["'](\.\/[^"']+)["']/g;

function toSourcePath(specifier: string): string {
  // NodeNext-style relative specifiers point at ".js" but the source is
  // ".ts" — map back for reading during the test.
  return specifier.replace(/\.js$/, ".ts");
}

function collectImportGraph(entryFile: string): Map<string, string> {
  const visited = new Map<string, string>();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || visited.has(file)) continue;

    const contents = readFileSync(path.join(SRC_DIR, file), "utf-8");
    visited.set(file, contents);

    for (const match of contents.matchAll(RELATIVE_IMPORT_PATTERN)) {
      const relativeSpecifier = match[1];
      if (!relativeSpecifier) continue;
      const nextFile = toSourcePath(relativeSpecifier.replace(/^\.\//, ""));
      if (!visited.has(nextFile)) queue.push(nextFile);
    }
  }

  return visited;
}

describe("browser-safe entry point (index.ts)", () => {
  it("never transitively imports a node: builtin", () => {
    const graph = collectImportGraph("index.ts");
    const offenders: Array<{ file: string; specifiers: string[] }> = [];

    for (const [file, contents] of graph) {
      const specifiers = [...contents.matchAll(NODE_BUILTIN_SPECIFIER_PATTERN)]
        .map((match) => match[1])
        .filter((specifier): specifier is string => Boolean(specifier));
      if (specifiers.length > 0) {
        offenders.push({ file, specifiers });
      }
    }

    expect(
      offenders,
      `index.ts's import graph must stay browser-safe (Vite-bundleable). ` +
        `Found node: builtin imports reachable from the default export: ` +
        `${JSON.stringify(offenders)}. If you meant to expose a Node-only ` +
        `helper (e.g. loadCommittedPlanTemplates), add it to the ` +
        `"./load" subpath export in package.json, not to index.ts.`,
    ).toEqual([]);

    // Sanity check the graph traversal itself actually visited something —
    // an empty/broken traversal would make the assertion above vacuous.
    expect(graph.size).toBeGreaterThan(1);
  });

  it("load.ts (the Node-only loader) is reachable only via its own file, not via index.ts", () => {
    const graph = collectImportGraph("index.ts");
    expect(graph.has("load.ts")).toBe(false);
  });
});
