import { buildServer } from "./app.js";
import type { ActorTokens, ActorRoles } from "./authorization.js";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const allowInsecureLocalDemo = process.env.CNET_INSECURE_LOCAL_DEMO === "1";

if (allowInsecureLocalDemo && !["127.0.0.1", "::1", "localhost"].includes(host)) {
  throw new Error("Insecure demo mode must bind only to loopback");
}

let actorTokens: ActorTokens = {};
if (process.env.CNET_ACTOR_TOKENS_JSON) {
  const parsed: unknown = JSON.parse(process.env.CNET_ACTOR_TOKENS_JSON);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("CNET_ACTOR_TOKENS_JSON must be an object of actor IDs to tokens");
  }
  actorTokens = parsed as ActorTokens;
}

let actorRoles: ActorRoles = {};
if (process.env.CNET_ACTOR_ROLES_JSON) {
  const parsed: unknown = JSON.parse(process.env.CNET_ACTOR_ROLES_JSON);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("CNET_ACTOR_ROLES_JSON must map actor IDs to requester or approver");
  }
  actorRoles = parsed as ActorRoles;
}

const app = buildServer({ actorTokens, actorRoles, allowInsecureLocalDemo });
await app.listen({ port, host });

console.log(`Constraint Net server at http://${host}:${port} (approval auth: ${allowInsecureLocalDemo ? "UNSAFE LOCAL DEMO" : "token-required"})`);
