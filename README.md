# Constraint Net

Constraint Net is a coherence-first execution layer for AI agents.

This MVP demonstrates a safe, reversible customer-service workflow:

```text
return.check_eligibility -> return.create -> pickup.schedule
```

The prototype includes:

- `actions.json`-style manifest schema and validation.
- `.well-known/constraint-net/actions.json` manifest discovery.
- A SoundMart demo manifest.
- Manifest ingestion at `POST /v1/manifests`.
- Generic capability graph planning from action metadata.
- Tier 0-2 preflight and confirmation rules.
- Idempotent, replay-safe execution.
- Mock OpenAPI-backed execution.
- Signed intent, consent, and execution receipts with chain verification.
- A minimal `constraint-net` CLI.
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

## Protocol Quickstart

```bash
pnpm cli validate examples/soundmart/actions.json
pnpm dev
pnpm cli ingest-url http://127.0.0.1:4173/.well-known/constraint-net/actions.json --server http://127.0.0.1:4173
pnpm cli plan --goal "Return my headphones from SoundMart and choose the fastest free pickup" --merchant soundmart.example --server http://127.0.0.1:4173
```

## Demo Flow

In the browser console:

1. Run coherence search.
2. Preflight return.
3. Confirm.
4. Execute.
5. Preflight pickup.
6. Confirm.
7. Execute.

The executions return signed receipt IDs for intent, consent, and execution.

## API

- `GET /v1/health`
- `POST /v1/manifests`
- `POST /v1/manifests/ingest-url`
- `POST /v1/actions/search`
- `POST /v1/executions/preflight`
- `POST /v1/confirmations/:id/decision`
- `POST /v1/executions`
- `GET /v1/receipts/:id`
- `POST /v1/receipts/verify`

## Docs

- [Protocol overview](docs/protocol.md)
- [Publisher onboarding](docs/publisher-onboarding.md)
- [Agent builder guide](docs/agent-builder-guide.md)
