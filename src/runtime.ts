import { type ErrorObject } from "ajv";
import { createAjv } from "./ajv.js";
import { publicId, sha256 } from "./hash.js";
import type { MemoryStore } from "./memoryStore.js";
import { receiptHash } from "./receipts.js";
import type { Confirmation, SignedReceipt, StoredAction } from "./types.js";

const ajv = createAjv();

export type PreflightInput = {
  action_id: string;
  manifest_digest: string;
  inputs: Record<string, unknown>;
};

export type PreflightResult =
  | {
      status: "confirmation_required" | "ready";
      preflight_id: string;
      risk_tier: number;
      confirmation?: Confirmation;
      receipt_preview: {
        intent_receipt_id: string;
      };
    }
  | {
      status: "action_not_found" | "manifest_digest_mismatch" | "input_schema_invalid";
      errors?: string[];
    };

export type ExecuteInput = {
  preflight_id: string;
  confirmation_id?: string;
  idempotency_key: string;
};

export function preflightAction(store: MemoryStore, input: PreflightInput): PreflightResult {
  const action = store.getActionById(input.action_id);
  if (!action) return { status: "action_not_found" };

  if (action.manifest_digest !== input.manifest_digest) {
    return { status: "manifest_digest_mismatch" };
  }

  const validateInput = ajv.compile(action.input_schema);
  if (!validateInput(input.inputs)) {
    return {
      status: "input_schema_invalid",
      errors: (validateInput.errors ?? []).map((error: ErrorObject) => `${error.instancePath || "$"} ${error.message}`)
    };
  }

  const intentReceipt = store.createAndSaveReceipt({
    type: "intent",
    subject: {
      action_id: action.id,
      manifest_digest: action.manifest_digest
    },
    hashes: {
      input_sha256: sha256(input.inputs),
      policy_decision_sha256: sha256({
        action_id: action.id,
        decision: action.confirmation.required ? "confirmation_required" : "ready"
      })
    },
    state: {
      status: "preflighted"
    }
  });

  const preflightId = publicId("pre", {
    action_id: action.id,
    inputs: input.inputs,
    receipt_id: intentReceipt.receipt_id
  });

  if (action.risk.tier === 2 || action.confirmation.required) {
    const confirmation = buildConfirmation(store, action);
    store.savePreflight({
      id: preflightId,
      action_id: action.id,
      manifest_digest: action.manifest_digest,
      inputs: input.inputs,
      status: "confirmation_required",
      confirmation_id: confirmation.id,
      intent_receipt_id: intentReceipt.receipt_id
    });

    return {
      status: "confirmation_required",
      preflight_id: preflightId,
      risk_tier: action.risk.tier,
      confirmation,
      receipt_preview: {
        intent_receipt_id: intentReceipt.receipt_id
      }
    };
  }

  store.savePreflight({
    id: preflightId,
    action_id: action.id,
    manifest_digest: action.manifest_digest,
    inputs: input.inputs,
    status: "ready",
    intent_receipt_id: intentReceipt.receipt_id
  });

  return {
    status: "ready",
    preflight_id: preflightId,
    risk_tier: action.risk.tier,
    receipt_preview: {
      intent_receipt_id: intentReceipt.receipt_id
    }
  };
}

export function decideConfirmation(store: MemoryStore, id: string, decision: "confirm" | "deny"): Confirmation | undefined {
  const confirmation = store.getConfirmation(id);
  if (!confirmation) return undefined;
  return store.updateConfirmation(id, {
    status: decision === "confirm" ? "confirmed" : "denied",
    decided_at: new Date().toISOString()
  });
}

export function executePreflight(store: MemoryStore, input: ExecuteInput) {
  const preflight = store.getPreflight(input.preflight_id);
  if (!preflight) {
    return { status: "preflight_not_found" as const };
  }

  const action = store.getActionById(preflight.action_id);
  if (!action) {
    return { status: "action_not_found" as const };
  }

  const confirmation = input.confirmation_id ? store.getConfirmation(input.confirmation_id) : undefined;
  if (action.confirmation.required) {
    if (!confirmation || confirmation.status !== "confirmed" || confirmation.id !== preflight.confirmation_id) {
      return { status: "confirmation_not_satisfied" as const };
    }
  }

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
        .map((receipt) => ({
          type: receipt.type,
          receipt_id: receipt.receipt_id
        }))
    };
  }

  const priorExecution = store.findExecutionByPreflight(preflight.id);
  if (priorExecution) {
    return {
      status: "preflight_already_executed" as const,
      execution_id: priorExecution.id
    };
  }

  const result = executeMockProvider(action, preflight.inputs, input.idempotency_key);
  const validateOutput = ajv.compile(action.output_schema);
  if (!validateOutput(result)) {
    return {
      status: "provider_schema_mismatch" as const,
      errors: (validateOutput.errors ?? []).map((error: ErrorObject) => `${error.instancePath || "$"} ${error.message}`)
    };
  }

  const executionId = publicId("exec", {
    preflight_id: preflight.id,
    idempotency_key: input.idempotency_key
  });

  const intentReceipt = store.getReceipt(preflight.intent_receipt_id);
  const consentReceipt = confirmation
    ? store.createAndSaveReceipt({
        type: "consent",
        subject: {
          execution_id: executionId,
          action_id: action.id,
          manifest_digest: action.manifest_digest
        },
        hashes: {
          input_sha256: sha256(confirmation),
          policy_decision_sha256: sha256({ confirmation_id: confirmation.id, status: confirmation.status })
        },
        state: {
          status: confirmation.status
        },
        previous_receipt_hash: intentReceipt ? receiptHash(intentReceipt) : undefined
      })
    : undefined;

  const executionReceipt = store.createAndSaveReceipt({
    type: "execution",
    subject: {
      execution_id: executionId,
      action_id: action.id,
      manifest_digest: action.manifest_digest
    },
    hashes: {
      input_sha256: sha256(preflight.inputs),
      provider_response_sha256: sha256(result),
      policy_decision_sha256: sha256({ action_id: action.id, status: "allowed" })
    },
    state: {
      status: "succeeded"
    },
    previous_receipt_hash: consentReceipt
      ? receiptHash(consentReceipt)
      : intentReceipt
        ? receiptHash(intentReceipt)
        : undefined
  });

  const receipts = [intentReceipt, consentReceipt, executionReceipt].filter((receipt): receipt is SignedReceipt => Boolean(receipt));

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

  return {
    execution_id: executionId,
    status: "succeeded" as const,
    result,
    receipts: receipts.map((receipt) => ({
      type: receipt.type,
      receipt_id: receipt.receipt_id
    }))
  };
}

function buildConfirmation(store: MemoryStore, action: StoredAction): Confirmation {
  const confirmation: Confirmation = {
    id: store.nextId("conf", { action_id: action.id, manifest_digest: action.manifest_digest }),
    action_id: action.id,
    manifest_digest: action.manifest_digest,
    status: "pending",
    summary: {
      action_path: [action.stable_id],
      merchant: action.publisher_domain,
      risk_tier: action.risk.tier,
      data_shared: action.input_schema.required ?? [],
      reversible: action.reversibility.reversible
    },
    expires_at: new Date(Date.now() + (action.confirmation.expires_after_seconds ?? 600) * 1000).toISOString()
  };

  return store.saveConfirmation(confirmation);
}

function executeMockProvider(action: StoredAction, inputs: Record<string, unknown>, idempotencyKey: string): Record<string, unknown> {
  if (action.stable_id === "return.create") {
    return {
      return_id: `ret_${inputs.order_id}_${inputs.item_id}`,
      status: "created",
      refund_amount: 249,
      cancel_until: "2026-04-29T08:00:00.000Z",
      idempotency_key: idempotencyKey
    };
  }

  if (action.stable_id === "pickup.schedule") {
    return {
      pickup_id: `pickup_${inputs.return_id}`,
      status: "scheduled",
      pickup_window: inputs.pickup_window,
      cancel_until: "2026-04-29T08:00:00.000Z",
      idempotency_key: idempotencyKey
    };
  }

  if (action.stable_id === "return.check_eligibility") {
    return {
      eligible: true,
      item_name: "WH-1000 headphones",
      refund_amount: 249,
      free_pickup_available: true
    };
  }

  return {
    status: "unsupported_action"
  };
}
