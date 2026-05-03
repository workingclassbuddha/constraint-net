import { receiptHash, verifyReceipt } from "./receipts.js";
import type { ReceiptVerificationResult, SignedReceipt, ValidationIssue } from "./types.js";

export function verifyReceiptChain(receipts: SignedReceipt[]): ReceiptVerificationResult {
  const errors: ValidationIssue[] = [];

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
