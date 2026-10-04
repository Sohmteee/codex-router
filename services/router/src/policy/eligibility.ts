import {
  type ModelRecord,
  type Policy,
  type RoutingRequest,
  type RegistrySnapshot,
  ModelRecordSchema,
  PolicySchema,
} from "@codex-router/contracts";

export type ExclusionReason =
  | "wrong_account"
  | "disabled_by_user"
  | "not_verified"
  | "not_active"
  | "tool_support_unknown_or_missing"
  | "image_support_unknown_or_missing"
  | "context_unknown_or_too_small"
  | "effort_unknown";

export type EligibilityCheck =
  | { eligible: true; model: ModelRecord; supportedEfforts: string[] }
  | { eligible: false; modelId: string; reason: ExclusionReason };

export function checkModelEligibility(
  model: ModelRecord,
  request: RoutingRequest,
  policy: Policy,
): EligibilityCheck {
  if (model.accountId !== request.accountId) return { eligible: false, modelId: model.id, reason: "wrong_account" };
  if (!policy.enabledModelIds.includes(model.id) || !model.userEnabled) return { eligible: false, modelId: model.id, reason: "disabled_by_user" };
  if (model.availability !== "verified") return { eligible: false, modelId: model.id, reason: "not_verified" };
  if (model.lifecycle !== "active") return { eligible: false, modelId: model.id, reason: "not_active" };
  const supportsTools = model.capabilities.supportsTools;
  if (request.requirements.tools && (supportsTools.confidence !== "verified" || supportsTools.value !== true)) {
    return { eligible: false, modelId: model.id, reason: "tool_support_unknown_or_missing" };
  }
  const modalities = model.capabilities.inputModalities;
  if (request.requirements.images && (modalities.confidence !== "verified" || !modalities.value?.includes("image"))) {
    return { eligible: false, modelId: model.id, reason: "image_support_unknown_or_missing" };
  }
  const context = model.capabilities.contextTokens;
  if (context.confidence !== "verified" || context.value === null ||
      (request.requirements.minimumContextTokens !== null && context.value < request.requirements.minimumContextTokens)) {
    return { eligible: false, modelId: model.id, reason: "context_unknown_or_too_small" };
  }
  const efforts = model.capabilities.reasoningEfforts;
  if (efforts.confidence !== "verified" || !efforts.value?.length) {
    return { eligible: false, modelId: model.id, reason: "effort_unknown" };
  }
  const allowedEfforts = policy.fallbackEffort === null
    ? efforts.value
    : efforts.value.filter((effort) => effort === policy.fallbackEffort);
  if (!allowedEfforts.length) return { eligible: false, modelId: model.id, reason: "effort_unknown" };
  return { eligible: true, model, supportedEfforts: allowedEfforts };
}

export function eligibleModels(snapshot: RegistrySnapshot, request: RoutingRequest, rawPolicy: Policy): {
  eligible: Array<{ model: ModelRecord; supportedEfforts: string[] }>;
  excluded: Array<{ modelId: string; reason: ExclusionReason }>;
} {
  const policy = PolicySchema.parse(rawPolicy);
  const eligible: Array<{ model: ModelRecord; supportedEfforts: string[] }> = [];
  const excluded: Array<{ modelId: string; reason: ExclusionReason }> = [];
  for (const raw of snapshot.models) {
    const model = ModelRecordSchema.parse(raw);
    const result = checkModelEligibility(model, request, policy);
    if (result.eligible) eligible.push({ model: result.model, supportedEfforts: result.supportedEfforts });
    else excluded.push({ modelId: result.modelId, reason: result.reason });
  }
  return { eligible, excluded };
}

export function chooseFallback<T extends { model: ModelRecord; supportedEfforts: string[] }>(
  candidates: T[],
  policy: Policy,
): T | null {
  const fallback = policy.fallbackModelId;
  if (fallback === null) return null;
  if (!policy.enabledModelIds.includes(fallback)) return null;
  return candidates.find(({ model }) => model.id === fallback && model.userEnabled) ?? null;
}

/** The final check rejects stale Jev and lease choices against live snapshots. */
export function authorizeRoute(args: {
  modelId: string;
  effort: string;
  expectedPolicyRevision: number;
  expectedCatalogRevision: number;
  currentPolicy: Policy;
  currentRegistry: RegistrySnapshot;
  request: RoutingRequest;
}): { ok: true; model: ModelRecord } | {
  ok: false;
  error: "policy_changed" | "catalog_changed" | "model_ineligible" | "effort_ineligible";
} {
  if (args.currentPolicy.revision !== args.expectedPolicyRevision) return { ok: false, error: "policy_changed" };
  if (args.currentRegistry.revision !== args.expectedCatalogRevision) return { ok: false, error: "catalog_changed" };
  const current = args.currentRegistry.models.find(({ id }) => id === args.modelId);
  if (!current) return { ok: false, error: "model_ineligible" };
  const check = checkModelEligibility(current, args.request, args.currentPolicy);
  if (!check.eligible) return { ok: false, error: "model_ineligible" };
  if (!check.supportedEfforts.includes(args.effort)) return { ok: false, error: "effort_ineligible" };
  return { ok: true, model: check.model };
}
