import { z } from "zod";

export const ModelIdSchema = z.string().min(1).max(256);
export const AccountIdSchema = z.string().min(1).max(256);
export const RevisionSchema = z.number().int().nonnegative();
export const EvidenceConfidenceSchema = z.enum(["verified", "reported", "estimated", "unknown"]);

export const EvidenceSchema = <T extends z.ZodType>(value: T) => z.object({
  value: value.nullable(),
  source: z.string().max(512),
  checkedAt: z.iso.datetime().nullable(),
  confidence: EvidenceConfidenceSchema,
});

export const CapabilitySchema = z.object({
  inputModalities: EvidenceSchema(z.array(z.enum(["text", "image", "file", "audio", "video"]))),
  supportsTools: EvidenceSchema(z.boolean()),
  supportsStreaming: EvidenceSchema(z.boolean()),
  contextTokens: EvidenceSchema(z.number().int().positive()),
  reasoningEfforts: EvidenceSchema(z.array(z.string().min(1).max(64))),
  responsesCompatibility: EvidenceSchema(z.boolean()),
});

export const ModelRecordSchema = z.object({
  accountId: AccountIdSchema,
  id: ModelIdSchema,
  displayName: z.string().min(1).max(256),
  visibility: z.string().nullable(),
  availability: z.enum(["listed", "verified", "unavailable", "unknown"]),
  userEnabled: z.boolean(),
  userPreferred: z.boolean(),
  lifecycle: z.enum(["active", "deprecated", "shutdown", "unknown"]),
  capabilities: CapabilitySchema,
  discoveredAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
});

export const RegistrySnapshotSchema = z.object({
  accountId: AccountIdSchema,
  revision: RevisionSchema,
  refreshedAt: z.iso.datetime(),
  models: z.array(ModelRecordSchema),
});

export const QuotaWindowSchema = z.object({
  limitId: z.string().min(1),
  limitName: z.string().nullable(),
  usedPercent: z.number().finite().min(0).max(100),
  windowDurationMins: z.number().int().positive().nullable(),
  resetsAt: z.number().int().positive().nullable(),
});

export const QuotaSnapshotSchema = z.object({
  accountId: AccountIdSchema,
  readAt: z.iso.datetime(),
  windows: z.array(QuotaWindowSchema),
  status: z.enum(["available", "unavailable", "stale"]),
  errorCode: z.string().max(128).nullable(),
});

export const LeaseKindSchema = z.enum(["one_call", "tool_chain", "user_turn"]);
export const TaskStageSchema = z.enum([
  "discovery", "planning", "architecture", "implementation", "debugging",
  "tests", "visual_work", "review", "security_review", "explanation", "unknown",
]);

export const RouteRequirementsSchema = z.object({
  tools: z.boolean(),
  images: z.boolean(),
  minimumContextTokens: z.number().int().positive().nullable(),
});

export const RouteCandidateSchema = z.object({
  id: ModelIdSchema,
  displayName: z.string().min(1),
  supportedEfforts: z.array(z.string().min(1).max(64)).min(1),
  supportsTools: z.literal(true),
  supportsImages: z.boolean(),
  contextTokens: z.number().int().positive(),
  capabilitySummary: z.string().max(320),
});

export const RoutingRequestSchema = z.object({
  requestId: z.uuid(),
  accountId: AccountIdSchema,
  policyRevision: RevisionSchema,
  catalogRevision: RevisionSchema,
  task: z.object({
    stage: TaskStageSchema,
    objective: z.string().max(8_000),
    recentIntent: z.string().max(2_000).nullable(),
    toolErrorSummary: z.string().max(2_000).nullable(),
    recoveryAttempt: z.number().int().nonnegative(),
  }),
  requirements: RouteRequirementsSchema,
  candidates: z.array(RouteCandidateSchema).min(1).max(255),
  quota: z.object({
    status: z.enum(["available", "unavailable", "stale"]),
    remainingPercent: z.number().min(0).max(100).nullable(),
  }),
  previousModelId: ModelIdSchema.nullable(),
});

export const RouteRecommendationSchema = z.object({
  requestId: z.uuid(),
  accountId: AccountIdSchema,
  policyRevision: RevisionSchema,
  catalogRevision: RevisionSchema,
  modelId: ModelIdSchema,
  reasoningEffort: z.string().min(1).max(64),
  lease: LeaseKindSchema,
  confidence: z.number().min(0).max(1).nullable(),
  source: z.enum(["jev", "deterministic_fallback", "lease"]),
  reasonCode: z.string().min(1).max(128),
  createdAt: z.iso.datetime(),
});

export const AuthorizedRouteSchema = RouteRecommendationSchema.extend({
  authorizedAt: z.iso.datetime(),
  authorizedPolicyRevision: RevisionSchema,
  authorizedCatalogRevision: RevisionSchema,
});

export const PolicySchema = z.object({
  revision: RevisionSchema,
  enabledModelIds: z.array(ModelIdSchema),
  fallbackModelId: ModelIdSchema.nullable(),
  fallbackEffort: z.string().min(1).max(64).nullable(),
  qualityPreference: z.number().min(0).max(1),
  quotaBands: z.array(z.object({
    maxRemainingPercent: z.number().min(0).max(100),
    pressure: z.enum(["normal", "mild", "strong", "severe", "conservation"]),
  })).min(1).max(16),
  maximumLeaseMs: z.number().int().min(0).max(300_000),
});

export const JevRequestSchema = z.object({
  protocolVersion: z.literal(1),
  request: RoutingRequestSchema,
});

export const JevResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    requestId: z.uuid(),
    modelId: ModelIdSchema,
    reasoningEffort: z.string().min(1).max(64),
    lease: LeaseKindSchema,
    confidence: z.number().min(0).max(1).nullable(),
  }),
  z.object({
    ok: z.literal(false),
    requestId: z.uuid(),
    errorCode: z.enum(["unavailable", "invalid_request", "invalid_response", "timeout"]),
  }),
]);

export const ControlRequestSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("health.read") }),
  z.object({ command: z.literal("registry.read") }),
  z.object({ command: z.literal("quota.read") }),
  z.object({ command: z.literal("policy.read") }),
  z.object({ command: z.literal("models.refresh"), expectedRevision: RevisionSchema.optional() }),
  z.object({
    command: z.literal("models.setEnabled"),
    modelId: ModelIdSchema,
    enabled: z.boolean(),
    expectedRevision: RevisionSchema,
  }),
  z.object({
    command: z.literal("policy.setFallback"),
    modelId: ModelIdSchema.nullable(),
    expectedRevision: RevisionSchema,
  }),
  z.object({ command: z.literal("router.stop"), drainMs: z.number().int().min(0).max(30_000) }),
]);

export const ControlEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("health.updated"), state: z.enum(["starting", "ready", "degraded", "stopped"]) }),
  z.object({ type: z.literal("registry.updated"), accountId: AccountIdSchema, revision: RevisionSchema }),
  z.object({ type: z.literal("quota.updated"), accountId: AccountIdSchema, readAt: z.iso.datetime() }),
  z.object({ type: z.literal("route.decided"), route: AuthorizedRouteSchema }),
  z.object({ type: z.literal("route.failed"), requestId: z.uuid(), errorCode: z.string().max(128) }),
]);

export type ModelRecord = z.infer<typeof ModelRecordSchema>;
export type RegistrySnapshot = z.infer<typeof RegistrySnapshotSchema>;
export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;
export type RoutingRequest = z.infer<typeof RoutingRequestSchema>;
export type RouteRecommendation = z.infer<typeof RouteRecommendationSchema>;
export type AuthorizedRoute = z.infer<typeof AuthorizedRouteSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type JevRequest = z.infer<typeof JevRequestSchema>;
export type JevResponse = z.infer<typeof JevResponseSchema>;
export type ControlRequest = z.infer<typeof ControlRequestSchema>;
export type ControlEvent = z.infer<typeof ControlEventSchema>;

export function exportProtocolSchemas(): Record<string, unknown> {
  return {
    protocolVersion: 1,
    modelRecord: z.toJSONSchema(ModelRecordSchema),
    registrySnapshot: z.toJSONSchema(RegistrySnapshotSchema),
    quotaSnapshot: z.toJSONSchema(QuotaSnapshotSchema),
    routingRequest: z.toJSONSchema(RoutingRequestSchema),
    routeRecommendation: z.toJSONSchema(RouteRecommendationSchema),
    policy: z.toJSONSchema(PolicySchema),
    jevRequest: z.toJSONSchema(JevRequestSchema),
    jevResponse: z.toJSONSchema(JevResponseSchema),
  };
}
