import { describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { wellKnownActionsUrl } from "../src/discovery.js";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";
import { createMemoryStore } from "../src/memoryStore.js";
import { planCoherentPath } from "../src/planner.js";
import { createSignedReceipt, verifyReceipt } from "../src/receipts.js";
import { decideConfirmation, executePreflight, preflightAction } from "../src/runtime.js";
import { validateManifest } from "../src/validator.js";

describe("manifest validation", () => {
  it("accepts the SoundMart manifest", () => {
    const result = validateManifest(soundmartManifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a Tier 2 action without reversibility metadata", () => {
    const brokenManifest = structuredClone(soundmartManifest);
    const createReturn = brokenManifest.actions.find((action) => action.stable_id === "return.create");
    if (!createReturn) throw new Error("fixture missing return.create");
    createReturn.reversibility = { reversible: false };

    const result = validateManifest(brokenManifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "tier2_reversibility_required"
      })
    );
  });

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
});

describe("coherence planning", () => {
  it("plans return eligibility before return creation before pickup scheduling", () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);

    const path = planCoherentPath(store, {
      goal: "Return my headphones from SoundMart and choose the fastest free pickup",
      constraints: {
        merchant: "soundmart.example",
        risk_tiers_allowed: [0, 1, 2],
        requires_reversible: true
      }
    });

    expect(path.status).toBe("coherent_path_found");
    expect(path.steps.map((step) => step.stable_id)).toEqual([
      "return.check_eligibility",
      "return.create",
      "pickup.schedule"
    ]);
    expect(path.coherence_score).toBeGreaterThan(0.8);
    expect(path.why_coherent).toContain("Checks eligibility before side effects");
  });

  it("plans generic capability paths from action planning metadata", () => {
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
});

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

describe("preflight policy", () => {
  it("requires confirmation for Tier 2 side effects", () => {
    const store = createMemoryStore();
    const digest = store.ingestManifest(soundmartManifest).digest;
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("fixture missing return.create");

    const result = preflightAction(store, {
      action_id: action.id,
      manifest_digest: digest,
      inputs: {
        order_id: "ord_123",
        item_id: "item_headphones",
        reason: "changed_mind"
      }
    });

    expect(result.status).toBe("confirmation_required");
    if (result.status !== "confirmation_required") throw new Error("expected confirmation_required");
    expect(result.confirmation?.summary.action_path).toEqual(["return.create"]);
  });

  it("blocks execution when the manifest digest does not match", () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("fixture missing return.create");

    const result = preflightAction(store, {
      action_id: action.id,
      manifest_digest: "sha256-wrong",
      inputs: {
        order_id: "ord_123",
        item_id: "item_headphones",
        reason: "changed_mind"
      }
    });

    expect(result.status).toBe("manifest_digest_mismatch");
  });

  it("replays idempotent executions without creating new receipts", () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("fixture missing return.create");

    const preflight = preflightAction(store, {
      action_id: action.id,
      manifest_digest: action.manifest_digest,
      inputs: { order_id: "ord_123", item_id: "item_headphones", reason: "changed_mind" }
    });
    if (preflight.status !== "confirmation_required" || !preflight.confirmation) throw new Error("expected confirmation");
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
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("fixture missing return.create");

    const preflight = preflightAction(store, {
      action_id: action.id,
      manifest_digest: action.manifest_digest,
      inputs: { order_id: "ord_123", item_id: "item_headphones", reason: "changed_mind" }
    });
    if (preflight.status !== "confirmation_required" || !preflight.confirmation) throw new Error("expected confirmation");
    decideConfirmation(store, preflight.confirmation.id, "confirm");

    executePreflight(store, {
      preflight_id: preflight.preflight_id,
      confirmation_id: preflight.confirmation.id,
      idempotency_key: "idem_first"
    });
    const second = executePreflight(store, {
      preflight_id: preflight.preflight_id,
      confirmation_id: preflight.confirmation.id,
      idempotency_key: "idem_other"
    });

    expect(second.status).toBe("preflight_already_executed");
  });
});

describe("signed receipts", () => {
  it("signs and verifies receipt payloads", () => {
    const receipt = createSignedReceipt({
      type: "execution",
      subject: {
        execution_id: "exec_123",
        action_id: "urn:action:soundmart.example:return.create:v1",
        manifest_digest: "sha256-demo"
      },
      hashes: {
        input_sha256: "sha256-input",
        provider_response_sha256: "sha256-response",
        policy_decision_sha256: "sha256-policy"
      },
      state: {
        status: "succeeded"
      }
    });

    expect(receipt.signature.alg).toBe("Ed25519");
    expect(verifyReceipt(receipt)).toBe(true);
  });
});

describe("API flow", () => {
  it("serves the Constraint Net demo console at the root", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Constraint Net");
    expect(response.body).toContain("Run coherence search");
    expect(response.body).toContain("Coherence field");
    expect(response.body).toContain("Preflight pickup");
    expect(response.body).toContain("Pickup scheduled");

    await server.close();
  });

  it("serves an empty favicon response to keep the browser console quiet", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/favicon.ico"
    });

    expect(response.statusCode).toBe(204);

    await server.close();
  });

  it("ingests a manifest through the API and makes its actions searchable", async () => {
    const store = createMemoryStore();
    const server = buildServer({ store });

    const ingestResponse = await server.inject({
      method: "POST",
      url: "/v1/manifests",
      payload: soundmartManifest
    });

    expect(ingestResponse.statusCode).toBe(201);
    const ingestBody = ingestResponse.json();
    expect(ingestBody.status).toBe("manifest_ingested");
    expect(ingestBody.manifest_id).toBe(soundmartManifest.manifest_id);
    expect(ingestBody.publisher_domain).toBe("soundmart.example");
    expect(ingestBody.action_count).toBe(3);
    expect(ingestBody.manifest_digest).toBe(store.currentDigest());

    const searchResponse = await server.inject({
      method: "POST",
      url: "/v1/actions/search",
      payload: {
        goal: "Return my headphones from SoundMart and choose the fastest free pickup",
        constraints: {
          merchant: "soundmart.example",
          risk_tiers_allowed: [0, 1, 2],
          requires_reversible: true
        }
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().paths[0].steps).toEqual([
      "return.check_eligibility",
      "return.create",
      "pickup.schedule"
    ]);

    await server.close();
  });

  it("rejects invalid manifest ingestion requests with validation errors", async () => {
    const server = buildServer({ store: createMemoryStore() });
    const brokenManifest = structuredClone(soundmartManifest) as Record<string, unknown>;
    delete brokenManifest.actions;

    const response = await server.inject({
      method: "POST",
      url: "/v1/manifests",
      payload: brokenManifest
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.status).toBe("manifest_invalid");
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        code: "schema_validation_failed"
      })
    );

    await server.close();
  });

  it("searches, preflights, confirms, executes, and returns receipts", async () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const server = buildServer({ store });

    const searchResponse = await server.inject({
      method: "POST",
      url: "/v1/actions/search",
      payload: {
        goal: "Return my headphones from SoundMart and choose the fastest free pickup",
        constraints: {
          merchant: "soundmart.example",
          risk_tiers_allowed: [0, 1, 2],
          requires_reversible: true
        }
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchBody = searchResponse.json();
    expect(searchBody.paths[0].steps).toEqual([
      "return.check_eligibility",
      "return.create",
      "pickup.schedule"
    ]);

    const returnAction = store.getActionByStableId("return.create");
    if (!returnAction) throw new Error("fixture missing return.create");

    const preflightResponse = await server.inject({
      method: "POST",
      url: "/v1/executions/preflight",
      payload: {
        action_id: returnAction.id,
        manifest_digest: store.currentDigest(),
        inputs: {
          order_id: "ord_123",
          item_id: "item_headphones",
          reason: "changed_mind"
        }
      }
    });

    expect(preflightResponse.statusCode).toBe(200);
    const preflightBody = preflightResponse.json();
    expect(preflightBody.status).toBe("confirmation_required");

    const confirmationResponse = await server.inject({
      method: "POST",
      url: `/v1/confirmations/${preflightBody.confirmation.id}/decision`,
      payload: {
        decision: "confirm"
      }
    });

    expect(confirmationResponse.statusCode).toBe(200);

    const executionResponse = await server.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        preflight_id: preflightBody.preflight_id,
        confirmation_id: preflightBody.confirmation.id,
        idempotency_key: "idem_123"
      }
    });

    expect(executionResponse.statusCode).toBe(200);
    const executionBody = executionResponse.json();
    expect(executionBody.status).toBe("succeeded");
    expect(executionBody.result.return_id).toBe("ret_ord_123_item_headphones");
    expect(executionBody.receipts.map((receipt: { type: string }) => receipt.type)).toEqual([
      "intent",
      "consent",
      "execution"
    ]);

    await server.close();
  });
});
