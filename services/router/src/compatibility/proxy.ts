import { timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RouterConfig } from "../config.js";

const OPENAI_ORIGIN = "https://api.openai.com";
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "chatgpt-account-id",
  "content-type",
  "openai-beta",
  "openai-organization",
  "openai-project",
  "originator",
  "x-client-request-id",
] as const;
const FORWARDED_RESPONSE_HEADERS = ["cache-control", "content-type", "openai-version", "x-request-id"] as const;

export async function forwardCompatibilityRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  config: RouterConfig,
  upstreamFetch: typeof fetch = fetch,
): Promise<void> {
  if (config.CODEX_ROUTER_COMPATIBILITY_TEST_MODE !== "true") {
    void reply.code(503).send({
      error: {
        type: "server_error",
        code: "compatibility_spike_not_passed",
        message: "Inference routing is disabled until the compatibility spike passes.",
      },
    });
    return;
  }

  if (!authorized(request.headers["x-codex-router-token"], config.localToken)) {
    void reply.code(401).send({ error: { type: "authentication_error", code: "router_unauthorized", message: "The local router credential is missing or invalid." } });
    return;
  }

  const authorization = request.headers.authorization;
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    void reply.code(401).send({ error: { type: "authentication_error", code: "upstream_auth_missing", message: "The Codex provider did not supply an authorization credential." } });
    return;
  }

  const method = request.method;
  const incomingUrl = new URL(request.url, "http://127.0.0.1");
  const targetPath = incomingUrl.pathname;
  if (!((method === "POST" && targetPath === "/v1/responses") || (method === "GET" && targetPath === "/v1/models"))) {
    void reply.code(404).send({ error: { type: "invalid_request_error", code: "compatibility_route_not_found", message: "The compatibility endpoint does not support this route." } });
    return;
  }

  const headers = new Headers({ authorization });
  for (const header of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers[header];
    if (typeof value === "string") headers.set(header, value);
  }

  const controller = new AbortController();
  const abortWhenClientLeaves = () => {
    if (!reply.raw.writableEnded) controller.abort(new Error("Codex client disconnected."));
  };
  request.raw.once("aborted", abortWhenClientLeaves);
  reply.raw.once("close", abortWhenClientLeaves);

  try {
    const body = method === "POST" && Buffer.isBuffer(request.body) ? request.body : undefined;
    if (method === "POST" && !body) {
      void reply.code(400).send({ error: { type: "invalid_request_error", code: "invalid_compatibility_body", message: "A JSON request body is required." } });
      return;
    }

    const requestInit: RequestInit = {
      method,
      headers,
      redirect: "error",
      signal: controller.signal,
    };
    if (body) {
      const bodyCopy = new Uint8Array(body.byteLength);
      bodyCopy.set(body);
      requestInit.body = bodyCopy;
    }
    const upstream = await upstreamFetch(new URL(`${targetPath}${incomingUrl.search}`, OPENAI_ORIGIN), requestInit);

    reply.hijack();
    reply.raw.statusCode = upstream.status;
    for (const header of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) reply.raw.setHeader(header, value);
    }
    reply.raw.setHeader("x-content-type-options", "nosniff");
    reply.raw.flushHeaders();

    if (!upstream.body) {
      reply.raw.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream), reply.raw, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || reply.raw.destroyed) return;

    if (!reply.raw.headersSent) {
      void reply.code(502).send({ error: { type: "server_error", code: "compatibility_upstream_unavailable", message: "The upstream Responses service could not be reached." } });
      return;
    }

    // Once response bytes have started, close the stream. Retrying here could duplicate output or tool calls.
    reply.raw.destroy(error instanceof Error ? error : undefined);
  } finally {
    request.raw.off("aborted", abortWhenClientLeaves);
    reply.raw.off("close", abortWhenClientLeaves);
  }
}

function authorized(header: string | string[] | undefined, expected: string): boolean {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
