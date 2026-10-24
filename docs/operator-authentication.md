# Operator authentication: reference implementation (alpha)

This API is **not production-ready custody for real user accounts or payments**.
The approval endpoints now derive an operator identity from a configured bearer token
and bind it to a particular action, manifest digest, preflight identifier, and
SHA-256 of the exact inputs. A caller-provided actor name is never authoritative.

## Default behaviour

Without a valid token, POST requests to:
- `/v1/executions/preflight`
- `/v1/confirmations/:id/decision`
- `/v1/executions`

return HTTP 401. If Alice prepared a preflight, Bob cannot approve or execute it,
even if Bob knows the approval ID. Approval records are still in-memory. Tokens
are developer-provisioned shared secrets, **not** a full identity management system.

### Authenticated local example

Supply random secrets through the server environment. Never commit them:

```bash
export CNET_ACTOR_TOKENS_JSON='{"agent1":"REPLACE_WITH_UNIQUE_RANDOM_REQUESTER_SECRET","reviewer1":"REPLACE_WITH_DIFFERENT_RANDOM_APPROVER_SECRET"}'
export CNET_ACTOR_ROLES_JSON='{"agent1":"requester","reviewer1":"approver"}'
pnpm dev
```

Use the **requester** token for preflight and execution requests. A **different
approver** token is required for `POST /v1/confirmations/:id/decision`.
Requester tokens cannot approve, and approver tokens cannot execute.
Approved confirmation records retain `decided_by` and the exact
`input_preview` whose digest was approved.

Both role and token configuration are required. Server start fails if a
configured token lacks a role, or an unknown actor is given a role. A real deployment would need TLS, a secrets manager, actor roles,
key rotation, audit logs, revocation, rate limiting and durable state. Do not
place tokens in a URL, browser localStorage, or a public page.

### Explicit unsafe local demo

If you want to use the built-in example UI *without* credentials on a
**loopback-only** developer machine:

```bash
CNET_INSECURE_LOCAL_DEMO=1 HOST=127.0.0.1 pnpm dev
```

Demo mode cannot start with a non-loopback HOST and must never be proxied
to a public network. It bypasses operator authentication by design. The
corresponding demo issuer/signing key is publicly known. Never treat this
mode as real custody or authorization.

## Security limits still outstanding

- An approver token is a shared secret, not proof of a real human approving.
  A stolen approver token can approve independently from a stolen requester token.
  Production needs interactive trusted identity, explicit human presence and stronger
  access-control lifecycle protections.
- Signed proof generation currently relies on development keys.
- Stored action and confirmation state is not transactional or durable. Check
  race/restart semantics before connecting a real execution provider.
- Manifest ingestion and receipt-read endpoints need a separate access-control
  policy; this change secures only the three specified execution routes.
- This branch is stacked on the consent/expiry hardening PR and requires both
  to be reviewed before any deployment.

See issues #4 and #5 for the remaining auth and atomicity work.
