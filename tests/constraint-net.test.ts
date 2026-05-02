import { describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";
import { createMemoryStore } from "../src/memoryStore.js";
import { planCoherentPath } from "../src/planner.js";
import { createSignedReceipt, verifyReceipt } from "../src/receipts.js";
import { preflightAction } from "../src/runtime.js";
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
