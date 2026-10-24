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
export CNET_ACTOR_TOKENS_JSON='{"operator1":"REPLACE_WITH_A_UNIQUE_RANDOM_32_PLUS_CHAR_SECRET"}'
pnpm dev
```

Then add `Authorization: Bearer YOUR_SECRET` to each of the three request
types above. A real deployment would need TLS, a secrets manager, actor roles,
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

- An actor token is a shared secret, not verified human presence; anyone who
  steals it can act as that operator.
- Signed proof generation currently relies on development keys.
- Stored action and confirmation state is not transactional or durable. Check
  race/restart semantics before connecting a real execution provider.
- Manifest ingestion and receipt-read endpoints need a separate access-control
  policy; this change secures only the three specified execution routes.
- This branch is stacked on the consent/expiry hardening PR and requires both
  to be reviewed before any deployment.

See issues #4 and #5 for the remaining auth and atomicity work.
