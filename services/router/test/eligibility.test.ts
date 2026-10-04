import { describe, expect, it } from "vitest";
import { authorizeRoute, checkModelEligibility, chooseFallback } from "../src/policy/eligibility.js";
import type { ModelRecord, Policy, RegistrySnapshot, RoutingRequest } from "@codex-router/contracts";

const checkedAt = "2026-10-04T00:00:00.000Z";
const evidence = <T,>(value: T, confidence: "verified" | "unknown" = "verified") => ({ value, source: "fixture", checkedAt, confidence });

const model = (overrides: Partial<ModelRecord> = {}): ModelRecord => ({
  accountId: "acct-a", id: "model-a", displayName: "Model A", visibility: "list",
  availability: "verified", userEnabled: true, userPreferred: false, lifecycle: "active",
  capabilities: {
    inputModalities: evidence(["text", "image"]),
    supportsTools: evidence(true), supportsStreaming: evidence(true), contextTokens: evidence(64_000),
    reasoningEfforts: evidence(["low", "medium", "high"]), responsesCompatibility: evidence(true),
  }, discoveredAt: checkedAt, lastSeenAt: checkedAt, ...overrides,
});

const policy: Policy = {
  revision: 2, enabledModelIds: ["model-a"], fallbackModelId: "model-a", fallbackEffort: null,
  qualityPreference: 0.8,
  quotaBands: [
    { maxRemainingPercent: 50, pressure: "mild" },
    { maxRemainingPercent: 20, pressure: "strong" },
    { maxRemainingPercent: 5, pressure: "severe" },
    { maxRemainingPercent: 1, pressure: "conservation" },
  ], maximumLeaseMs: 300_000,
};

const request: RoutingRequest = {
  requestId: "00000000-0000-4000-8000-000000000001", accountId: "acct-a", policyRevision: 2, catalogRevision: 3,
  task: { stage: "implementation", objective: "Fix the route", recentIntent: null, toolErrorSummary: null, recoveryAttempt: 0 },
  requirements: { tools: true, images: false, minimumContextTokens: 20_000 },
  candidates: [{ id: "model-a", displayName: "Model A", supportedEfforts: ["low", "medium", "high"], supportsTools: true,
    supportsImages: true, contextTokens: 64_000, capabilitySummary: "text and tools" }],
  quota: { status: "unavailable", remainingPercent: null }, previousModelId: null,
};

describe("route authorization", () => {
  it("rejects disabled models regardless of fallback preference", () => {
    const disabled = model({ userEnabled: false });
    expect(checkModelEligibility(disabled, request, policy)).toMatchObject({ eligible: false, reason: "disabled_by_user" });
    expect(chooseFallback([{ model: disabled, supportedEfforts: ["low"] }], policy)).toBeNull();
  });

  it("rejects unknown capability evidence", () => {
    const unknownTools = model({ capabilities: { ...model().capabilities, supportsTools: evidence(null, "unknown") } });
    expect(checkModelEligibility(unknownTools, request, policy)).toMatchObject({ eligible: false, reason: "tool_support_unknown_or_missing" });
  });

  it("rejects stale policy and catalog revisions before dispatch", () => {
    const record = model();
    const snapshot: RegistrySnapshot = { accountId: "acct-a", revision: 3, refreshedAt: checkedAt, models: [record] };
    expect(authorizeRoute({ modelId: record.id, effort: "low", expectedPolicyRevision: 1,
      expectedCatalogRevision: 3, currentPolicy: policy, currentRegistry: snapshot, request }))
      .toEqual({ ok: false, error: "policy_changed" });
    expect(authorizeRoute({ modelId: record.id, effort: "low", expectedPolicyRevision: 2,
      expectedCatalogRevision: 1, currentPolicy: policy, currentRegistry: snapshot, request }))
      .toEqual({ ok: false, error: "catalog_changed" });
  });

  it("requires the user's fallback to remain eligible", () => {
    expect(chooseFallback([{ model: model({ id: "other" }), supportedEfforts: ["low"] }], policy)).toBeNull();
  });
});
