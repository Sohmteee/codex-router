import Fastify from "fastify";
import cors from "@fastify/cors";
import { RouterDatabase } from "./storage/database.js";
import type { RouterConfig } from "./config.js";
import { timingSafeEqual } from "node:crypto";

export function createApi(config: RouterConfig, database: RouterDatabase) {
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024 * 1024,
    disableRequestLogging: true,
    requestIdHeader: false,
    genReqId: () => crypto.randomUUID(),
  });

  void app.register(cors, {
    origin: ["http://127.0.0.1:1420", "http://localhost:1420", "http://tauri.localhost", "https://tauri.localhost"],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "x-codex-router-token"],
    credentials: false,
  });

  app.get("/health", async () => ({
    state: "degraded",
    service: "codex-router",
    version: "0.1.0",
    compatibilityVerified: config.CODEX_ROUTER_COMPATIBILITY_PASSED === "true",
    accountState: "disconnected",
    lastError: config.CODEX_ROUTER_COMPATIBILITY_PASSED === "true" ? null : "compatibility_spike_not_passed",
  }));

  app.get("/control/v1/policy", async () => database.getPolicy());

  app.get("/control/v1/registry", async () => ({
    accountId: null,
    revision: 0,
    refreshedAt: null,
    models: [],
    status: "disconnected",
  }));

  app.get("/control/v1/quota", async () => ({
    accountId: null,
    readAt: null,
    windows: [],
    status: "unavailable",
    errorCode: "account_not_connected",
  }));

  app.post("/v1/responses", async (_request, reply) => {
    return reply.code(503).send({
      error: {
        type: "server_error",
        code: "compatibility_spike_not_passed",
        message: "Inference routing is disabled until account, Desktop, streaming, and continuation checks pass.",
      },
    });
  });

  app.get("/v1/models", async (request, reply) => {
    if (!authorized(request.headers["x-codex-router-token"], config.localToken)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return { object: "list", data: [] };
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ code: error.code }, "request failed");
    void reply.code(error.statusCode ?? 500).send({
      error: { type: "server_error", code: "request_failed", message: "The local router could not complete this request." },
    });
  });

  return app;
}

function authorized(header: string | string[] | undefined, expected: string): boolean {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
