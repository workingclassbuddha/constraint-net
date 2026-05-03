import type { SearchQuery, StoredAction } from "./types.js";

export function selectCandidateActions(actions: StoredAction[], query: SearchQuery): StoredAction[] {
  const goal = query.goal.toLowerCase();
  const merchant = query.constraints.merchant;
  const riskTiers = new Set(query.constraints.risk_tiers_allowed ?? [0, 1, 2]);

  return actions
    .filter((action) => !merchant || action.publisher_domain === merchant)
    .filter((action) => riskTiers.has(action.risk.tier))
    .filter((action) => !query.constraints.requires_reversible || action.risk.tier < 2 || action.reversibility.reversible)
    .filter((action) => action.status === "active" || action.status === "beta")
    .filter((action) => matchesGoal(action, goal));
}

export function orderActionsByDependencies(actions: StoredAction[], query: SearchQuery): StoredAction[] {
  const remaining = [...actions];
  const ordered: StoredAction[] = [];
  const available = initialAvailableInputs(actions, query);

  while (remaining.length > 0) {
    const index = remaining.findIndex((action) => {
      const required = requiredFields(action);
      const explicitAfter = action.planning?.after ?? [];
      const afterSatisfied = explicitAfter.every((stableId) => ordered.some((step) => step.stable_id === stableId));
      const inputsSatisfied = required.every((name) => available.has(name));
      return afterSatisfied && inputsSatisfied;
    });

    if (index === -1) break;
    const [next] = remaining.splice(index, 1);
    ordered.push(next);
    for (const produced of producedFields(next)) {
      available.add(produced);
    }
  }

  return ordered;
}

export function requiredFields(action: StoredAction): string[] {
  return action.planning?.requires ?? action.input_schema.required ?? [];
}

export function producedFields(action: StoredAction): string[] {
  return action.planning?.produces ?? [];
}

function matchesGoal(action: StoredAction, goal: string): boolean {
  const tags = action.planning?.intent_tags ?? [];
  if (tags.some((tag) => goal.includes(tag.toLowerCase()))) return true;
  return action.stable_id
    .split(".")
    .some((part) => goal.includes(part.toLowerCase()));
}

function initialAvailableInputs(actions: StoredAction[], query: SearchQuery): Set<string> {
  const available = new Set(Object.keys(query.available_inputs ?? {}));

  for (const action of actions) {
    for (const required of requiredFields(action)) {
      const producedByAnotherAction = actions.some(
        (candidate) => candidate.id !== action.id && producedFields(candidate).includes(required)
      );
      if (!producedByAnotherAction) {
        available.add(required);
      }
    }
  }

  return available;
}
