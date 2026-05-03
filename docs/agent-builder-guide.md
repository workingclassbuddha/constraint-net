# Agent Builder Guide

This guide shows the minimum flow an agent should use with Constraint Net.

## 1. Ingest a Publisher Manifest

```http
POST /v1/manifests/ingest-url
content-type: application/json
```

```json
{
  "url": "https://soundmart.example/.well-known/constraint-net/actions.json"
}
```

## 2. Plan an Action Path

```http
POST /v1/actions/search
content-type: application/json
```

```json
{
  "goal": "Return my headphones from SoundMart and choose the fastest free pickup",
  "constraints": {
    "merchant": "soundmart.example",
    "risk_tiers_allowed": [0, 1, 2],
    "requires_reversible": true
  },
  "available_inputs": {
    "order_id": "ord_123",
    "item_id": "item_headphones",
    "reason": "changed_mind",
    "pickup_window": "fastest_free_2026-04-29_09-12"
  }
}
```

## 3. Preflight

```http
POST /v1/executions/preflight
content-type: application/json
```

```json
{
  "action_id": "urn:action:soundmart.example:return.create:v1",
  "manifest_digest": "sha256-...",
  "inputs": {
    "order_id": "ord_123",
    "item_id": "item_headphones",
    "reason": "changed_mind"
  }
}
```

Tier 2 actions return `confirmation_required`.

## 4. Confirm

```http
POST /v1/confirmations/:id/decision
content-type: application/json
```

```json
{
  "decision": "confirm"
}
```

## 5. Execute

```http
POST /v1/executions
content-type: application/json
```

```json
{
  "preflight_id": "pre_...",
  "confirmation_id": "conf_...",
  "idempotency_key": "agent-run-123"
}
```

Reusing the same `preflight_id` and `idempotency_key` returns the original execution result and receipt IDs. Reusing the same preflight with a different key is blocked after success.

## 6. Verify Receipts

```http
POST /v1/receipts/verify
content-type: application/json
```

```json
{
  "receipts": []
}
```

The verifier checks signatures and hash links between receipts.
