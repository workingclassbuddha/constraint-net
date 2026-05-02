# Constraint Net MVP Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Constraint Net MVP slice that validates signed action manifests, plans coherent action paths, preflights Tier 0-2 actions, records confirmations, executes mocked OpenAPI-backed actions, and emits signed receipts.

**Architecture:** Start with one TypeScript package and in-memory persistence so the coherence model is real before database plumbing. The core domain is split into validator, planner, policy, execution, receipts, and Fastify API modules.

**Tech Stack:** Node.js, TypeScript, pnpm, Vitest, Fastify, AJV.

---

## Slice Scope

Build:

- `actions.json` v0.1 schema.
- SoundMart example manifest.
- Manifest validator and risk linting.
- Coherence path planner returning `return.check_eligibility -> return.create -> pickup.schedule`.
- Preflight and confirmation rules for Tier 0-2.
- Mock OpenAPI execution for the SoundMart demo actions.
- Signed receipts using Node crypto.
- Fastify API with search, preflight, confirmation, execution, and receipt lookup.

Do not build yet:

- Postgres/Prisma.
- Real OAuth.
- Real outbound provider HTTP.
- Payments.
- MCP/A2A execution.
- Ads.
- Federation.

## Tasks

- [ ] Scaffold TypeScript package and test runner.
- [ ] Write failing tests for validator, planner, policy, receipts, and API flow.
- [ ] Implement manifest schema and SoundMart example.
- [ ] Implement validator and risk lints.
- [ ] Implement coherence planner and path scoring.
- [ ] Implement in-memory store.
- [ ] Implement preflight, confirmation, execution, and receipts.
- [ ] Implement Fastify routes.
- [ ] Run full tests.
- [ ] Start dev server and provide local URL.
