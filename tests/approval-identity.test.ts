import { describe, expect, it } from "vitest";
import { buildServer } from "../src/app.js";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";
import { createMemoryStore } from "../src/memoryStore.js";
import { actorForAuthorization, validateActorTokens } from "../src/authorization.js";

const tokenA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const tokenB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const tokens = { alice: tokenA, bob: tokenB };
const authorization = (token: string) => ({ authorization: `Bearer ${token}` });

describe("approval API operator identity", () => {
  it("rejects missing and invalid credentials with default fail-closed server", async () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const server = buildServer({ store });
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("missing action");
    const body = {
      action_id: action.id,
      manifest_digest: action.manifest_digest,
      inputs: { order_id: "order1", item_id: "item1", reason: "changed_mind" }
    };
    const response = await server.inject({ method: "POST", url: "/v1/executions/preflight", payload: body });
    expect(response.statusCode).toBe(401);
    expect(response.json().status).toBe("operator_auth_required");
    const execute = await server.inject({ method: "POST", url: "/v1/executions", payload: {
      preflight_id: "irrelevant", idempotency_key: "id1"
    } });
    expect(execute.statusCode).toBe(401);
    const confirm = await server.inject({ method: "POST", url: "/v1/confirmations/unknown/decision", payload: { decision: "confirm" } });
    expect(confirm.statusCode).toBe(401);
    await server.close();
  });

  it("binds approval to the same authenticated principal for every step", async () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const server = buildServer({ store, actorTokens: tokens });
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("missing action");
    const preflightResponse = await server.inject({
      method: "POST", url: "/v1/executions/preflight", headers: authorization(tokenA),
      payload: {
        action_id: action.id,
        manifest_digest: action.manifest_digest,
        inputs: { order_id: "order1", item_id: "item1", reason: "changed_mind" }
      }
    });
    expect(preflightResponse.statusCode).toBe(200);
    const preflight = preflightResponse.json();
    expect(preflight.status).toBe("confirmation_required");
    const wrongApproval = await server.inject({
      method: "POST", url: `/v1/confirmations/${preflight.confirmation.id}/decision`,
      headers: authorization(tokenB), payload: { decision: "confirm" }
    });
    expect(wrongApproval.statusCode).toBe(403);
    const rightApproval = await server.inject({
      method: "POST", url: `/v1/confirmations/${preflight.confirmation.id}/decision`,
      headers: authorization(tokenA), payload: { decision: "confirm" }
    });
    expect(rightApproval.statusCode).toBe(200);
    const wrongExecution = await server.inject({
      method: "POST", url: "/v1/executions", headers: authorization(tokenB),
      payload: { preflight_id: preflight.preflight_id, confirmation_id: preflight.confirmation.id, idempotency_key: "id1" }
    });
    expect(wrongExecution.statusCode).toBe(403);
    const rightExecution = await server.inject({
      method: "POST", url: "/v1/executions", headers: authorization(tokenA),
      payload: { preflight_id: preflight.preflight_id, confirmation_id: preflight.confirmation.id, idempotency_key: "id1" }
    });
    expect(rightExecution.statusCode).toBe(200);
    expect(rightExecution.json().status).toBe("succeeded");
    await server.close();
  });

  it("rejects reused tokens and never trusts a client-supplied actor header", () => {
    expect(() => validateActorTokens({ alice: tokenA, bob: tokenA })).toThrow("duplicate_actor_token");
    expect(() => validateActorTokens({ alice: "weak" })).toThrow("actor_token_too_short");
    expect(actorForAuthorization(`Bearer ${tokenA}`, tokens)).toBe("alice");
    expect(actorForAuthorization("Bearer invalid", tokens)).toBeUndefined();
    expect(actorForAuthorization(undefined, tokens)).toBeUndefined();
  });

  it("protects approval integrity against caller-side input mutation", async () => {
    const store = createMemoryStore();
    store.ingestManifest(soundmartManifest);
    const inputs = { order_id: "order1", item_id: "item1", reason: "changed_mind" };
    const action = store.getActionByStableId("return.create");
    if (!action) throw new Error("missing action");
    const { preflightAction, decideConfirmation, executePreflight } = await import("../src/runtime.js");
    const result = preflightAction(store, {
      action_id: action.id, manifest_digest: action.manifest_digest, inputs
    }, "alice");
    if (result.status !== "confirmation_required" || !result.confirmation) throw new Error("expected confirmation");
    inputs.order_id = "altered_after_preflight";
    decideConfirmation(store, result.confirmation.id, "confirm", "alice");
    const execution = executePreflight(store, {
      preflight_id: result.preflight_id, confirmation_id: result.confirmation.id, idempotency_key: "id1"
    }, "alice");
    expect(execution.status).toBe("succeeded");
    if (execution.status === "succeeded") expect((execution.result as { return_id: string }).return_id).toBe("ret_order1_item1");
  });
});
