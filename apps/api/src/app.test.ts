import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

describe("buildApp", () => {
  it("responds to GET /health with { status: \"ok\" }", async () => {
    const app = await buildApp({ logger: false });

    try {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await app.close();
    }
  });
});

describe("buildApp — CORS (WEB_APP_ORIGIN)", () => {
  const ORIGINAL_ENV = process.env.WEB_APP_ORIGIN;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.WEB_APP_ORIGIN;
    } else {
      process.env.WEB_APP_ORIGIN = ORIGINAL_ENV;
    }
    vi.resetModules();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("allows the default localhost origin when WEB_APP_ORIGIN is unset", async () => {
    delete process.env.WEB_APP_ORIGIN;
    const { buildApp: build } = await import("./app.js");
    const app = await build({ logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:5173" },
      });

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:5173",
      );
    } finally {
      await app.close();
    }
  });

  it("allows every origin in a comma-separated WEB_APP_ORIGIN list", async () => {
    process.env.WEB_APP_ORIGIN =
      "http://localhost:5173,https://training-plan-web-dev.pages.dev";
    const { buildApp: build } = await import("./app.js");
    const app = await build({ logger: false });

    try {
      const localResponse = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:5173" },
      });
      const deployedResponse = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://training-plan-web-dev.pages.dev" },
      });

      expect(localResponse.headers["access-control-allow-origin"]).toBe(
        "http://localhost:5173",
      );
      expect(deployedResponse.headers["access-control-allow-origin"]).toBe(
        "https://training-plan-web-dev.pages.dev",
      );
    } finally {
      await app.close();
    }
  });

  it("does not reflect an origin outside the allow-list", async () => {
    process.env.WEB_APP_ORIGIN = "https://training-plan-web-dev.pages.dev";
    const { buildApp: build } = await import("./app.js");
    const app = await build({ logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://evil.example" },
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
