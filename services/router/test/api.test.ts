import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
});
