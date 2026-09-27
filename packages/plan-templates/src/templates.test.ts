import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { planTemplateSchema } from "./schema.js";

const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

const FILENAME_VERSION_PATTERN = /^(?<templateId>.+)\.v(?<version>\d+)\.json$/;

function readTemplateFile(filename: string): unknown {
  const raw = readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

// Scans src/templates/ directly (rather than a hand-maintained list) so this
// test automatically covers every future template file (e.g. #10's
// ten-mile template) without needing an edit here.
const templateFiles = readdirSync(TEMPLATES_DIR).filter((filename) =>
  filename.endsWith(".json"),
);

describe("committed plan templates", () => {
  it("has at least one committed template file", () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  it.each(templateFiles)("%s: schema.parse() succeeds", (filename) => {
    const raw = readTemplateFile(filename);

    // A real throw on structural error, not safeParse — a template that
    // fails to parse should fail the test loudly.
    expect(() => planTemplateSchema.parse(raw)).not.toThrow();
  });

  it.each(templateFiles)(
    "%s: filename version matches the internal templateVersion field",
    (filename) => {
      const match = FILENAME_VERSION_PATTERN.exec(filename);
      expect(
        match,
        `filename '${filename}' must match <templateId>.v<N>.json`,
      ).not.toBeNull();

      const template = planTemplateSchema.parse(readTemplateFile(filename));
      expect(template.templateVersion).toBe(Number(match?.groups?.version));
    },
  );

  it.each(templateFiles)(
    "%s: filename templateId matches the internal templateId field",
    (filename) => {
      const match = FILENAME_VERSION_PATTERN.exec(filename);
      expect(
        match,
        `filename '${filename}' must match <templateId>.v<N>.json`,
      ).not.toBeNull();

      const template = planTemplateSchema.parse(readTemplateFile(filename));
      expect(template.templateId).toBe(match?.groups?.templateId);
    },
  );

  it("has unique templateId+templateVersion pairs across all committed template files", () => {
    const pairs = templateFiles.map((filename) => {
      const template = planTemplateSchema.parse(readTemplateFile(filename));
      return `${template.templateId}@${template.templateVersion}`;
    });

    expect(new Set(pairs).size).toBe(pairs.length);
  });
});
