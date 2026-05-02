import { createAjv } from "./ajv.js";
import { actionsManifestSchema } from "./manifestSchema.js";
import type { ConstraintAction, ConstraintManifest } from "./types.js";

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ManifestValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const ajv = createAjv();

const validateSchema = ajv.compile(actionsManifestSchema);

export function validateManifest(manifest: ConstraintManifest): ManifestValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!validateSchema(manifest)) {
    for (const error of validateSchema.errors ?? []) {
      errors.push({
        path: error.instancePath || "$",
        code: "schema_validation_failed",
        message: error.message ?? "Manifest failed schema validation"
      });
    }
  }

  for (const [index, action] of manifest.actions?.entries() ?? []) {
    errors.push(...riskLintAction(action, `$.actions[${index}]`));
    errors.push(...secretLint(action, `$.actions[${index}]`));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function riskLintAction(action: ConstraintAction, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (action.risk.tier === 2 && !action.confirmation.required) {
    issues.push({
      path: `${path}.confirmation.required`,
      code: "tier2_confirmation_required",
      message: "Tier 2 side-effectful actions must require human confirmation."
    });
  }

  if (action.risk.tier === 2 && !action.reversibility.reversible) {
    issues.push({
      path: `${path}.reversibility.reversible`,
      code: "tier2_reversibility_required",
      message: "Tier 2 actions must declare a reversible path in the MVP."
    });
  }

  if (action.risk.side_effect !== "none") {
    const hasIdempotency = action.execution.every((binding) => binding.idempotency?.required === true);
    if (!hasIdempotency) {
      issues.push({
        path: `${path}.execution`,
        code: "side_effect_idempotency_required",
        message: "Side-effectful OpenAPI actions must require idempotency."
      });
    }
  }

  return issues;
}

function secretLint(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const forbidden = new Set(["secret", "api_key", "password", "token", "private_key"]);

  function visit(node: unknown, currentPath: string): void {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.has(key.toLowerCase())) {
        issues.push({
          path: `${currentPath}.${key}`,
          code: "secret_field_forbidden",
          message: `Manifest must not include secret-like field '${key}'.`
        });
      }
      visit(child, `${currentPath}.${key}`);
    }
  }

  visit(value, path);
  return issues;
}
