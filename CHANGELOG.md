# Changelog

## Unreleased — source version 0.1.0

Public alpha reference implementation; no published GitHub or npm release is implied. The package remains private to prevent accidental npm publication.

Current source includes signed action manifests, consent-gated planning/execution, approval identity binding, authorization hardening and inspectable receipts. See Git history and the security regression tests for individual changes.

Release gates include durable storage, restart-safe atomic approval/idempotency/execution (issue #5), real executor validation and operational key management. Passing tests do not establish production security readiness.

Validate with `pnpm install --frozen-lockfile`, `pnpm typecheck` and `pnpm test`.
