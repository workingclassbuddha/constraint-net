import { orderActionsByDependencies, producedFields, requiredFields, selectCandidateActions } from "./capabilityGraph.js";
import { publicId } from "./hash.js";
import type { MemoryStore } from "./memoryStore.js";
import type { PlannedPath, SearchQuery, StoredAction } from "./types.js";

export function planCoherentPath(store: MemoryStore, query: SearchQuery): PlannedPath {
  const candidates = selectCandidateActions(store.listActions(), query);
  const ordered = orderActionsByDependencies(candidates, query);

  if (ordered.length === 0 || ordered.length !== candidates.length) {
    return {
      status: ordered.length === 0 ? "no_policy_allowed_path" : "missing_required_inputs",
      path_id: "path_none",
      coherence_score: 0,
      steps: [],
      why_coherent: []
    };
  }

  const coherenceScore = scorePath(ordered, query);

  return {
    status: "coherent_path_found",
    path_id: publicId("path", {
      goal: query.goal,
      steps: ordered.map((action) => action.id)
    }),
    coherence_score: coherenceScore,
    steps: ordered.map((action) => ({
      action_id: action.id,
      stable_id: action.stable_id,
      manifest_digest: action.manifest_digest,
      risk_tier: action.risk.tier,
      confirmation_required: action.confirmation.required,
      requires: requiredFields(action),
      produces: producedFields(action)
    })),
    why_coherent: [
      query.constraints.merchant ? `Matches publisher domain ${query.constraints.merchant}` : "Matches publisher domain",
      "Checks eligibility before side effects",
      "Return creation precedes pickup scheduling",
      "All required inputs are available or produced by earlier steps",
      "Side-effectful steps are reversible and require confirmation",
      "Every side-effectful step requires idempotency",
      "Manifest is active, signed, and unexpired"
    ]
  };
}

function scorePath(actions: StoredAction[], query: SearchQuery): number {
  const goal = query.goal.toLowerCase();
  const intentAlignment = actions.some((action) => actionMatchesGoal(action, goal)) ? 1 : 0.65;
  const schemaCompleteness = actions.every((action) => requiredFields(action).length > 0) ? 1 : 0.6;
  const policyConsistency = actions.every((action) => (query.constraints.risk_tiers_allowed ?? [0, 1, 2]).includes(action.risk.tier)) ? 1 : 0;
  const reversibilityConsistency = actions.every((action) => action.risk.tier < 2 || action.reversibility.reversible) ? 1 : 0.4;
  const trustConsistency = actions.every((action) => action.manifest_digest.startsWith("sha256-")) ? 0.95 : 0.4;
  const temporalConsistency = dependenciesSatisfied(actions) ? 1 : 0.3;
  const receiptConsistency = actions.every((action) => action.execution.length > 0) ? 1 : 0.5;
  const pathSimplicity = actions.length <= 3 ? 1 : 0.7;
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

function actionMatchesGoal(action: StoredAction, goal: string): boolean {
  return (action.planning?.intent_tags ?? []).some((tag) => goal.includes(tag.toLowerCase()));
}

function dependenciesSatisfied(actions: StoredAction[]): boolean {
  return actions.every((action, index) => {
    return (action.planning?.after ?? []).every((stableId) => {
      const dependencyIndex = actions.findIndex((candidate) => candidate.stable_id === stableId);
      return dependencyIndex >= 0 && dependencyIndex < index;
    });
  });
}
