import { describe, expect, it } from "vitest";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";
import { createMemoryStore } from "../src/memoryStore.js";
import { decideConfirmation, executePreflight, preflightAction } from "../src/runtime.js";

function setup() {
  const store = createMemoryStore();
  store.ingestManifest(soundmartManifest);
  const action = store.getActionByStableId("return.create");
  if (!action) throw new Error("fixture missing");
  const preflight = preflightAction(store, {
    action_id: action.id,
    manifest_digest: action.manifest_digest,
    inputs: { order_id: "ord_123", item_id: "item_headphones", reason: "changed_mind" }
  });
  if (preflight.status !== "confirmation_required" || !preflight.confirmation) throw new Error("expected confirmation");
  return { store, action, preflight };
}

describe("authorization invariants", () => {
  it("rejects approvals after expiration", () => {
    const { store, preflight } = setup();
    store.updateConfirmation(preflight.confirmation.id, { expires_at: "2020-01-01T00:00:00.000Z" });
    expect(decideConfirmation(store, preflight.confirmation.id, "confirm").status).toBe("confirmation_expired");
    expect(store.getConfirmation(preflight.confirmation.id)?.status).toBe("pending");
  });

  it("never reverses a denial", () => {
    const { store, preflight } = setup();
    expect(decideConfirmation(store, preflight.confirmation.id, "deny").status).toBe("denied");
    expect(decideConfirmation(store, preflight.confirmation.id, "confirm").status).toBe("confirmation_already_decided");
    expect(store.getConfirmation(preflight.confirmation.id)?.status).toBe("denied");
  });

  it("honors the stored preflight even after action metadata changes", () => {
    const { store, action, preflight } = setup();
    action.confirmation.required = false;
    action.risk.tier = 1;
    expect(executePreflight(store, {
      preflight_id: preflight.preflight_id,
      idempotency_key: "mutated-metadata"
    }).status).toBe("confirmation_not_satisfied");
  });

  it("does not accept approval from another preflight", () => {
    const { store, action, preflight } = setup();
    const other = preflightAction(store, {
      action_id: action.id,
      manifest_digest: action.manifest_digest,
      inputs: { order_id: "ord_other", item_id: "item_headphones", reason: "changed_mind" }
    });
    if (other.status !== "confirmation_required") throw new Error("expected confirmation");
    decideConfirmation(store, preflight.confirmation.id, "confirm");
    expect(executePreflight(store, {
      preflight_id: other.preflight_id,
      confirmation_id: preflight.confirmation.id,
      idempotency_key: "other-preflight"
    }).status).toBe("confirmation_not_satisfied");
  });

  it("fails closed if expiry is malformed", () => {
    const { store, preflight } = setup();
    decideConfirmation(store, preflight.confirmation.id, "confirm");
    store.updateConfirmation(preflight.confirmation.id, { expires_at: "invalid-date" });
    expect(executePreflight(store, {
      preflight_id: preflight.preflight_id,
      confirmation_id: preflight.confirmation.id,
      idempotency_key: "invalid-expiry"
    }).status).toBe("confirmation_expired");
  });
});
