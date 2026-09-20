import Fastify from "fastify";
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

app.get("/health", async () => {
  return { status: "ok" };
});

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
