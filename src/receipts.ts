import { generateKeyPairSync, sign, verify } from "node:crypto";
import { randomUUID } from "node:crypto";
import { sha256, stableStringify } from "./hash.js";
import type { ReceiptType, SignedReceipt } from "./types.js";

const keyPair = generateKeyPairSync("ed25519");

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
  const signature = sign(null, Buffer.from(payload), keyPair.privateKey).toString("base64url");

  return {
    ...unsigned,
    signature: {
      alg: "Ed25519",
      kid: "constraint-net-dev-2026-04",
      value: signature
    }
  };
}

export function verifyReceipt(receipt: SignedReceipt): boolean {
  const { signature, ...unsigned } = receipt;
  const payload = stableStringify(unsigned);
  return verify(null, Buffer.from(payload), keyPair.publicKey, Buffer.from(signature.value, "base64url"));
}

export function receiptHash(receipt: SignedReceipt): string {
  return sha256({
    ...receipt,
    signature: receipt.signature.value
  });
}
