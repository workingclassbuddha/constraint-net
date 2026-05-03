import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { stableStringify } from "./hash.js";
import { DEV_PRIVATE_KEY_PEM } from "./keys.js";
import type { ConstraintManifest, ManifestSignature, ValidationIssue } from "./types.js";

export type ManifestValidationOptions = {
  now?: Date;
  expectedPublisherDomain?: string;
  requireSignature?: boolean;
};

export function unsignedManifestPayload(manifest: ConstraintManifest | Omit<ConstraintManifest, "signatures">): string {
  const { signatures: _signatures, ...unsigned } = manifest as ConstraintManifest;
  return stableStringify(unsigned);
}

export function signManifest(
  manifest: Omit<ConstraintManifest, "signatures">,
  kid: string,
  privateKeyPem = DEV_PRIVATE_KEY_PEM
): ConstraintManifest {
  const signature = sign(null, Buffer.from(unsignedManifestPayload(manifest)), createPrivateKey(privateKeyPem)).toString("base64url");
  return {
    ...manifest,
    signatures: [
      {
        alg: "Ed25519",
        kid,
        signature
      }
    ]
  };
}

export function validateManifestTrust(
  manifest: ConstraintManifest,
  options: ManifestValidationOptions = {}
): ValidationIssue[] {
  const now = options.now ?? new Date();
  const issues: ValidationIssue[] = [];
  const issuedAt = Date.parse(manifest.issued_at);
  const expiresAt = Date.parse(manifest.expires_at);

  if (manifest.actions_manifest_version !== "0.1") {
    issues.push({
      path: "$.actions_manifest_version",
      code: "unsupported_manifest_version",
      message: `Unsupported manifest version '${manifest.actions_manifest_version}'.`
    });
  }

  if (manifest.status === "revoked" || manifest.status === "suspended") {
    issues.push({
      path: "$.status",
      code: manifest.status === "revoked" ? "manifest_revoked" : "manifest_suspended",
      message: `Manifest status is '${manifest.status}'.`
    });
  }

  if (Number.isFinite(issuedAt) && issuedAt > now.getTime()) {
    issues.push({
      path: "$.issued_at",
      code: "manifest_not_yet_valid",
      message: `Manifest is not valid until ${manifest.issued_at}.`
    });
  }

  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
    issues.push({
      path: "$.expires_at",
      code: "manifest_expired",
      message: `Manifest expired at ${manifest.expires_at}.`
    });
  }

  if (options.expectedPublisherDomain && manifest.publisher.primary_domain !== options.expectedPublisherDomain) {
    issues.push({
      path: "$.publisher.primary_domain",
      code: "publisher_domain_mismatch",
      message: `Manifest publisher domain '${manifest.publisher.primary_domain}' does not match '${options.expectedPublisherDomain}'.`
    });
  }

  if ((options.requireSignature ?? true) && !verifyAnyManifestSignature(manifest)) {
    issues.push({
      path: "$.signatures[0]",
      code: "manifest_signature_invalid",
      message: "No manifest signature verifies against key_discovery.public_keys."
    });
  }

  return issues;
}

export function verifyAnyManifestSignature(manifest: ConstraintManifest): boolean {
  return manifest.signatures.some((signature) => verifyManifestSignature(manifest, signature));
}

function verifyManifestSignature(manifest: ConstraintManifest, signature: ManifestSignature): boolean {
  const key = manifest.key_discovery.public_keys?.find((candidate) => candidate.kid === signature.kid);
  if (!key || signature.alg !== "Ed25519" || key.alg !== "Ed25519") return false;

  try {
    return verify(
      null,
      Buffer.from(unsignedManifestPayload(manifest)),
      createPublicKey(key.public_key_pem),
      Buffer.from(signature.signature, "base64url")
    );
  } catch {
    return false;
  }
}
