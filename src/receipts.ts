import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { randomUUID } from "node:crypto";
import { sha256, stableStringify } from "./hash.js";
import { DEV_KEY_ID, DEV_PRIVATE_KEY_PEM, DEV_PUBLIC_KEY_PEM } from "./keys.js";
import type { ReceiptType, SignedReceipt } from "./types.js";

export const DEV_RECEIPT_PRIVATE_KEY_PEM = DEV_PRIVATE_KEY_PEM;
export const DEV_RECEIPT_PUBLIC_KEY_PEM = DEV_PUBLIC_KEY_PEM;

const privateKey = createPrivateKey(DEV_RECEIPT_PRIVATE_KEY_PEM);
const publicKey = createPublicKey(DEV_RECEIPT_PUBLIC_KEY_PEM);

export type ReceiptInput = {
  type: ReceiptType;
  subject: SignedReceipt["subject"];
  hashes: SignedReceipt["hashes"];
  state: Record<string, unknown>;
  previous_receipt_hash?: string;
};

export function createSignedReceipt(input: ReceiptInput): SignedReceipt {
  const unsigned = {
    receipt_id: `rcpt_${randomUUID()}`,
    type: input.type,
    issued_at: new Date().toISOString(),
    issuer: "urn:constraint-net:gateway:dev" as const,
    subject: input.subject,
    hashes: input.hashes,
    state: input.state,
    previous_receipt_hash: input.previous_receipt_hash
  };

  const payload = stableStringify(unsigned);
  const signature = sign(null, Buffer.from(payload), privateKey).toString("base64url");

  return {
    ...unsigned,
    signature: {
      alg: "Ed25519",
      kid: DEV_KEY_ID,
      value: signature
    }
  };
}

export function verifyReceipt(receipt: SignedReceipt): boolean {
  const { signature, ...unsigned } = receipt;
  const payload = stableStringify(unsigned);
  return verify(null, Buffer.from(payload), publicKey, Buffer.from(signature.value, "base64url"));
}

export function receiptHash(receipt: SignedReceipt): string {
  return sha256({
    ...receipt,
    signature: receipt.signature.value
  });
}
