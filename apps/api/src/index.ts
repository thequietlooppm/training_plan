import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

// Local dev origin for apps/web (Vite default). Scoped narrowly per the
// plan — this only needs to unblock the cross-app health-check fetch, not
// serve as a general CORS policy.
const WEB_DEV_ORIGIN = process.env.WEB_DEV_ORIGIN ?? "http://localhost:5173";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: [WEB_DEV_ORIGIN],
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

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
