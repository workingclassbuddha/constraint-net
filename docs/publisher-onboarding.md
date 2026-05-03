# Publisher Onboarding

Use this checklist to make a publisher capability available to agents through Constraint Net.

1. Define the actions the publisher is willing to expose.
2. Add input and output schemas for every action.
3. Add planning metadata:
   - `intent_tags`
   - `requires`
   - `produces`
   - optional `after`
4. Add risk, reversibility, confirmation, and idempotency metadata.
5. Add public keys under `key_discovery.public_keys`.
6. Sign the manifest over its canonical unsigned payload.
7. Host it at `/.well-known/constraint-net/actions.json`.
8. Validate it locally:

```bash
pnpm cli validate examples/soundmart/actions.json
```

9. Ingest it into a running Constraint Net gateway:

```bash
pnpm cli ingest-url https://<domain>/.well-known/constraint-net/actions.json
```

## Safety Requirements

Tier 2 actions are side-effectful. They must:

- require confirmation
- declare a reversible path
- require idempotency for execution
- return outputs that validate against `output_schema`

Provider prose is never a policy input. The manifest fields are the policy surface.
