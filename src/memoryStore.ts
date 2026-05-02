import { publicId, sha256 } from "./hash.js";
import { createSignedReceipt } from "./receipts.js";
import type {
  Confirmation,
  ConstraintManifest,
  PreflightRecord,
  SignedReceipt,
  StoredAction,
  StoredManifest
} from "./types.js";

export type MemoryStore = ReturnType<typeof createMemoryStore>;

export function createMemoryStore() {
  const manifests = new Map<string, StoredManifest>();
  const actions = new Map<string, StoredAction>();
  const confirmations = new Map<string, Confirmation>();
  const preflights = new Map<string, PreflightRecord>();
  const receipts = new Map<string, SignedReceipt>();
  let latestDigest = "";

  return {
    ingestManifest(manifest: ConstraintManifest): StoredManifest {
      const digest = sha256(manifest);
      latestDigest = digest;
      const stored = { digest, manifest };
      manifests.set(digest, stored);

      for (const action of manifest.actions) {
        actions.set(action.id, {
          ...action,
          manifest_digest: digest,
          publisher_domain: manifest.publisher.primary_domain
        });
      }

      return stored;
    },

    currentDigest(): string {
      return latestDigest;
    },

    listActions(): StoredAction[] {
      return [...actions.values()];
    },

    getActionById(actionId: string): StoredAction | undefined {
      return actions.get(actionId);
    },

    getActionByStableId(stableId: string): StoredAction | undefined {
      return [...actions.values()].find((action) => action.stable_id === stableId);
    },

    saveConfirmation(confirmation: Confirmation): Confirmation {
      confirmations.set(confirmation.id, confirmation);
      return confirmation;
    },

    getConfirmation(id: string): Confirmation | undefined {
      return confirmations.get(id);
    },

    updateConfirmation(id: string, patch: Partial<Confirmation>): Confirmation | undefined {
      const existing = confirmations.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch };
      confirmations.set(id, updated);
      return updated;
    },

    savePreflight(preflight: PreflightRecord): PreflightRecord {
      preflights.set(preflight.id, preflight);
      return preflight;
    },

    getPreflight(id: string): PreflightRecord | undefined {
      return preflights.get(id);
    },

    saveReceipt(receipt: SignedReceipt): SignedReceipt {
      receipts.set(receipt.receipt_id, receipt);
      return receipt;
    },

    getReceipt(id: string): SignedReceipt | undefined {
      return receipts.get(id);
    },

    createAndSaveReceipt(input: Parameters<typeof createSignedReceipt>[0]): SignedReceipt {
      const receipt = createSignedReceipt(input);
      receipts.set(receipt.receipt_id, receipt);
      return receipt;
    },

    nextId(prefix: string, value: unknown): string {
      return publicId(prefix, { value, count: confirmations.size + preflights.size + receipts.size });
    }
  };
}
