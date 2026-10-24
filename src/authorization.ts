import { createHash, timingSafeEqual } from "node:crypto";

export type ActorTokens = Record<string, string>;
export type ActorRole = "requester" | "approver";
export type ActorRoles = Record<string, ActorRole>;

/** Operator roles are server configuration; clients cannot grant themselves a role. */
export function validateActorRoles(tokens: ActorTokens, roles: ActorRoles): void {
  for (const actor of Object.keys(tokens)) {
    if (roles[actor] !== "requester" && roles[actor] !== "approver") {
      throw new Error("actor_role_required");
    }
  }
  for (const actor of Object.keys(roles)) {
    if (!(actor in tokens)) throw new Error("actor_role_without_token");
  }
}


function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function validateActorTokens(tokens: ActorTokens): void {
  const seen = new Set<string>();
  for (const [actor, token] of Object.entries(tokens)) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(actor)) throw new Error("invalid_actor_id");
    if (typeof token !== "string" || token.length < 24) throw new Error("actor_token_too_short");
    const fingerprint = digest(token).toString("hex");
    if (seen.has(fingerprint)) throw new Error("duplicate_actor_token");
    seen.add(fingerprint);
  }
}

/** Return server-derived identity, not a client-supplied actor or session name. */
export function actorForAuthorization(
  header: string | undefined,
  tokens: ActorTokens,
  allowInsecureLocalDemo = false
): string | undefined {
  if (allowInsecureLocalDemo && !header) return "local-demo";
  if (!header || !header.startsWith("Bearer ") || header.length > 4096) return undefined;
  const supplied = header.slice(7);
  if (!supplied) return undefined;
  const suppliedDigest = digest(supplied);
  let matchingActor: string | undefined;
  for (const [actor, token] of Object.entries(tokens)) {
    if (timingSafeEqual(digest(token), suppliedDigest)) matchingActor = actor;
  }
  return matchingActor;
}
