# Constraint Net

Constraint Net is a coherence-first execution layer for AI agents.

This MVP demonstrates a safe, reversible customer-service workflow:

```text
return.check_eligibility -> return.create -> pickup.schedule
```

The prototype includes:

- `actions.json`-style manifest schema and validation.
- A SoundMart demo manifest.
- A coherence path planner.
- Tier 0-2 preflight and confirmation rules.
- Mock OpenAPI-backed execution.
- Signed intent, consent, and execution receipts.
- A Fastify browser demo console at `/`.

## Run

```bash
pnpm install
pnpm dev
```

Open:

```text
http://127.0.0.1:4173
```

## Verify

```bash
pnpm test
pnpm typecheck
```

## Demo Flow

In the browser console:

1. Run coherence search.
2. Preflight return.
3. Confirm.
4. Execute.

The execution returns signed receipt IDs for intent, consent, and execution.
