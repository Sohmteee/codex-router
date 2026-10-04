import { mkdtempSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api.js";
import { loadConfig } from "../src/config.js";
import { RouterDatabase } from "../src/storage/database.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("router API", () => {
  it("reports the integration gate and refuses inference before it passes", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const app = createApi(loadConfig({}), db);
    const health = await app.inject({ method: "GET", url: "/health", headers: { origin: "http://tauri.localhost" } });
    expect(health.headers["access-control-allow-origin"]).toBe("http://tauri.localhost");
    const untrusted = await app.inject({ method: "GET", url: "/health", headers: { origin: "https://example.com" } });
    expect(untrusted.headers["access-control-allow-origin"]).toBeUndefined();
    expect(health.json()).toMatchObject({ state: "degraded", compatibilityVerified: false });
    const response = await app.inject({ method: "POST", url: "/v1/responses", payload: {} });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "compatibility_spike_not_passed" } });
    await app.close();
    db.close();
  });

  it("requires the installation token to expose model metadata", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const config = loadConfig({ CODEX_ROUTER_LOCAL_TOKEN: "x".repeat(32) });
    const app = createApi(config, db);
    expect((await app.inject({ method: "GET", url: "/v1/models" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/models", headers: { "x-codex-router-token": config.localToken } })).statusCode).toBe(200);
    await app.close();
    db.close();
  });

  it("keeps health degraded when compatibility forwarding is enabled for a probe", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const config = loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true" });
    const app = createApi(config, db, vi.fn());
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json()).toMatchObject({ state: "degraded", compatibilityVerified: false });
    expect(() => loadConfig({ NODE_ENV: "production", CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true" })).toThrow("unavailable in production");
    await app.close();
    db.close();
  });

  it("forwards authorized compatibility requests and preserves fragmented SSE", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const token = "t".repeat(32);
    const config = loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true", CODEX_ROUTER_LOCAL_TOKEN: token });
    const sseChunks = ["event: response.created\r\n", "data: {\"type\":\"response.completed\"}\n\n", "data: [DONE]\n\n"];
    const expectedSse = sseChunks.join("");
    const chunks = [...sseChunks];
    const encoder = new TextEncoder();
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const upstreamFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = chunks.shift();
          if (chunk === undefined) controller.close();
          else controller.enqueue(encoder.encode(chunk));
        },
      }), { status: 200, headers: { "content-type": "text/event-stream", "x-request-id": "fixture-request" } });
    };
    const app = createApi(config, db, upstreamFetch);
    const payload = { model: "fixture-model", input: "short compatibility probe", stream: true };
    const response = await app.inject({
      method: "POST",
      url: "/v1/responses?include=reasoning.encrypted_content",
      payload,
      headers: {
        authorization: "Bearer codex-session-token",
        "x-codex-router-token": token,
        "chatgpt-account-id": "fixture-account",
        "openai-beta": "responses=experimental",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toBe(expectedSse);
    expect(capturedUrl).toBe("https://api.openai.com/v1/responses?include=reasoning.encrypted_content");
    const forwardedHeaders = new Headers(capturedInit?.headers);
    expect(forwardedHeaders.get("authorization")).toBe("Bearer codex-session-token");
    expect(forwardedHeaders.get("content-type")).toBe("application/json");
    expect(forwardedHeaders.get("openai-beta")).toBe("responses=experimental");
    expect(forwardedHeaders.get("chatgpt-account-id")).toBe("fixture-account");
    expect(forwardedHeaders.has("x-codex-router-token")).toBe(false);
    expect(Buffer.from(capturedInit?.body as Uint8Array).toString("utf8")).toBe(JSON.stringify(payload));
    await app.close();
    db.close();
  });

  it("rejects compatibility forwarding without local and Codex credentials", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const token = "t".repeat(32);
    const upstreamFetch = vi.fn<typeof fetch>();
    const app = createApi(loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true", CODEX_ROUTER_LOCAL_TOKEN: token }), db, upstreamFetch);
    const noLocalToken = await app.inject({ method: "POST", url: "/v1/responses", payload: {}, headers: { authorization: "Bearer codex-session-token" } });
    const noBearer = await app.inject({ method: "POST", url: "/v1/responses", payload: {}, headers: { "x-codex-router-token": token } });
    expect(noLocalToken.statusCode).toBe(401);
    expect(noBearer.statusCode).toBe(401);
    expect(upstreamFetch).not.toHaveBeenCalled();
    await app.close();
    db.close();
  });

  it("does not retry a failed upstream request", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const token = "t".repeat(32);
    const upstreamFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("private transport detail"));
    const app = createApi(loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true", CODEX_ROUTER_LOCAL_TOKEN: token }), db, upstreamFetch);
    const response = await app.inject({
      method: "POST", url: "/v1/responses", payload: { input: "never logged" },
      headers: { authorization: "Bearer codex-session-token", "x-codex-router-token": token },
    });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("private transport detail");
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    await app.close();
    db.close();
  });

  it("aborts the upstream stream when the Codex client cancels", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const token = "t".repeat(32);
    let upstreamSignal: AbortSignal | undefined;
    const encoder = new TextEncoder();
    const upstreamFetch = vi.fn<typeof fetch>(async (_input, init) => {
      upstreamSignal = init?.signal as AbortSignal;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(encoder.encode("data: {\"type\":\"response.created\"}\n\n")); },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const app = createApi(loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true", CODEX_ROUTER_LOCAL_TOKEN: token }), db, upstreamFetch);
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(new URL("/v1/responses", origin), {
        method: "POST",
        headers: { authorization: "Bearer codex-session-token", "x-codex-router-token": token, "content-type": "application/json" },
        body: JSON.stringify({ input: "cancel test", stream: true }),
        signal: controller.signal,
      });
      reader = response.body?.getReader();
      expect(reader).toBeDefined();
      await reader?.read();
      controller.abort();
      try { await reader?.read(); } catch { /* the client abort intentionally terminates the stream */ }
      for (let attempt = 0; attempt < 20 && !upstreamSignal?.aborted; attempt++) await delay(25);
      expect(upstreamSignal?.aborted).toBe(true);
      expect(upstreamFetch).toHaveBeenCalledTimes(1);
    } finally {
      controller.abort();
      await reader?.cancel().catch(() => undefined);
      await app.close();
      db.close();
    }
  });

  it("does not retry after an upstream stream has begun", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "codex-router-api-"));
    directories.push(directory);
    const db = new RouterDatabase(path.join(directory, "router.db"));
    const token = "t".repeat(32);
    const encoder = new TextEncoder();
    let endPartialStream: (() => void) | undefined;
    const errorGate = new Promise<void>((resolve) => { endPartialStream = resolve; });
    const upstreamFetch = vi.fn<typeof fetch>(async () => {
      let pulls = 0;
      return new Response(new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (pulls++ === 0) controller.enqueue(encoder.encode("data: {\"type\":\"response.created\"}\n\n"));
          else {
            await errorGate;
            controller.error(new Error("private partial-stream detail"));
          }
        },
      }), { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    const app = createApi(loadConfig({ CODEX_ROUTER_COMPATIBILITY_TEST_MODE: "true", CODEX_ROUTER_LOCAL_TOKEN: token }), db, upstreamFetch);
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(new URL("/v1/responses", origin), {
        method: "POST",
        headers: { authorization: "Bearer codex-session-token", "x-codex-router-token": token, "content-type": "application/json" },
        body: JSON.stringify({ input: "partial failure test", stream: true }),
      });
      reader = response.body?.getReader();
      const first = await reader?.read();
      expect(new TextDecoder().decode(first?.value)).toContain("response.created");
      endPartialStream?.();
      try { await reader?.read(); } catch { /* upstream ended after emitting a partial response */ }
      expect(upstreamFetch).toHaveBeenCalledTimes(1);
    } finally {
      endPartialStream?.();
      await reader?.cancel().catch(() => undefined);
      await app.close();
      db.close();
    }
  });
});
