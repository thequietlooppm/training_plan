import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

// Origin(s) for apps/web allowed by CORS — a comma-separated list so local
// dev (Vite default) and a real deployed web origin can both be allowed at
// once, without flipping this back and forth between the two. Scoped
// narrowly per the plan — this only needs to unblock the cross-app
// health-check fetch, not serve as a general CORS policy.
const WEB_APP_ORIGIN = (process.env.WEB_APP_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

/**
 * Builds and configures the Fastify instance (CORS, error handler, routes)
 * without starting a listener, so it's importable and testable (e.g. via
 * `.inject()`) without binding a real port. `src/index.ts` is the thin
 * entrypoint that calls `.listen()` on the instance this returns.
 */
export async function buildApp(
  opts: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  await app.register(cors, {
    origin: WEB_APP_ORIGIN,
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    request.log.error(error);
    void reply.status(statusCode).send({
      code: error.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
      message: statusCode >= 500 ? "Internal server error" : error.message,
    });
  });

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: { status: { const: "ok" } },
          },
        },
      },
    },
    async () => {
      return { status: "ok" as const };
    },
  );

  return app;
}
