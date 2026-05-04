# Security Policy

Constraint Net is a public alpha. The current gateway is intended for local development, protocol review, and demo integrations.

## Supported Scope

Security review currently applies to the `main` branch and unreleased pull requests.

Please treat these as alpha boundaries:

- The committed Ed25519 private key is a public development issuer for reproducible examples and tests. It is not a secret.
- Manifests, confirmations, executions, and receipts are stored in memory.
- Provider execution is mocked and does not yet resolve real OpenAPI operations.
- The local server is not hardened for internet exposure.

## Reporting

Use GitHub private vulnerability reporting if it is enabled for this repository. If it is not available, open a minimal issue asking for a secure contact path and avoid posting exploit details publicly.

Include:

- affected endpoint, CLI command, or manifest field
- expected impact
- reproduction steps that avoid real user data
- whether the issue affects consent, signing, replay safety, receipt verification, or manifest trust

## Security Priorities

Constraint Net changes should preserve:

- user consent before side effects
- manifest signature, expiry, revocation, and version checks
- idempotent execution and replay protection
- receipt verification outside the running process
- clear separation between development keys and publisher-owned production keys
