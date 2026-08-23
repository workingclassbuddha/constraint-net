import { describe, expect, it, vi } from "vitest";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";
import { createMemoryStore } from "../src/memoryStore.js";
import { verifyReceiptChain } from "../src/receiptVerification.js";
import { decideConfirmation, executePreflight, preflightAction } from "../src/runtime.js";
import { fetchManifestFromUrl } from "../src/discovery.js";

describe("red-team security regressions", () => {
  it("rejects execution after confirmation expiry", () => {
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
    store.updateConfirmation(preflight.confirmation.id, { expires_at: new Date(Date.now() - 1000).toISOString() });

    const result = executePreflight(store, {
      preflight_id: preflight.preflight_id,
      confirmation_id: preflight.confirmation.id,
      idempotency_key: "expired-confirmation"
    });

    expect(result.status).toBe("confirmation_expired");
  });

  it("enforces Tier 2 confirmation at execution even if action metadata is mutated", () => {
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

    action.confirmation.required = false;

    const result = executePreflight(store, {
      preflight_id: preflight.preflight_id,
      idempotency_key: "tier2-without-consent"
    });

    expect(result.status).toBe("confirmation_not_satisfied");
  });

  it("rejects an empty receipt chain", () => {
    const result = verifyReceiptChain([]);

    expect(result.valid).toBe(false);
    expect(result.receipt_count).toBe(0);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "receipt_chain_empty" })
    );
  });

  it("blocks direct private IPv4 manifest targets before fetching", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchManifestFromUrl("https://10.0.0.1/.well-known/constraint-net/actions.json", fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow("manifest_discovery_private_address_blocked");

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks redirects during manifest discovery", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://evil.example/actions.json" }
    }));

    await expect(
      fetchManifestFromUrl("https://example.com/.well-known/constraint-net/actions.json", fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow("manifest_discovery_redirect_blocked");
  });
});
