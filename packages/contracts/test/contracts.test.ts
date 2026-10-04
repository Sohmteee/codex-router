import { describe, expect, it } from "vitest";
import { JevResponseSchema, ModelRecordSchema, RoutingRequestSchema } from "../src/index.js";

const now = "2026-10-04T00:00:00.000Z";

describe("protocol contracts", () => {
  it("requires newly discovered models to state their disabled default", () => {
    const result = ModelRecordSchema.safeParse({
      accountId: "acct-a", id: "new-model", displayName: "New model", visibility: "list",
      availability: "listed", userEnabled: false, userPreferred: false, lifecycle: "unknown",
      capabilities: {
        inputModalities: { value: ["text"], source: "account catalog", checkedAt: now, confidence: "reported" },
        supportsTools: { value: null, source: "", checkedAt: null, confidence: "unknown" },
        supportsStreaming: { value: null, source: "", checkedAt: null, confidence: "unknown" },
        contextTokens: { value: null, source: "", checkedAt: null, confidence: "unknown" },
        reasoningEfforts: { value: null, source: "", checkedAt: null, confidence: "unknown" },
        responsesCompatibility: { value: null, source: "", checkedAt: null, confidence: "unknown" },
      },
      discoveredAt: now, lastSeenAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("rejects Jev results that contain only a model guess", () => {
    expect(JevResponseSchema.safeParse({ ok: true, requestId: crypto.randomUUID(), modelId: "x" }).success).toBe(false);
  });

  it("bounds the candidate set and requires current account revisions", () => {
    const result = RoutingRequestSchema.safeParse({
      requestId: crypto.randomUUID(), accountId: "acct", policyRevision: 1, catalogRevision: 1,
      task: { stage: "implementation", objective: "Implement", recentIntent: null, toolErrorSummary: null, recoveryAttempt: 0 },
      requirements: { tools: true, images: false, minimumContextTokens: null },
      candidates: Array.from({ length: 256 }, (_, i) => ({
        id: `model-${i}`, displayName: `Model ${i}`, supportedEfforts: ["low"], supportsTools: true,
        supportsImages: false, contextTokens: 1000, capabilitySummary: "text + tools",
      })),
      quota: { status: "unavailable", remainingPercent: null }, previousModelId: null,
    });
    expect(result.success).toBe(false);
  });
});
