# Contributing

Constraint Net is a protocol-first alpha. Contributions are most useful when they improve safety, reversibility, consent, verification, or developer clarity without turning the MVP into a broad platform rewrite.

## Setup

```bash
pnpm install
pnpm test
pnpm typecheck
```

Run the local gateway:

```bash
pnpm dev
```

Open:

```text
http://127.0.0.1:4173
```

## Development Principles

- Keep changes small enough to review in one pull request.
- Prefer manifest-declared policy over provider prose.
- Preserve human confirmation for Tier 2 side effects.
- Require idempotency for side-effectful execution.
- Keep receipts verifiable without process-local state.
- Do not introduce production secrets, private keys, API tokens, or real customer data.

## Pull Request Checklist

- `pnpm test`
- `pnpm typecheck`
- README or docs updated for public API, CLI, or protocol changes
- new safety behavior covered by tests
- no development key presented as a production key
