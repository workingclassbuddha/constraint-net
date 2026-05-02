# Constraint Net Network Protocol Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Constraint Net feel like a real “internet for agents” protocol by allowing a third-party publisher manifest to be discovered from `/.well-known/constraint-net/actions.json`, validated, ingested, planned against generically, executed idempotently, and verified through portable receipts.

**Architecture:** Keep the repo a single TypeScript/Fastify package with in-memory storage, but introduce protocol boundaries: manifest discovery, trust validation, capability-graph planning, replay-safe execution records, receipt-chain verification, and a CLI. Do not add a database, OAuth, real OpenAPI HTTP execution, embeddings, federation, or transparency logs in this PR.

**Tech Stack:** Node.js 22, TypeScript, pnpm, Vitest, Fastify, AJV, Node `crypto`, Node `fetch`.

---

## Inspection Summary

Current local tree includes the original MVP plus uncommitted baseline improvements:

- `.github/workflows/ci.yml`: CI for `pnpm test` and `pnpm typecheck`.
- `src/app.ts`: Fastify app with health, root demo, manifest ingestion, search, preflight, confirmation, execution, receipt lookup, and favicon route.
- `src/demoPage.ts`: browser demo that continues from return creation to pickup scheduling.
- `README.md`: endpoint list and full demo flow.
- `tests/constraint-net.test.ts`: 11 tests passing for validation, planner, preflight, receipts, API flow, and manifest ingestion.

What already exists:

- `ConstraintManifest`, `ConstraintAction`, receipt, confirmation, and preflight TypeScript types in `src/types.ts`.
- JSON-schema-ish manifest validation and safety lints in `src/validator.ts`.
- SoundMart demo manifest in `src/examples/soundmartManifest.ts`.
- In-memory manifests/actions/confirmations/preflights/receipts in `src/memoryStore.ts`.
- Coherence planner in `src/planner.ts`, currently hardcoded to `return.check_eligibility -> return.create -> pickup.schedule`.
- Preflight, confirmation, mocked provider execution, and receipt creation in `src/runtime.ts`.
- Ed25519 receipt signing and verification in `src/receipts.ts`, currently using a process-local generated keypair.

What is missing for protocol credibility:

- No `.well-known/constraint-net/actions.json` discovery client.
- No URL-based ingestion endpoint or CLI flow.
- Manifest signatures are placeholders and not verified.
- Manifest expiry/revocation/version status is typed but not enforced.
- Planning is hardcoded to SoundMart stable IDs instead of generic action metadata.
- Receipts cannot be verified outside the running process because the signing key is generated at startup and not discoverable.
- Execution is not replay-safe; the same preflight/idempotency key produces new receipts each time.
- No CLI.
- Docs do not yet explain publisher onboarding, agent discovery, trust rules, or receipt verification.

## Smallest Coherent PR

Ship one PR named:

```text
protocol discovery and verifiable execution milestone
```

This PR should make the following end-to-end story true:

1. A publisher hosts a manifest at `https://publisher.example/.well-known/constraint-net/actions.json`.
2. A developer runs `constraint-net validate examples/soundmart/actions.json`.
3. A developer runs `constraint-net ingest-url https://publisher.example/.well-known/constraint-net/actions.json --server http://127.0.0.1:4173`.
4. Constraint Net fetches the manifest, validates schema, signature, expiry, status, version, safety lints, and publisher domain binding, then stores it.
5. An agent calls `POST /v1/actions/search` and gets a generic capability path, not a hardcoded SoundMart path.
6. The agent preflights, the user confirms Tier 2 side effects, and execution is idempotent for a repeated idempotency key.
7. Execution returns portable receipt objects or receipt IDs with deterministic verification.
8. A developer runs `constraint-net verify-receipt receipt-chain.json` after process restart and verification still succeeds.

Out of scope for this PR:

- Real outbound OpenAPI operation execution.
- OAuth and user account auth.
- Persistent database.
- Public registry/federation.
- Embeddings/vector search.
- Transparency logs.
- Production key custody.

## API Shapes

### Manifest Discovery

```http
POST /v1/manifests/ingest-url
content-type: application/json

{
  "url": "https://soundmart.example/.well-known/constraint-net/actions.json"
}
```

Success:

```json
{
  "status": "manifest_ingested",
  "manifest_id": "urn:constraint-manifest:soundmart.example:v1",
  "publisher_domain": "soundmart.example",
  "manifest_digest": "sha256-1111111111111111111111111111111111111111111111111111111111111111",
  "action_count": 3,
  "source_url": "https://soundmart.example/.well-known/constraint-net/actions.json",
  "warnings": []
}
```

Failure:

```json
{
  "status": "manifest_invalid",
  "source_url": "https://soundmart.example/.well-known/constraint-net/actions.json",
  "errors": [
    {
      "path": "$.expires_at",
      "code": "manifest_expired",
      "message": "Manifest expired at 2026-05-01T00:00:00.000Z."
    }
  ],
  "warnings": []
}
```

### Generic Search

Keep `POST /v1/actions/search`, but its result should be produced from action planning metadata:

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
    "reason": "changed_mind"
  }
}
```

Response:

```json
{
  "query_id": "qry_network_demo",
  "paths": [
    {
      "path_id": "path_network_demo",
      "status": "coherent_path_found",
      "coherence_score": 0.91,
      "steps": ["return.check_eligibility", "return.create", "pickup.schedule"],
      "step_details": [
        {
          "action_id": "urn:action:soundmart.example:return.check_eligibility:v1",
          "stable_id": "return.check_eligibility",
          "manifest_digest": "sha256-1111111111111111111111111111111111111111111111111111111111111111",
          "risk_tier": 1,
          "confirmation_required": false,
          "requires": ["order_id", "item_id"],
          "produces": ["eligible", "returnable_item", "free_pickup_available"]
        }
      ],
      "why_coherent": [
        "Matches publisher domain soundmart.example",
        "All required inputs are available or produced by earlier steps",
        "Side-effectful steps are reversible and require confirmation",
        "Every side-effectful step requires idempotency",
        "Manifest is active, signed, and unexpired"
      ]
    }
  ]
}
```

### Execution Replay

Existing endpoint:

```http
POST /v1/executions
```

Replay with same `preflight_id` and `idempotency_key` returns:

```json
{
  "execution_id": "exec_network_demo",
  "status": "succeeded",
  "replayed": true,
  "result": {},
  "receipts": [
    {
      "type": "intent",
      "receipt_id": "rcpt_network_demo"
    }
  ]
}
```

Same `preflight_id` with a different `idempotency_key` after success returns:

```json
{
  "status": "preflight_already_executed",
  "execution_id": "exec_network_demo"
}
```

### Receipt Verification

```http
POST /v1/receipts/verify
content-type: application/json

{
  "receipts": []
}
```

Response:

```json
{
  "valid": true,
  "receipt_count": 3,
  "chain": ["rcpt_1", "rcpt_2", "rcpt_3"],
  "errors": []
}
```

## TypeScript Type Additions

Add these fields to `src/types.ts`:

```ts
export type ManifestSignature = {
  alg: "Ed25519";
  kid: string;
  signature: string;
};

export type ManifestPublicKey = {
  kid: string;
  alg: "Ed25519";
  public_key_pem: string;
};

export type ActionPlanningMetadata = {
  intent_tags: string[];
  requires: string[];
  produces: string[];
  after?: string[];
};

export type ManifestTrustStatus =
  | "trusted"
  | "unsigned"
  | "signature_invalid"
  | "expired"
  | "not_yet_valid"
  | "revoked"
  | "unsupported_version";

export type StoredManifest = {
  digest: string;
  source_url?: string;
  discovered_at?: string;
  trust_status: ManifestTrustStatus;
  manifest: ConstraintManifest;
};

export type ConstraintAction = {
  // existing fields remain
  planning?: ActionPlanningMetadata;
};

export type SearchQuery = {
  goal: string;
  constraints: {
    merchant?: string;
    risk_tiers_allowed?: RiskTier[];
    requires_reversible?: boolean;
  };
  available_inputs?: Record<string, unknown>;
};

export type PlannedStep = {
  action_id: string;
  stable_id: string;
  manifest_digest: string;
  risk_tier: RiskTier;
  confirmation_required: boolean;
  requires: string[];
  produces: string[];
};

export type ExecutionRecord = {
  id: string;
  preflight_id: string;
  action_id: string;
  manifest_digest: string;
  idempotency_key: string;
  status: "succeeded" | "failed_retryable" | "failed_terminal";
  result: Record<string, unknown>;
  receipt_ids: string[];
  created_at: string;
};

export type ReceiptVerificationResult = {
  valid: boolean;
  receipt_count: number;
  chain: string[];
  errors: ValidationIssue[];
};
```

## File Structure

Create:

- `src/discovery.ts`: normalize publisher domains, derive well-known URL, fetch manifests, reject non-HTTPS unless localhost/test mode.
- `src/trust.ts`: canonical manifest payload, sign fixture manifests, verify manifest signatures, enforce expiry/status/version/domain binding.
- `src/capabilityGraph.ts`: build candidate action graph from `planning.requires`, `planning.produces`, `planning.after`.
- `src/executions.ts`: reusable execution-record helpers for idempotency and replay checks.
- `src/receiptVerification.ts`: verify receipt signatures and hash-chain continuity using exported public keys.
- `src/cli.ts`: minimal CLI entrypoint.
- `examples/soundmart/actions.json`: publisher-hostable JSON manifest.
- `docs/protocol.md`: protocol overview for agent builders.
- `docs/publisher-onboarding.md`: publisher checklist and manifest hosting instructions.
- `docs/agent-builder-guide.md`: discovery, planning, preflight, confirmation, execution, receipt verification.

Modify:

- `package.json`: add `bin`, CLI scripts, and keep `typecheck`/`test`.
- `src/types.ts`: add trust, planning, execution, and verification types.
- `src/manifestSchema.ts`: accept and validate `planning`, `key_discovery.public_keys`, structured signatures.
- `src/validator.ts`: enforce status/version/expiration/revocation/signature/idempotency/domain rules.
- `src/memoryStore.ts`: store source URL/trust status, list manifests, save/get execution records.
- `src/planner.ts`: replace hardcoded SoundMart path with generic capability graph planner.
- `src/runtime.ts`: use execution records for idempotent replay, include stable receipt chains.
- `src/receipts.ts`: replace process-local keypair with deterministic dev issuer key pair and exported verifier.
- `src/app.ts`: add URL ingestion and receipt verification endpoints.
- `src/examples/soundmartManifest.ts`: add planning metadata and real dev signature fields.
- `tests/constraint-net.test.ts`: keep existing tests and add focused protocol tests.
- `README.md`: upgrade from local demo README to protocol quickstart.

## Tasks

### Task 0: Preserve Current Baseline

**Files:**
- Modify: no source files

- [ ] **Step 1: Verify existing local baseline**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected:

```text
11 tests pass
tsc --noEmit exits 0
```

- [ ] **Step 2: Commit current local improvements before starting protocol work**

Run:

```bash
git add README.md package.json src/app.ts src/demoPage.ts tests/constraint-net.test.ts .github/workflows/ci.yml
git commit -m "add ci manifest ingestion and pickup demo flow"
```

Expected:

```text
[main <sha>] add ci manifest ingestion and pickup demo flow
```

### Task 1: Add Manifest Trust Envelope Tests

**Files:**
- Modify: `tests/constraint-net.test.ts`
- Later modify: `src/types.ts`, `src/manifestSchema.ts`, `src/validator.ts`, `src/trust.ts`

- [ ] **Step 1: Add failing trust validation tests**

Append to `describe("manifest validation", ...)`:

```ts
it("rejects expired active manifests", () => {
  const manifest = structuredClone(soundmartManifest);
  manifest.expires_at = "2026-01-01T00:00:00.000Z";

  const result = validateManifest(manifest, { now: new Date("2026-05-02T00:00:00.000Z") });

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "manifest_expired",
      path: "$.expires_at"
    })
  );
});

it("rejects revoked manifests", () => {
  const manifest = structuredClone(soundmartManifest);
  manifest.status = "revoked";

  const result = validateManifest(manifest);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "manifest_revoked",
      path: "$.status"
    })
  );
});

it("rejects manifests with invalid signatures", () => {
  const manifest = structuredClone(soundmartManifest);
  manifest.signatures = [
    {
      alg: "Ed25519",
      kid: "soundmart-demo-2026-04",
      signature: "invalid"
    }
  ];

  const result = validateManifest(manifest);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: "manifest_signature_invalid",
      path: "$.signatures[0]"
    })
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: validateManifest does not accept options and does not enforce expiration/status/signature
```

- [ ] **Step 3: Add trust types**

In `src/types.ts`, add:

```ts
export type ManifestSignature = {
  alg: "Ed25519";
  kid: string;
  signature: string;
};

export type ManifestPublicKey = {
  kid: string;
  alg: "Ed25519";
  public_key_pem: string;
};
```

Change `ConstraintManifest`:

```ts
key_discovery: {
  jwks_uri?: string;
  signing_algorithms?: string[];
  active_kids?: string[];
  public_keys?: ManifestPublicKey[];
};
signatures: ManifestSignature[];
```

- [ ] **Step 4: Add trust helpers**

Create `src/trust.ts`:

```ts
import { createPublicKey, verify } from "node:crypto";
import { stableStringify } from "./hash.js";
import type { ConstraintManifest, ManifestSignature, ValidationIssue } from "./types.js";

export type ManifestValidationOptions = {
  now?: Date;
  expectedPublisherDomain?: string;
  requireSignature?: boolean;
};

export function unsignedManifestPayload(manifest: ConstraintManifest): string {
  const { signatures, ...unsigned } = manifest;
  return stableStringify(unsigned);
}

export function validateManifestTrust(
  manifest: ConstraintManifest,
  options: ManifestValidationOptions = {}
): ValidationIssue[] {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];
  const issuedAt = Date.parse(manifest.issued_at);
  const expiresAt = Date.parse(manifest.expires_at);

  if (manifest.actions_manifest_version !== "0.1") {
    issues.push({
      path: "$.actions_manifest_version",
      code: "unsupported_manifest_version",
      message: `Unsupported manifest version '${manifest.actions_manifest_version}'.`
    });
  }

  if (manifest.status === "revoked" || manifest.status === "suspended") {
    issues.push({
      path: "$.status",
      code: manifest.status === "revoked" ? "manifest_revoked" : "manifest_suspended",
      message: `Manifest status is '${manifest.status}'.`
    });
  }

  if (Number.isFinite(issuedAt) && issuedAt > now.getTime()) {
    issues.push({
      path: "$.issued_at",
      code: "manifest_not_yet_valid",
      message: `Manifest is not valid until ${manifest.issued_at}.`
    });
  }

  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
    issues.push({
      path: "$.expires_at",
      code: "manifest_expired",
      message: `Manifest expired at ${manifest.expires_at}.`
    });
  }

  if (options.expectedPublisherDomain && manifest.publisher.primary_domain !== options.expectedPublisherDomain) {
    issues.push({
      path: "$.publisher.primary_domain",
      code: "publisher_domain_mismatch",
      message: `Manifest publisher domain '${manifest.publisher.primary_domain}' does not match '${options.expectedPublisherDomain}'.`
    });
  }

  if ((options.requireSignature ?? true) && !verifyAnyManifestSignature(manifest)) {
    issues.push({
      path: "$.signatures[0]",
      code: "manifest_signature_invalid",
      message: "No manifest signature verifies against key_discovery.public_keys."
    });
  }

  return issues;
}

export function verifyAnyManifestSignature(manifest: ConstraintManifest): boolean {
  return manifest.signatures.some((signature) => verifyManifestSignature(manifest, signature));
}

function verifyManifestSignature(manifest: ConstraintManifest, signature: ManifestSignature): boolean {
  const key = manifest.key_discovery.public_keys?.find((candidate) => candidate.kid === signature.kid);
  if (!key || signature.alg !== "Ed25519" || key.alg !== "Ed25519") return false;

  try {
    return verify(
      null,
      Buffer.from(unsignedManifestPayload(manifest)),
      createPublicKey(key.public_key_pem),
      Buffer.from(signature.signature, "base64url")
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Wire validator options**

In `src/validator.ts`, change imports:

```ts
import { validateManifestTrust, type ManifestValidationOptions } from "./trust.js";
import type { ConstraintAction, ConstraintManifest, ValidationIssue } from "./types.js";
```

Change signature:

```ts
export function validateManifest(
  manifest: ConstraintManifest,
  options: ManifestValidationOptions = {}
): ManifestValidationResult {
```

Before action lints, add:

```ts
errors.push(...validateManifestTrust(manifest, options));
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add src/types.ts src/trust.ts src/validator.ts src/manifestSchema.ts tests/constraint-net.test.ts
git commit -m "validate manifest trust envelope"
```

### Task 2: Add Well-Known Manifest Discovery

**Files:**
- Create: `src/discovery.ts`
- Modify: `src/app.ts`, `tests/constraint-net.test.ts`

- [ ] **Step 1: Add failing discovery tests**

Add to `tests/constraint-net.test.ts`:

```ts
import { wellKnownActionsUrl } from "../src/discovery.js";
```

Add tests:

```ts
describe("manifest discovery", () => {
  it("derives the well-known actions URL from a publisher domain", () => {
    expect(wellKnownActionsUrl("soundmart.example")).toBe(
      "https://soundmart.example/.well-known/constraint-net/actions.json"
    );
  });

  it("ingests a manifest URL through the API", async () => {
    const server = buildServer({
      store: createMemoryStore(),
      fetchManifest: async () => soundmartManifest
    });

    const response = await server.inject({
      method: "POST",
      url: "/v1/manifests/ingest-url",
      payload: {
        url: "https://soundmart.example/.well-known/constraint-net/actions.json"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "manifest_ingested",
      source_url: "https://soundmart.example/.well-known/constraint-net/actions.json",
      publisher_domain: "soundmart.example",
      action_count: 3
    });

    await server.close();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: Cannot find module '../src/discovery.js'
```

- [ ] **Step 3: Implement discovery**

Create `src/discovery.ts`:

```ts
import type { ConstraintManifest } from "./types.js";

export function wellKnownActionsUrl(domain: string): string {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://${normalized}/.well-known/constraint-net/actions.json`;
}

export async function fetchManifestFromUrl(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<ConstraintManifest> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("manifest_discovery_requires_https");
  }

  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`manifest_fetch_failed:${response.status}`);
  }

  return (await response.json()) as ConstraintManifest;
}

export function publisherDomainFromManifestUrl(url: string): string {
  return new URL(url).hostname;
}
```

- [ ] **Step 4: Wire API dependency injection**

In `src/app.ts`, update options:

```ts
import { fetchManifestFromUrl, publisherDomainFromManifestUrl } from "./discovery.js";

export type BuildServerOptions = {
  store?: MemoryStore;
  fetchManifest?: (url: string) => Promise<ConstraintManifest>;
};
```

Inside `buildServer`:

```ts
const fetchManifest = options.fetchManifest ?? fetchManifestFromUrl;
```

Add route:

```ts
app.post<{ Body: { url: string } }>("/v1/manifests/ingest-url", async (request, reply) => {
  try {
    const manifest = await fetchManifest(request.body.url);
    const validation = validateManifest(manifest, {
      expectedPublisherDomain: publisherDomainFromManifestUrl(request.body.url)
    });

    if (!validation.valid) {
      return reply.code(400).send({
        status: "manifest_invalid",
        source_url: request.body.url,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const stored = store.ingestManifest(manifest, { source_url: request.body.url, trust_status: "trusted" });
    return reply.code(201).send({
      status: "manifest_ingested",
      manifest_id: manifest.manifest_id,
      publisher_domain: manifest.publisher.primary_domain,
      manifest_digest: stored.digest,
      action_count: manifest.actions.length,
      source_url: request.body.url,
      warnings: validation.warnings
    });
  } catch (error) {
    return reply.code(400).send({
      status: "manifest_fetch_failed",
      source_url: request.body.url,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
```

- [ ] **Step 5: Add store ingest metadata**

In `src/memoryStore.ts`, change:

```ts
ingestManifest(manifest: ConstraintManifest, metadata: Partial<StoredManifest> = {}): StoredManifest {
  const digest = sha256(manifest);
  latestDigest = digest;
  const stored = {
    digest,
    manifest,
    source_url: metadata.source_url,
    discovered_at: metadata.discovered_at ?? new Date().toISOString(),
    trust_status: metadata.trust_status ?? "trusted"
  };
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add src/discovery.ts src/app.ts src/memoryStore.ts tests/constraint-net.test.ts
git commit -m "add well-known manifest discovery"
```

### Task 3: Add Generic Capability Graph Planning

**Files:**
- Create: `src/capabilityGraph.ts`
- Modify: `src/types.ts`, `src/manifestSchema.ts`, `src/planner.ts`, `src/examples/soundmartManifest.ts`, `tests/constraint-net.test.ts`

- [ ] **Step 1: Add failing planner test for a non-SoundMart publisher**

In `tests/constraint-net.test.ts`, create a minimal alternate manifest:

```ts
const repairManifest = structuredClone(soundmartManifest);
repairManifest.manifest_id = "urn:constraint-manifest:fixco.example:v1";
repairManifest.publisher.primary_domain = "fixco.example";
repairManifest.publisher.display_name = "FixCo";
repairManifest.actions = [
  {
    ...repairManifest.actions[0],
    id: "urn:action:fixco.example:device.diagnose:v1",
    stable_id: "device.diagnose",
    title: "Diagnose device",
    machine_description: "Diagnose whether a device is eligible for repair.",
    risk: { tier: 1, side_effect: "none", data_sensitivity: "device_private" },
    input_schema: {
      type: "object",
      required: ["device_id"],
      additionalProperties: false,
      properties: { device_id: { type: "string", minLength: 1 } }
    },
    planning: {
      intent_tags: ["repair", "diagnose", "device"],
      requires: ["device_id"],
      produces: ["diagnosis_id", "repair_eligible"]
    }
  },
  {
    ...repairManifest.actions[1],
    id: "urn:action:fixco.example:repair.create:v1",
    stable_id: "repair.create",
    title: "Create repair",
    machine_description: "Create a reversible repair order after diagnosis.",
    risk: { tier: 2, side_effect: "repair_created", data_sensitivity: "device_private" },
    input_schema: {
      type: "object",
      required: ["diagnosis_id"],
      additionalProperties: false,
      properties: { diagnosis_id: { type: "string", minLength: 1 } }
    },
    planning: {
      intent_tags: ["repair", "create", "device"],
      requires: ["diagnosis_id"],
      produces: ["repair_id"],
      after: ["device.diagnose"]
    }
  }
];
```

Add test:

```ts
it("plans generic capability paths from action planning metadata", () => {
  const store = createMemoryStore();
  store.ingestManifest(repairManifest);

  const path = planCoherentPath(store, {
    goal: "Repair my device with FixCo",
    constraints: {
      merchant: "fixco.example",
      risk_tiers_allowed: [0, 1, 2],
      requires_reversible: true
    },
    available_inputs: {
      device_id: "dev_123"
    }
  });

  expect(path.status).toBe("coherent_path_found");
  expect(path.steps.map((step) => step.stable_id)).toEqual(["device.diagnose", "repair.create"]);
  expect(path.steps[0].produces).toContain("diagnosis_id");
  expect(path.steps[1].requires).toContain("diagnosis_id");
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: planner returns no_policy_allowed_path because it is hardcoded to SoundMart stable IDs
```

- [ ] **Step 3: Add planning metadata type and schema**

In `src/types.ts`, add `ActionPlanningMetadata` from the TypeScript section and `planning?: ActionPlanningMetadata` to `ConstraintAction`.

In `src/manifestSchema.ts`, add to action properties:

```ts
planning: {
  type: "object",
  required: ["intent_tags", "requires", "produces"],
  additionalProperties: false,
  properties: {
    intent_tags: { type: "array", items: { type: "string" } },
    requires: { type: "array", items: { type: "string" } },
    produces: { type: "array", items: { type: "string" } },
    after: { type: "array", items: { type: "string" } }
  }
}
```

- [ ] **Step 4: Add planning metadata to SoundMart fixture**

For `return.check_eligibility`:

```ts
planning: {
  intent_tags: ["return", "eligibility", "refund", "headphones"],
  requires: ["order_id", "item_id"],
  produces: ["eligible", "returnable_item", "refund_amount", "free_pickup_available"]
}
```

For `return.create`:

```ts
planning: {
  intent_tags: ["return", "create", "refund"],
  requires: ["order_id", "item_id", "reason", "eligible"],
  produces: ["return_id", "refund_amount", "cancel_until"],
  after: ["return.check_eligibility"]
}
```

For `pickup.schedule`:

```ts
planning: {
  intent_tags: ["pickup", "schedule", "free", "fastest"],
  requires: ["return_id", "free_pickup_available", "pickup_window"],
  produces: ["pickup_id", "pickup_window", "cancel_until"],
  after: ["return.create"]
}
```

- [ ] **Step 5: Implement graph helper**

Create `src/capabilityGraph.ts`:

```ts
import type { SearchQuery, StoredAction } from "./types.js";

export function selectCandidateActions(actions: StoredAction[], query: SearchQuery): StoredAction[] {
  const goal = query.goal.toLowerCase();
  const merchant = query.constraints.merchant;
  const riskTiers = new Set(query.constraints.risk_tiers_allowed ?? [0, 1, 2]);

  return actions
    .filter((action) => !merchant || action.publisher_domain === merchant)
    .filter((action) => riskTiers.has(action.risk.tier))
    .filter((action) => !query.constraints.requires_reversible || action.risk.tier < 2 || action.reversibility.reversible)
    .filter((action) => action.status === "active" || action.status === "beta")
    .filter((action) => {
      const tags = action.planning?.intent_tags ?? [];
      return tags.some((tag) => goal.includes(tag.toLowerCase())) || goal.includes(action.stable_id.split(".")[0]);
    });
}

export function orderActionsByDependencies(actions: StoredAction[], query: SearchQuery): StoredAction[] {
  const remaining = [...actions];
  const ordered: StoredAction[] = [];
  const available = new Set(Object.keys(query.available_inputs ?? {}));

  while (remaining.length > 0) {
    const index = remaining.findIndex((action) => {
      const required = action.planning?.requires ?? action.input_schema.required ?? [];
      const explicitAfter = action.planning?.after ?? [];
      const afterSatisfied = explicitAfter.every((stableId) => ordered.some((step) => step.stable_id === stableId));
      const inputsSatisfied = required.every((name) => available.has(name));
      return afterSatisfied && inputsSatisfied;
    });

    if (index === -1) break;
    const [next] = remaining.splice(index, 1);
    ordered.push(next);
    for (const produced of next.planning?.produces ?? []) {
      available.add(produced);
    }
  }

  return ordered;
}
```

- [ ] **Step 6: Replace hardcoded planner**

In `src/planner.ts`, remove `RETURN_PICKUP_PATH` and use:

```ts
import { orderActionsByDependencies, selectCandidateActions } from "./capabilityGraph.js";
```

Compute:

```ts
const candidates = selectCandidateActions(store.listActions(), query);
const ordered = orderActionsByDependencies(candidates, query);

if (ordered.length === 0 || ordered.length !== candidates.length) {
  return {
    status: ordered.length === 0 ? "no_policy_allowed_path" : "missing_required_inputs",
    path_id: "path_none",
    coherence_score: 0,
    steps: [],
    why_coherent: []
  };
}
```

Map step details with `requires` and `produces`.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 8: Commit**

Run:

```bash
git add src/types.ts src/manifestSchema.ts src/examples/soundmartManifest.ts src/capabilityGraph.ts src/planner.ts tests/constraint-net.test.ts
git commit -m "plan generic capability graph paths"
```

### Task 4: Make Execution Replay-Safe

**Files:**
- Create: `src/executions.ts`
- Modify: `src/types.ts`, `src/memoryStore.ts`, `src/runtime.ts`, `tests/constraint-net.test.ts`

- [ ] **Step 1: Add failing idempotency tests**

Add to API flow tests:

```ts
it("replays idempotent executions without creating new receipts", async () => {
  const store = createMemoryStore();
  store.ingestManifest(soundmartManifest);
  const action = store.getActionByStableId("return.create");
  if (!action) throw new Error("fixture missing return.create");

  const preflight = preflightAction(store, {
    action_id: action.id,
    manifest_digest: action.manifest_digest,
    inputs: { order_id: "ord_123", item_id: "item_headphones", reason: "changed_mind" }
  });
  if (preflight.status !== "confirmation_required") throw new Error("expected confirmation");
  decideConfirmation(store, preflight.confirmation.id, "confirm");

  const first = executePreflight(store, {
    preflight_id: preflight.preflight_id,
    confirmation_id: preflight.confirmation.id,
    idempotency_key: "idem_same"
  });
  const second = executePreflight(store, {
    preflight_id: preflight.preflight_id,
    confirmation_id: preflight.confirmation.id,
    idempotency_key: "idem_same"
  });

  expect(first.status).toBe("succeeded");
  expect(second.status).toBe("succeeded");
  expect(second.replayed).toBe(true);
  expect(second.receipts).toEqual(first.receipts);
});

it("blocks a second idempotency key for an already executed preflight", () => {
  // same setup as previous test
  // expected second call with idempotency_key "idem_other" returns preflight_already_executed
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: replay produces new receipts and no replay marker
```

- [ ] **Step 3: Add execution storage**

In `src/types.ts`, add `ExecutionRecord`.

In `src/memoryStore.ts`, add:

```ts
const executions = new Map<string, ExecutionRecord>();

saveExecution(execution: ExecutionRecord): ExecutionRecord {
  executions.set(execution.id, execution);
  return execution;
},

getExecution(id: string): ExecutionRecord | undefined {
  return executions.get(id);
},

findExecutionByPreflight(preflightId: string): ExecutionRecord | undefined {
  return [...executions.values()].find((execution) => execution.preflight_id === preflightId);
},

findExecutionByPreflightAndIdempotency(preflightId: string, idempotencyKey: string): ExecutionRecord | undefined {
  return [...executions.values()].find(
    (execution) => execution.preflight_id === preflightId && execution.idempotency_key === idempotencyKey
  );
}
```

- [ ] **Step 4: Implement replay branch**

In `src/runtime.ts`, before provider execution:

```ts
const exactReplay = store.findExecutionByPreflightAndIdempotency(preflight.id, input.idempotency_key);
if (exactReplay) {
  return {
    execution_id: exactReplay.id,
    status: exactReplay.status,
    replayed: true,
    result: exactReplay.result,
    receipts: exactReplay.receipt_ids
      .map((receiptId) => store.getReceipt(receiptId))
      .filter((receipt): receipt is SignedReceipt => Boolean(receipt))
      .map((receipt) => ({ type: receipt.type, receipt_id: receipt.receipt_id }))
  };
}

const priorExecution = store.findExecutionByPreflight(preflight.id);
if (priorExecution) {
  return {
    status: "preflight_already_executed" as const,
    execution_id: priorExecution.id
  };
}
```

After receipts are created:

```ts
store.saveExecution({
  id: executionId,
  preflight_id: preflight.id,
  action_id: action.id,
  manifest_digest: action.manifest_digest,
  idempotency_key: input.idempotency_key,
  status: "succeeded",
  result,
  receipt_ids: receipts.map((receipt) => receipt.receipt_id),
  created_at: new Date().toISOString()
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 6: Commit**

Run:

```bash
git add src/types.ts src/memoryStore.ts src/runtime.ts tests/constraint-net.test.ts
git commit -m "make execution idempotent and replay safe"
```

### Task 5: Make Receipt Chains Portable and Verifiable

**Files:**
- Create: `src/receiptVerification.ts`
- Modify: `src/receipts.ts`, `src/types.ts`, `src/app.ts`, `tests/constraint-net.test.ts`

- [ ] **Step 1: Add failing portable verification tests**

Add to `describe("signed receipts", ...)`:

```ts
it("verifies a receipt chain without process-local state", () => {
  const intent = createSignedReceipt({
    type: "intent",
    subject: { action_id: "act_1", manifest_digest: "sha256-demo" },
    hashes: { input_sha256: "sha256-input", policy_decision_sha256: "sha256-policy" },
    state: { status: "preflighted" }
  });
  const execution = createSignedReceipt({
    type: "execution",
    subject: { action_id: "act_1", execution_id: "exec_1", manifest_digest: "sha256-demo" },
    hashes: { input_sha256: "sha256-input", provider_response_sha256: "sha256-response" },
    state: { status: "succeeded" },
    previous_receipt_hash: receiptHash(intent)
  });

  const result = verifyReceiptChain([intent, execution]);

  expect(result.valid).toBe(true);
  expect(result.chain).toEqual([intent.receipt_id, execution.receipt_id]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: verifyReceiptChain is not defined
```

- [ ] **Step 3: Replace process-local key with dev issuer key**

In `src/receipts.ts`, define stable PEM constants:

```ts
export const DEV_RECEIPT_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIOC68Bzd/kyQPe54raxib3DBePf6KBXVMGsdsuor1ziR
-----END PRIVATE KEY-----`;

export const DEV_RECEIPT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXKy0pYdM+qytZ/d8ZYaecPmSwREApaFGOgAwc+dBk28=
-----END PUBLIC KEY-----`;
```

Use the private key PEM above for MVP dev signing. The key is not a secret because this MVP issuer is not production.

Set `signature.kid` to `constraint-net-dev-2026-05`.

- [ ] **Step 4: Implement chain verification**

Create `src/receiptVerification.ts`:

```ts
import { receiptHash, verifyReceipt } from "./receipts.js";
import type { ReceiptVerificationResult, SignedReceipt } from "./types.js";

export function verifyReceiptChain(receipts: SignedReceipt[]): ReceiptVerificationResult {
  const errors = [];

  receipts.forEach((receipt, index) => {
    if (!verifyReceipt(receipt)) {
      errors.push({
        path: `$[${index}].signature`,
        code: "receipt_signature_invalid",
        message: `Receipt ${receipt.receipt_id} signature is invalid.`
      });
    }

    if (index > 0 && receipt.previous_receipt_hash !== receiptHash(receipts[index - 1])) {
      errors.push({
        path: `$[${index}].previous_receipt_hash`,
        code: "receipt_chain_broken",
        message: `Receipt ${receipt.receipt_id} does not link to the previous receipt.`
      });
    }
  });

  return {
    valid: errors.length === 0,
    receipt_count: receipts.length,
    chain: receipts.map((receipt) => receipt.receipt_id),
    errors
  };
}
```

- [ ] **Step 5: Add API route**

In `src/app.ts`:

```ts
import { verifyReceiptChain } from "./receiptVerification.js";
import type { SignedReceipt } from "./types.js";

app.post<{ Body: { receipts: SignedReceipt[] } }>("/v1/receipts/verify", async (request, reply) => {
  const result = verifyReceiptChain(request.body.receipts);
  return reply.code(result.valid ? 200 : 400).send(result);
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add src/receipts.ts src/receiptVerification.ts src/types.ts src/app.ts tests/constraint-net.test.ts
git commit -m "verify portable receipt chains"
```

### Task 6: Add Minimal CLI

**Files:**
- Create: `src/cli.ts`
- Modify: `package.json`, `tests/constraint-net.test.ts`

- [ ] **Step 1: Add CLI test helper**

Create CLI tests in `tests/constraint-net.test.ts` using `execa` is not available, so use Node `child_process.execFileSync`:

```ts
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
```

Add:

```ts
describe("CLI", () => {
  it("validates a manifest file", () => {
    const dir = mkdtempSync(join(tmpdir(), "constraint-net-"));
    const manifestPath = join(dir, "actions.json");
    writeFileSync(manifestPath, JSON.stringify(soundmartManifest));

    const output = execFileSync("pnpm", ["tsx", "src/cli.ts", "validate", manifestPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(output).toContain("manifest valid");
    expect(output).toContain(soundmartManifest.manifest_id);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
```

Expected:

```text
FAIL: src/cli.ts does not exist
```

- [ ] **Step 3: Add CLI entrypoint**

Create `src/cli.ts`:

```ts
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fetchManifestFromUrl } from "./discovery.js";
import { verifyReceiptChain } from "./receiptVerification.js";
import { validateManifest } from "./validator.js";

async function main(argv: string[]) {
  const [command, ...args] = argv;

  if (command === "validate") {
    const manifestPath = args[0];
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const result = validateManifest(manifest);
    if (!result.valid) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(`manifest valid: ${manifest.manifest_id}`);
    return;
  }

  if (command === "ingest-url") {
    const url = args[0];
    const server = valueAfter(args, "--server") ?? "http://127.0.0.1:4173";
    const response = await fetch(`${server}/v1/manifests/ingest-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    console.log(JSON.stringify(await response.json(), null, 2));
    process.exitCode = response.ok ? 0 : 1;
    return;
  }

  if (command === "plan") {
    const server = valueAfter(args, "--server") ?? "http://127.0.0.1:4173";
    const goal = valueAfter(args, "--goal");
    const merchant = valueAfter(args, "--merchant");
    const response = await fetch(`${server}/v1/actions/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal,
        constraints: { merchant, risk_tiers_allowed: [0, 1, 2], requires_reversible: true }
      })
    });
    console.log(JSON.stringify(await response.json(), null, 2));
    process.exitCode = response.ok ? 0 : 1;
    return;
  }

  if (command === "verify-receipt") {
    const receiptPath = args[0];
    const payload = JSON.parse(await readFile(receiptPath, "utf8"));
    const receipts = Array.isArray(payload) ? payload : payload.receipts;
    const result = verifyReceiptChain(receipts);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
    return;
  }

  if (command === "fetch") {
    const manifest = await fetchManifestFromUrl(args[0]);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.error("Usage: constraint-net validate <manifest.json> | ingest-url <url> [--server <url>] | plan --goal <goal> [--merchant <domain>] [--server <url>] | verify-receipt <receipt-chain.json>");
  process.exitCode = 1;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

await main(process.argv.slice(2));
```

- [ ] **Step 4: Add package bin**

In `package.json`:

```json
"bin": {
  "constraint-net": "./src/cli.ts"
}
```

Add scripts:

```json
"cli": "tsx src/cli.ts"
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test -- tests/constraint-net.test.ts
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 6: Commit**

Run:

```bash
git add src/cli.ts package.json tests/constraint-net.test.ts
git commit -m "add minimal constraint net cli"
```

### Task 7: Add Protocol Docs and Publisher Example

**Files:**
- Create: `examples/soundmart/actions.json`
- Create: `docs/protocol.md`
- Create: `docs/publisher-onboarding.md`
- Create: `docs/agent-builder-guide.md`
- Modify: `README.md`

- [ ] **Step 1: Add hosted manifest JSON example**

Create `examples/soundmart/actions.json` as JSON equivalent of `soundmartManifest`. The file must contain the full manifest currently represented by `src/examples/soundmartManifest.ts`, with `planning` metadata from Task 3 and this key-discovery public key:

```json
{
  "key_discovery": {
    "public_keys": [
      {
        "kid": "soundmart-demo-2026-04",
        "alg": "Ed25519",
        "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAXKy0pYdM+qytZ/d8ZYaecPmSwREApaFGOgAwc+dBk28=\n-----END PUBLIC KEY-----"
      }
    ]
  }
}
```

The `signatures[0].signature` value must be computed with `sign(null, Buffer.from(unsignedManifestPayload(manifest)), createPrivateKey(DEV_RECEIPT_PRIVATE_KEY_PEM)).toString("base64url")` after the full JSON manifest is assembled.

- [ ] **Step 2: Write protocol overview**

Create `docs/protocol.md` with these sections:

```markdown
# Constraint Net Protocol

Constraint Net is a discovery, planning, consent, execution, and receipt protocol for agent-safe actions.

## Publisher Manifests

Publishers expose:

`https://<publisher-domain>/.well-known/constraint-net/actions.json`

## Trust Rules

- Manifests must validate against schema version `0.1`.
- Manifests must be active, unexpired, and signed.
- Tier 2 side effects must be reversible and require confirmation.
- Side-effectful OpenAPI actions must require idempotency.

## Agent Flow

1. Discover manifest.
2. Validate and ingest.
3. Plan a capability path.
4. Preflight a step.
5. Ask the user to confirm Tier 2 side effects.
6. Execute with an idempotency key.
7. Verify receipts.
```

- [ ] **Step 3: Write publisher onboarding docs**

Create `docs/publisher-onboarding.md` with exact checklist:

```markdown
# Publisher Onboarding

1. Define actions.
2. Add schemas.
3. Add planning metadata.
4. Add risk, reversibility, confirmation, and idempotency.
5. Sign the manifest.
6. Host it at `/.well-known/constraint-net/actions.json`.
7. Run `pnpm cli validate examples/soundmart/actions.json`.
8. Run `pnpm cli ingest-url https://<domain>/.well-known/constraint-net/actions.json`.
```

- [ ] **Step 4: Write agent builder docs**

Create `docs/agent-builder-guide.md` with request/response examples for:

- `POST /v1/manifests/ingest-url`
- `POST /v1/actions/search`
- `POST /v1/executions/preflight`
- `POST /v1/confirmations/:id/decision`
- `POST /v1/executions`
- `POST /v1/receipts/verify`

- [ ] **Step 5: Update README**

Add:

````markdown
## Protocol Quickstart

```bash
pnpm cli validate examples/soundmart/actions.json
pnpm dev
pnpm cli ingest-url https://soundmart.example/.well-known/constraint-net/actions.json --server http://127.0.0.1:4173
pnpm cli plan --goal "Return my headphones from SoundMart and choose the fastest free pickup" --merchant soundmart.example
```
````

- [ ] **Step 6: Run docs-sensitive checks**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected:

```text
All tests pass
typecheck exits 0
```

- [ ] **Step 7: Commit**

Run:

```bash
git add examples/soundmart/actions.json docs/protocol.md docs/publisher-onboarding.md docs/agent-builder-guide.md README.md
git commit -m "document publisher and agent protocol flow"
```

## Final Verification

Run:

```bash
pnpm test
pnpm typecheck
pnpm dev
```

With the dev server running, run:

```bash
pnpm cli validate examples/soundmart/actions.json
pnpm cli ingest-url http://127.0.0.1:4173/.well-known/constraint-net/actions.json --server http://127.0.0.1:4173
pnpm cli plan --goal "Return my headphones from SoundMart and choose the fastest free pickup" --merchant soundmart.example --server http://127.0.0.1:4173
```

Expected:

- Manifest validation prints `manifest valid`.
- URL ingestion returns `manifest_ingested`.
- Planning returns `return.check_eligibility -> return.create -> pickup.schedule`.
- Tests pass.
- Typecheck exits 0.

## Success Criteria Mapping

- Third-party publisher onboarding: `docs/publisher-onboarding.md`, `examples/soundmart/actions.json`, CLI validate.
- `.well-known/constraint-net/actions.json` discovery: `src/discovery.ts`, `POST /v1/manifests/ingest-url`.
- Manifest validation/signing/expiration/revocation/versioning: `src/trust.ts`, `src/validator.ts`, manifest trust tests.
- Generic capability graph planning: `src/capabilityGraph.ts`, `src/planner.ts`, non-SoundMart repair manifest test.
- Verifiable receipt chains: `src/receiptVerification.ts`, `POST /v1/receipts/verify`, CLI verify.
- Idempotent execution: execution records in `src/memoryStore.ts`, replay tests in `tests/constraint-net.test.ts`.
- Minimal CLI: `src/cli.ts`, `package.json` bin/scripts.
- Developer and agent docs: `docs/protocol.md`, `docs/publisher-onboarding.md`, `docs/agent-builder-guide.md`, README quickstart.

## Self-Review

Spec coverage:

- All eight focus areas are covered by at least one task.
- Safety, reversibility, consent, and verifiability are preserved as hard gates.
- The PR is focused on protocol credibility, not production scale.

Placeholder scan:

- This plan avoids deferred implementation placeholders and includes a concrete development Ed25519 keypair for the portable receipt milestone.

Type consistency:

- `ValidationIssue` is currently in `src/validator.ts`; during implementation either export it from `src/types.ts` or keep imports pointed at `src/validator.ts`. Prefer moving `ValidationIssue` to `src/types.ts` because receipt verification and trust validation both need it.
