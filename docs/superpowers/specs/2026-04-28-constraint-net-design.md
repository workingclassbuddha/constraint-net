# Constraint Net Design Spec

## Summary

Constraint Net is a coherence-first execution layer for AI agents.

It lets publishers expose safe machine-readable capabilities, lets agents discover those capabilities, then uses constraint dynamics to compose the least-contradictory executable path under intent, policy, schema, risk, trust, reversibility, confirmation, and receipt constraints.

The predecessor working name was ActionGraph. The product name is now **Constraint Net**.

## Core Thesis

Agents should not browse, scrape, or blindly call APIs for side-effectful user tasks. They should resolve a constraint field.

Constraint Net does not ask:

```text
Which API should the agent call?
```

It asks:

```text
Which action path remains coherent under all constraints?
```

This means the system operates on paths, not isolated actions. For the first demo:

```text
Goal:
  Return my headphones from SoundMart and choose the fastest free pickup.

Coherent path:
  1. check return eligibility
  2. create return
  3. schedule pickup
  4. issue receipts
```

Incoherent paths include:

- Scheduling pickup before a return exists.
- Creating a return without checking eligibility when eligibility is unknown.
- Executing a Tier 2 side effect without confirmation.
- Using an action whose manifest digest changed after preflight.
- Choosing a merchant mismatch because embedding similarity was high.
- Calling an action with missing cancellation or reversal metadata when reversibility is required.

## MVP Wedge

The MVP focuses on reversible customer-service operations:

- E-commerce return eligibility checks.
- Return creation.
- Exchange or warranty checks where available.
- Delivery rescheduling.
- Pickup scheduling.

The first concrete demo is:

```text
Return my headphones from SoundMart and choose the fastest free pickup.
```

This wedge is preferable to restaurant reservations for the first commercial version because it has clearer B2B ROI: reduced support load, fewer broken agent automations, safer merchant control, and auditable outcomes.

## Non-Goals

The MVP will not build:

- Payments or escrow.
- Wallets, stored card flows, or custody of funds.
- Ads or sponsored ranking.
- Healthcare, government, legal, finance, identity, or Tier 4 execution.
- Full MCP execution.
- Full A2A execution.
- Federated registry.
- Enterprise private registries.
- Verifiable Credentials.
- Transparency logs.
- Complex reputation economy.
- General browser automation fallback.
- Generic “Google for actions” marketplace.

MCP and A2A may appear as future-compatible reference fields in manifests, but they are not executable paths in the MVP.

## System Architecture

Constraint Net has five MVP planes:

1. **Manifest Plane**
   Publishers expose signed `/.well-known/actions.json` manifests. Each manifest describes actions, schemas, risk, reversibility, confirmation policy, OpenAPI bindings, and terms.

2. **Geometric Discovery Plane**
   The registry normalizes actions and indexes them in a capability space. Candidate actions are retrieved by proximity between the user goal, merchant constraints, action taxonomy, machine descriptions, schemas, and historical outcome labels.

3. **Constraint Dynamics Plane**
   A planner composes candidate actions into possible paths, then scores each path for coherence. Constraints can attract, stabilize, repel, block, or require clarification.

4. **Confirmation Plane**
   Side-effectful Tier 2 actions require human confirmation. Confirmation screens are generated from structured fields and live preflight data, not provider prose.

5. **Execution and Receipt Plane**
   The gateway executes OpenAPI-backed actions only after preflight, digest pinning, schema validation, policy gates, and confirmation where required. Every execution produces signed receipts.

## Geometric Model

Constraint Net represents the system as a capability space.

Primary objects:

- User goals.
- Publishers.
- Domains.
- Manifests.
- Actions.
- Input schemas.
- Output schemas.
- Risk policies.
- Reversibility policies.
- Confirmation requirements.
- OpenAPI bindings.
- Execution attempts.
- Receipts.
- Outcomes.

Each action has both symbolic and geometric features:

- Symbolic: `stable_id`, taxonomy, risk tier, required fields, merchant, region, operation ID, reversibility, confirmation policy.
- Geometric: embedding of machine description, schema field names, supported outcomes, merchant category, and examples.

Geometric retrieval is allowed to suggest candidates. It is never allowed to override hard constraints.

## Constraint Dynamics Model

The planner treats a candidate path as a state. Constraints apply forces to that state.

### Attractors

Attractors pull a path toward coherence:

- User intent match.
- Merchant match.
- Item/order match.
- Taxonomy match.
- Available pickup window.
- Strong schema fit.
- Known successful path pattern.

### Stabilizers

Stabilizers make a path safer and more executable:

- Reversibility.
- Idempotency key support.
- Signed manifest.
- Valid schema.
- Domain verification.
- Output validation.
- Confirmation requirement for side effects.
- Signed receipts.

### Repulsors

Repulsors reduce coherence:

- Missing required inputs.
- Stale manifest digest.
- Risk tier exceeds user or tenant policy.
- Weak or missing reversibility.
- Provider identity mismatch.
- Output schema mismatch.
- High dispute or failure signal.
- Private action not visible to the current user.

### Hard Blocks

Hard blocks make a path ineligible:

- Invalid manifest schema.
- Invalid required signature for executable action.
- Domain not verified for Tier 2.
- Tier 2 side effect without confirmation.
- Manifest digest mismatch after preflight.
- Missing idempotency for side-effectful OpenAPI execution.
- Input cannot validate against schema.
- Provider response cannot validate against output schema.

### Clarification Triggers

If the planner cannot produce a coherent path because required facts are missing, it asks for clarification instead of hallucinating.

Examples:

- The order ID is unknown.
- Multiple likely merchants match.
- No pickup window meets the user’s stated preference.
- The refund method requires user choice.
- The action requires an address that is not available.

## Coherence Objective

The planner maximizes path coherence:

```text
coherence(path) =
  intent_alignment
+ schema_completeness
+ policy_consistency
+ trust_consistency
+ reversibility_consistency
+ temporal_consistency
+ receipt_consistency
- contradiction_penalty
```

For the MVP, the formula should remain explainable:

```text
eligible =
  manifest_schema_valid
  AND manifest_digest_pinned
  AND risk_tier_allowed
  AND auth_state_allowed
  AND input_schema_valid
  AND confirmation_satisfied_when_required
  AND idempotency_available_for_side_effects
  AND output_schema_valid_after_execution
```

Then:

```text
coherence_score =
  0.25 * intent_alignment
+ 0.15 * schema_completeness
+ 0.15 * policy_consistency
+ 0.12 * reversibility_consistency
+ 0.10 * trust_consistency
+ 0.08 * temporal_consistency
+ 0.08 * receipt_consistency
+ 0.07 * path_simplicity
- 0.20 * contradiction_penalty
```

The exact weights are tunable. The invariant is that hard blocks beat scores.

## MVP Action Path Example

Goal:

```text
Return my headphones from SoundMart and choose the fastest free pickup.
```

Candidate actions:

- `return.check_eligibility`
- `return.create`
- `pickup.schedule`
- `pickup.cancel`
- `return.cancel`

Preferred coherent path:

1. `return.check_eligibility`
   - Tier 1 private read.
   - Requires order ID and user authorization.
   - Returns eligibility, item, refund estimate, and return window.

2. `return.create`
   - Tier 2 reversible side effect.
   - Requires confirmation.
   - Requires idempotency.
   - Returns return ID, refund status, and cancellation deadline.

3. `pickup.schedule`
   - Tier 2 reversible side effect.
   - Requires confirmation.
   - Depends on return ID.
   - Returns pickup ID, pickup window, and cancellation deadline.

4. Receipts
   - Intent receipt.
   - Consent receipt.
   - Execution receipt for return creation.
   - Execution receipt for pickup scheduling.

## Manifest Requirements

The MVP manifest is `actions.json` v0.1.

Required top-level fields:

- `$schema`
- `actions_manifest_version`
- `manifest_id`
- `publisher`
- `issued_at`
- `expires_at`
- `sequence`
- `status`
- `domain_verification`
- `key_discovery`
- `links`
- `indexing`
- `policies`
- `actions`
- `signatures`

Required action fields:

- `id`
- `stable_id`
- `version`
- `revision`
- `status`
- `title`
- `description`
- `machine_description`
- `taxonomy`
- `risk`
- `input_schema`
- `output_schema`
- `auth`
- `confirmation`
- `reversibility`
- `execution`
- `terms`

Required MVP execution binding:

- `type: "openapi"`
- `ref`
- `operation_id`
- `operation_ref`
- `timeout_ms`
- `idempotency` for Tier 2 actions

## API Surface

### Search

```http
POST /v1/actions/search
```

Input:

```json
{
  "goal": "Return my headphones from SoundMart and choose the fastest free pickup",
  "constraints": {
    "merchant": "soundmart.example",
    "risk_tiers_allowed": [0, 1, 2],
    "requires_reversible": true
  }
}
```

Output includes candidate actions and possible coherent paths:

```json
{
  "query_id": "qry_123",
  "paths": [
    {
      "path_id": "path_123",
      "coherence_score": 0.91,
      "steps": [
        "return.check_eligibility",
        "return.create",
        "pickup.schedule"
      ],
      "why_coherent": [
        "Matches merchant",
        "Checks eligibility before side effects",
        "Return creation precedes pickup scheduling",
        "Tier 2 steps require confirmation",
        "Both side effects are reversible"
      ]
    }
  ]
}
```

### Preflight

```http
POST /v1/executions/preflight
```

Preflight validates:

- Action exists.
- Manifest digest matches.
- Inputs validate.
- Policy allows the risk tier.
- Auth status is sufficient for MVP.
- Tier 2 confirmation is required.
- Idempotency is available for side-effectful execution.

### Confirmation

```http
GET /v1/confirmations/:id
POST /v1/confirmations/:id/decision
```

Tier 2 confirmation must show:

- Merchant.
- Action path.
- Item/order.
- Refund estimate or expected outcome.
- Pickup window where applicable.
- Data shared.
- Reversibility/cancellation deadline.
- Confirmation expiry.
- Alternatives where available.

### Execution

```http
POST /v1/executions
```

Execution requires:

- A successful preflight.
- Matching manifest digest.
- Valid confirmation for Tier 2.
- Idempotency key.
- Valid OpenAPI binding.

### Receipts

```http
GET /v1/receipts/:id
```

MVP receipt types:

- `intent`
- `consent`
- `execution`

Each receipt is signed and hash-linked when part of the same execution chain.

## Data Model

MVP entities:

- `Publisher`
- `Domain`
- `Manifest`
- `Action`
- `InterfaceBinding`
- `PathPlan`
- `PathStep`
- `ExecutionAttempt`
- `Confirmation`
- `Receipt`
- `TrustSignal`

`PathPlan` is the key addition beyond the earlier ActionGraph-style model. It represents the coherent sequence, not just individual search results.

Minimum `PathPlan` fields:

- `id`
- `query_id`
- `goal_hash`
- `coherence_score`
- `status`
- `selected`
- `explanation`
- `created_at`

Minimum `PathStep` fields:

- `id`
- `path_plan_id`
- `position`
- `action_id`
- `manifest_digest`
- `required_input_refs`
- `produced_output_refs`
- `risk_tier`
- `confirmation_required`

## Security Model

The MVP assumes manifests, provider responses, model summaries, and action descriptions may be adversarial.

Security rules:

- Provider prose is never a policy input.
- Tool output is data, not instructions.
- Search cannot bypass policy.
- Execution cannot bypass preflight.
- Side-effectful actions require confirmation.
- Manifest digests are pinned from preflight through execution.
- OpenAPI operation IDs and schemas are resolved from the pinned manifest snapshot.
- Provider responses are schema-validated.
- Raw provider tokens are not exposed to the model.
- Receipts store hashes of sensitive payloads where possible.

## Error Handling

Planner outcomes:

- `coherent_path_found`
- `clarification_required`
- `no_policy_allowed_path`
- `missing_required_inputs`
- `manifest_invalid`
- `auth_required`
- `confirmation_required`
- `execution_blocked`

Execution outcomes:

- `succeeded`
- `failed_retryable`
- `failed_terminal`
- `confirmation_denied`
- `provider_schema_mismatch`
- `manifest_digest_mismatch`
- `provider_unavailable`

No blind retries are allowed for side-effectful actions.

## Testing Strategy

Unit tests:

- Manifest schema validation.
- Risk linting.
- OpenAPI operation classification.
- Coherence scoring.
- Path dependency ordering.
- Policy hard blocks.
- Receipt signing and verification.

Integration tests:

- Ingest SoundMart manifest.
- Search for return + pickup goal.
- Produce coherent path.
- Preflight Tier 2 action.
- Confirm action.
- Execute mocked OpenAPI action.
- Validate output.
- Create signed receipts.

End-to-end demo test:

```text
Return my headphones from SoundMart and choose the fastest free pickup.
```

Expected path:

```text
return.check_eligibility -> return.create -> pickup.schedule
```

## Success Criteria

The MVP is successful when:

- A publisher can generate and validate an `actions.json` manifest.
- The registry can ingest the manifest and normalize actions.
- An agent can search by user goal.
- Constraint Net can return a coherent path, not only a ranked action.
- Tier 2 steps require confirmation.
- OpenAPI-backed actions execute with idempotency.
- Outputs validate against declared schemas.
- Intent, consent, and execution receipts are signed.
- The SoundMart return + pickup demo runs end to end.

## Open Questions

These are intentionally deferred until implementation planning:

- Whether path planning is initially in-memory or persisted before user selection.
- Whether embeddings are required in the first running demo or simulated with lexical/geometric feature scoring.
- Whether pilot auth is mocked or uses a real OAuth provider.

The design decision for MVP should prefer the smallest version that demonstrates coherent path planning.

## Spec Self-Review

Placeholder scan:

- No incomplete sections or TODO markers.
- Open questions are explicit deferred implementation choices, not missing product requirements.

Internal consistency:

- The name is consistently Constraint Net.
- ActionGraph appears only as predecessor naming context.
- MVP scope matches the reversible customer-service wedge.

Scope check:

- This is focused enough for one implementation plan: schema, examples, validator, registry, search, path planning, confirmation, OpenAPI execution, receipts, and demo.

Ambiguity check:

- Coherence is defined as a path objective.
- Hard blocks are explicitly stronger than scores.
- Tier 2 confirmation and digest pinning are mandatory.
