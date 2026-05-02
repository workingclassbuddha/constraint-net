import type { MemoryStore } from "./memoryStore.js";
import type { PlannedPath, SearchQuery, StoredAction } from "./types.js";

const RETURN_PICKUP_PATH = ["return.check_eligibility", "return.create", "pickup.schedule"];

export function planCoherentPath(store: MemoryStore, query: SearchQuery): PlannedPath {
  const actions = store.listActions();
  const merchant = query.constraints.merchant;
  const riskTiers = new Set(query.constraints.risk_tiers_allowed ?? [0, 1, 2]);

  const pathActions = RETURN_PICKUP_PATH
    .map((stableId) => actions.find((action) => action.stable_id === stableId))
    .filter((action): action is StoredAction => Boolean(action));

  const eligible = pathActions.filter((action) => {
    if (merchant && action.publisher_domain !== merchant) return false;
    if (!riskTiers.has(action.risk.tier)) return false;
    if (query.constraints.requires_reversible && action.risk.tier === 2 && !action.reversibility.reversible) return false;
    return true;
  });

  if (eligible.length !== RETURN_PICKUP_PATH.length) {
    return {
      status: "no_policy_allowed_path",
      path_id: "path_none",
      coherence_score: 0,
      steps: [],
      why_coherent: []
    };
  }

  const coherenceScore = scorePath(eligible, query);

  return {
    status: "coherent_path_found",
    path_id: "path_soundmart_return_pickup",
    coherence_score: coherenceScore,
    steps: eligible.map((action) => ({
      action_id: action.id,
      stable_id: action.stable_id,
      manifest_digest: action.manifest_digest,
      risk_tier: action.risk.tier,
      confirmation_required: action.confirmation.required
    })),
    why_coherent: [
      "Matches merchant",
      "Checks eligibility before side effects",
      "Return creation precedes pickup scheduling",
      "Tier 2 steps require confirmation",
      "Both side effects are reversible",
      "Every step can produce receipts"
    ]
  };
}

function scorePath(actions: StoredAction[], query: SearchQuery): number {
  const goal = query.goal.toLowerCase();
  const intentAlignment = goal.includes("return") && goal.includes("pickup") ? 1 : 0.65;
  const schemaCompleteness = actions.every((action) => action.input_schema.required?.length) ? 1 : 0.6;
  const policyConsistency = actions.every((action) => (query.constraints.risk_tiers_allowed ?? [0, 1, 2]).includes(action.risk.tier)) ? 1 : 0;
  const reversibilityConsistency = actions.every((action) => action.risk.tier < 2 || action.reversibility.reversible) ? 1 : 0.4;
  const trustConsistency = actions.every((action) => action.manifest_digest.startsWith("sha256-")) ? 0.95 : 0.4;
  const temporalConsistency = isOrdered(actions.map((action) => action.stable_id), RETURN_PICKUP_PATH) ? 1 : 0.3;
  const receiptConsistency = actions.every((action) => action.execution.length > 0) ? 1 : 0.5;
  const pathSimplicity = actions.length === 3 ? 1 : 0.7;
  const contradictionPenalty = actions.some((action) => action.risk.tier === 2 && !action.confirmation.required) ? 1 : 0;

  const score =
    0.25 * intentAlignment +
    0.15 * schemaCompleteness +
    0.15 * policyConsistency +
    0.12 * reversibilityConsistency +
    0.1 * trustConsistency +
    0.08 * temporalConsistency +
    0.08 * receiptConsistency +
    0.07 * pathSimplicity -
    0.2 * contradictionPenalty;

  return Number(score.toFixed(3));
}

function isOrdered(actual: string[], expected: string[]): boolean {
  return actual.every((item, index) => item === expected[index]);
}
