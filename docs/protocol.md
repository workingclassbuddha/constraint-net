# Constraint Net Protocol

Constraint Net is a discovery, planning, consent, execution, and receipt protocol for agent-safe actions.

The core idea is simple: agents should not scrape pages or blindly call APIs for side-effectful work. They should discover publisher-declared capabilities, plan a coherent path under constraints, ask for consent when risk requires it, execute with replay protection, and return receipts that can be verified later.

## Publisher Manifests

Publishers expose an actions manifest at:

```text
https://<publisher-domain>/.well-known/constraint-net/actions.json
```

The manifest declares actions, schemas, planning metadata, risk tier, reversibility, confirmation policy, OpenAPI bindings, key discovery, and signatures.

## Trust Rules

- Manifests must validate against schema version `0.1`.
- Manifests must be active, unexpired, and signed.
- The manifest publisher domain must match the discovered domain.
- Tier 2 side effects must be reversible and require confirmation.
- Side-effectful OpenAPI actions must require idempotency.
- Execution must pin the manifest digest observed at preflight.

## Agent Flow

1. Discover a publisher manifest.
2. Validate and ingest it.
3. Plan a capability path from the user goal.
4. Preflight a selected step.
5. Ask the user to confirm Tier 2 side effects.
6. Execute with an idempotency key.
7. Verify intent, consent, and execution receipts.

## Local Endpoints

- `POST /v1/manifests`
- `POST /v1/manifests/ingest-url`
- `POST /v1/actions/search`
- `POST /v1/executions/preflight`
- `POST /v1/confirmations/:id/decision`
- `POST /v1/executions`
- `GET /v1/receipts/:id`
- `POST /v1/receipts/verify`
