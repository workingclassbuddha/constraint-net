# Public Launch Checklist

Use this before changing the repository visibility or announcing Constraint Net publicly.

## Repository

- `README.md` states Public Alpha status and local-only boundaries.
- `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` are present.
- GitHub Actions passes on `main`.
- The package remains `private: true` until an npm release is intentional.
- Issue and pull request templates are available.

## Safety

- Tier 2 actions require human confirmation.
- Side-effectful actions require idempotency.
- Manifest validation checks schema version, signature, expiration, revocation, and publisher domain.
- Receipt verification works from receipt payloads alone.
- Demo private keys are clearly labeled as public development issuers.

## Developer Demo

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm dev
```

Then, in another shell:

```bash
pnpm cli validate examples/soundmart/actions.json
pnpm cli ingest-url http://127.0.0.1:4173/.well-known/constraint-net/actions.json --server http://127.0.0.1:4173
pnpm cli plan --goal "Return my headphones from SoundMart and choose the fastest free pickup" --merchant soundmart.example --server http://127.0.0.1:4173
```

## Not Yet Production

Do not present this alpha as production infrastructure until these are replaced:

- in-memory store
- public development signing key
- mock OpenAPI-backed execution
- single-process receipt store
- local-only trust and publisher registry
- absence of hosted monitoring, abuse controls, and key rotation
