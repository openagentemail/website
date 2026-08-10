---
title: REST API reference
description: Every endpoint — identities, messages, wait-for-mail, OTP extraction, send.
---

Base URL: `http://localhost:3100` (the compose stack binds the API to
localhost by default — see [security.md](/docs/guides/security/) for reaching it
remotely).

All endpoints except `GET /healthz` and the public discovery routes under
`/.well-known/` (agent card, domain-control proof, OAuth Protected Resource
Metadata, and OAuth Authorization Server Metadata) require a bearer token.
`GET /authorize` is the browser authorization entry — consent is approved by
an **admin Dashboard session** at `/ui/oauth/authorize` (owner), not by any
OAuth protocol credential. `POST /oauth/token` and `POST /oauth/revoke` use
protocol credentials (`code` + PKCE, or the token value plus bound
`client_id`) — they do **not** take an admin / identity Bearer.

```
Authorization: Bearer <admin key, oa_… identity token, or OAuth access token>
```

Credential kinds (details in [security.md](/docs/guides/security/)):

- **Admin key** (from the `API_KEYS` env) — full access, every endpoint below.
- **Identity token** (`oa_…` from `POST /v1/identities`) — scoped to one
  address: `messages` / `wait` / `send` / participant `tasks` / own `notify`
  routes (human alerts need `canNotifyUser`), and
  `GET /v1/identities/:address/push-tier` for that same address. Creating or
  listing identities, rotating tokens, deleting identities, and
  `PUT …/push-tier` stay admin-only. Anything outside scope returns `403`.
- **OAuth access token** — identity-scoped only (**never** admin); issued by
  the authorize flow. Revoke the grant via `POST /oauth/revoke` or Dashboard
  `/ui/oauth/grants` (does not touch `oa_…`); deleting the identity cascades
  and kills its OAuth grants too.

For `/v1/*`, failures return `401 {"error":"unauthorized"}` for bad tokens.
`POST /mcp` uses a `WWW-Authenticate` challenge instead (see below). Examples
below assume:

```bash
export API=http://localhost:3100
export KEY=your-admin-key
```

---

## `GET /healthz`

Liveness probe. No auth.

```bash
curl $API/healthz
# → 200 {"ok":true}
```

## `POST /v1/identities` — admin only

Create an identity. With no `localpart`, a random one like `fox-k7d2` is generated.
The address is always on the `DOMAIN` the server was configured with.

The response includes the identity's **scoped token, shown exactly once** —
hand this one to your agent, not the admin key.

```bash
curl -X POST $API/v1/identities \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"signup-bot"}'
# → 201 {"address":"fox-k7d2@example.com","name":"signup-bot","pushContentTier":1,"token":"oa_…"}
```

| Field | Type | Notes |
|---|---|---|
| `name` | string? | Free-form label for the identity |
| `localpart` | string? | Force a specific address, e.g. `billing` → `billing@example.com` |
| `canNotifyUser` | boolean? | Admin-granted permission for this identity to call `notify_user` and `notify_verify` |

Response always includes resolved `pushContentTier` (default `1`). Tier `3`
adds `pushContentTierWarning` on list/public identity shapes.

## `GET /v1/identities` — admin only

```bash
curl $API/v1/identities -H "Authorization: Bearer $KEY"
# → 200 {"identities":[{"address":"fox-k7d2@example.com","name":"signup-bot",
#      "createdAt":"2026-07-26T00:00:00.000Z","pushContentTier":1}]}
```

Token hashes are never included in responses.

## `POST /v1/identities/:address/token` — admin only

Rotate an identity's token. The old token stops working immediately; the new
plaintext is returned once.

```bash
curl -X POST $API/v1/identities/fox-k7d2@example.com/token \
  -H "Authorization: Bearer $KEY"
# → 200 {"address":"fox-k7d2@example.com","token":"oa_…"}
```

## `DELETE /v1/identities/:address` — admin only

Delete an identity (and invalidate its token). Its mail stays in the catch-all
mailbox until the retention sweeper removes it.

```bash
curl -X DELETE $API/v1/identities/fox-k7d2@example.com -H "Authorization: Bearer $KEY"
# → 200 {"deleted":true}
```

## `GET /v1/identities/:address/push-tier`

Read the mail-arrival **push content tier** for one identity. Admin keys may
read any address. An identity token may read **only its own** address
(otherwise `403`).

```bash
curl $API/v1/identities/fox-k7d2@example.com/push-tier \
  -H "Authorization: Bearer $KEY"
# → 200 {"address":"fox-k7d2@example.com","pushContentTier":1}
```

| Field | Type | Notes |
|---|---|---|
| `address` | string | Lowercased identity address |
| `pushContentTier` | `1` \| `2` \| `3` | How much content mail-arrival user pushes include (default `1`) |
| `warning` | string? | Present only when tier is `3` — body/OTP leave this server via ntfy |

Tier semantics (mail-arrival pushes to the human topics only):

| Tier | Content in the push |
|---|---|
| `1` (default) | Interrupt only — address + whether the mail looks OTP/link-bearing. No sender, subject, preview, or codes. |
| `2` | Tier 1 plus **masked** `From` / `Subject` |
| `3` | Interrupt line plus **unmasked** `From` / `Subject`, body preview, and extracted OTP codes/links (sensitive) |

## `PUT /v1/identities/:address/push-tier` — admin only

Set the push content tier. **Admin key required** — identity tokens get
`403 {"error":"forbidden: admin key required"}`.

```bash
curl -X PUT $API/v1/identities/fox-k7d2@example.com/push-tier \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"pushContentTier":2}'
# → 200 {"address":"fox-k7d2@example.com","pushContentTier":2}
```

| Field | Type | Notes |
|---|---|---|
| `pushContentTier` | `1` \| `2` \| `3` | Required |
| `confirm_risk` | boolean? | **Required as `true` when setting tier `3`** |

Tier `3` ships body previews and OTP codes/links off-box through the ntfy
channel. Without `"confirm_risk": true` the API refuses with:

```json
400 {"error":"confirm_risk_required","message":"Tier 3 includes message body previews and OTP codes/links in push notifications. That content leaves this server for the ntfy channel."}
```

A successful tier-`3` response also includes the same text in `warning`.
Create and list responses always include resolved `pushContentTier`; list /
public identity shapes also add `pushContentTierWarning` when the tier is `3`.

## `GET /v1/messages?address=x@y&limit=50`

List an identity's inbox, newest first. `limit` defaults to 50 (max 200).
Identity tokens may only list their own address.

```bash
curl "$API/v1/messages?address=fox-k7d2@example.com&limit=10" \
  -H "Authorization: Bearer $KEY"
# → 200 {"messages":[{"id":"42","from":"noreply@github.com","to":"fox-k7d2@example.com",
#      "subject":"Verify your email","date":"2026-07-26T00:01:00.000Z","seen":false,
#      "snippet":"Confirm your address by clicking…","hasOtp":true,"source":"external"}]}
```

Each summary includes:

| Field | Type | Notes |
|---|---|---|
| `hasOtp` | boolean | `true` when OTP extraction found any code or verification-looking link |
| `source` | `"internal"` \| `"external"` | HMAC mail-stamp classification — fail-closed (see below) |

## `GET /v1/messages/:id?address=x@y`

Full message, including extracted OTP codes and links, plus `source`.

```bash
curl "$API/v1/messages/42?address=fox-k7d2@example.com" \
  -H "Authorization: Bearer $KEY"
# → 200 {"id":"42","from":"noreply@github.com","to":"fox-k7d2@example.com",
#      "subject":"Verify your email","date":"2026-07-26T00:01:00.000Z",
#      "text":"Your code is 482913 …","html":"<p>Your code is …</p>",
#      "otp":{"codes":["482913"],"links":["https://github.com/verify?token=…"]},
#      "links":["https://github.com/verify?token=…"],"source":"external"}
```

`otp.codes` holds short numeric/alphanumeric verification codes found in the body;
`otp.links` holds URLs that look like verification/confirmation links. Both are
best-effort extraction — the raw `text`/`html` are always there as fallback.
`source` uses the same fail-closed stamp check as the list endpoint. Server-stamped
task mail may also include `taskId` / `taskState`.

`source` also appears on `POST /v1/messages/wait` (same detail shape). The
`POST /v1/messages/:id/seen` response is only `{id, seen}` — no `source`.

## `POST /v1/messages/:id/seen`

Mark a message read (`"seen":true`) or unread (`"seen":false`). Reading a
message never changes the flag by itself — agents call this after processing a
message, so the unseen count means "not yet handled". Returns 404 when the
message is not addressed to `address`.

```bash
curl -X POST $API/v1/messages/42/seen \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"address":"fox-k7d2@example.com","seen":true}'
# → 200 {"id":"42","seen":true}
```

## `POST /v1/messages/wait`

Long-poll until a matching message arrives. This is the workhorse for automated
signups: create the identity, trigger the signup, then wait.

```bash
curl -X POST $API/v1/messages/wait \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"address":"fox-k7d2@example.com","subjectContains":"verify","timeoutSec":180}'
```

| Field | Type | Notes |
|---|---|---|
| `address` | string | Identity to watch (required) |
| `fromContains` | string? | Case-insensitive substring match on the sender |
| `subjectContains` | string? | Case-insensitive substring match on the subject |
| `timeoutSec` | number? | Default 120, max 600 |

Success returns the same shape as `GET /v1/messages/:id` (including `otp` and
`source`).
On expiry:

```
408 {"error":"timeout"}
```

Set your HTTP client timeout comfortably above `timeoutSec`.

## `POST /v1/send`

Send from an existing identity. `from` must be an identity you created —
otherwise `403 {"error":"from is not a known identity"}`. Identity tokens may
only send as themselves.

```bash
curl -X POST $API/v1/send \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"from":"fox-k7d2@example.com","to":"friend@example.org",
       "subject":"hello from an agent","text":"sent via openagent.email"}'
# → 200 {"queued":true,"messageId":"<…@example.com>"}
```

| Field | Type | Notes |
|---|---|---|
| `from` | string | An existing identity (required) |
| `to` | string | Recipient (required) |
| `subject` | string | Required |
| `text` | string | Plain-text body (required) |
| `html` | string? | Optional HTML alternative |

Each identity is limited to `SEND_RATE_LIMIT` messages per rolling hour
(default 20). Over the limit:

```
429 {"error":"rate_limited","limit":20,"retryAfterSec":1234}
```

`queued:true` means the mailserver accepted it — not that the recipient's provider
did. Deliverability is your infrastructure's job; see
[deliverability.md](/docs/guides/deliverability/).

## `POST /v1/tasks`

Create a task between two managed identities. The API sends an email with a
private `X-OA-Task` UUID and `X-OA-Task-State: submitted`, then wakes the
recipient's server-side agent route. Task mail is exempt from the ordinary
`SEND_RATE_LIMIT`.

With an identity token, omit `from` and the server uses that identity. Admin
keys must include `from` explicitly.

```bash
curl -X POST $API/v1/tasks \
  -H "Authorization: Bearer $IDENTITY_TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"worker@example.com","subject":"Check staging","body":"Run the smoke test.","wait":true}'
```

| Field | Type | Notes |
|---|---|---|
| `from` | string? | Required only with an admin key; must be a known identity |
| `to` | string | A different known identity on this server |
| `subject` | string | Required task subject |
| `body` | string | Required plain-text instructions |
| `wait` | boolean? | Wait up to 600 seconds for `completed` or `failed` before returning |

Returns `201` with a task object. A wait may return a non-terminal task after
600 seconds; use `GET /v1/tasks/:id?wait=true` again, or poll without `wait`.

## `GET /v1/tasks?state=`

List task threads. Identity tokens see only threads where they are one of the
two participants. Admin keys see all task threads. Optional `state` is one of
`submitted`, `working`, `input-required`, `completed`, or `failed`.

```bash
curl "$API/v1/tasks?state=working" -H "Authorization: Bearer $IDENTITY_TOKEN"
```

## `GET /v1/tasks/:id?wait=true`

Read one task thread, including the email-backed state history and latest JSON
`result` when present. Only a participant or an admin key may read it. Add
`wait=true` to hold the request for up to 600 seconds until a terminal state
appears; a long-lived client can repeat this call with the same task ID.

```bash
curl "$API/v1/tasks/0fdc3207-056e-47c1-a65c-b29d39f66b83?wait=true" \
  -H "Authorization: Bearer $IDENTITY_TOKEN"
```

## `POST /v1/tasks/:id/state`

Advance a task. The API, not the caller, writes the task state headers onto a
new reply in the email thread. `completed` and `failed` are terminal; later
updates return `409 {"error":"task_already_terminal"}`. Concurrent
non-terminal updates use last-writer-wins mailbox order.

```bash
curl -X POST $API/v1/tasks/0fdc3207-056e-47c1-a65c-b29d39f66b83/state \
  -H "Authorization: Bearer $WORKER_TOKEN" -H "Content-Type: application/json" \
  -d '{"state":"completed","body":"Smoke test passed.","result":{"version":"0.4.0","checks":["login","send"]}}'
```

| Field | Type | Notes |
|---|---|---|
| `from` | string? | Required only with an admin key; identity tokens derive it from themselves |
| `state` | string | Required: `submitted`, `working`, `input-required`, `completed`, or `failed` |
| `body` | string? | Optional human-readable update |
| `result` | JSON? | Optional structured result, written as a JSON block in the reply body |

The caller must be one of the task participants. A token for another managed
identity receives `403` even if it knows the UUID.

Ordinary mail-client replies do not reliably retain `X-OA-Task-*` headers, so
they do not advance state and may not appear in this thread view. v0.4 does not
fall back to `References`/`In-Reply-To` and does not expose Message-ID values.
Attachments are not task output in v0.4; use the `result` block instead.

## `X-OA-Mail-Stamp` and message `source`

Outbound mail the API sends may carry an HMAC header `X-OA-Mail-Stamp`. On read,
the API recomputes the stamp over the same field contract (from, to, subject,
date, body hash) and sets message `source`:

| `source` | Meaning |
|---|---|
| `"internal"` | Stamp present and verifies |
| `"external"` | Missing header, bad/mismatched HMAC, missing fields, unparseable mail, or any other uncertainty |

This is **fail-closed**: anything not proven internal is `external`. The stamp
binds envelope fields plus a body digest, so copying a legitimate stamp onto
altered text fails verification.

**Why stamps are not written for every send:** the signing key may fall back to
the SMTP password (`MAIL_PASSWORD` in Compose). An external recipient who
receives a stamped header gets a known-input + HMAC tag pair; when that key is
the SMTP password, the pair enables an offline dictionary attack on the
password. The API therefore writes `X-OA-Mail-Stamp` **only when every `To`
address is on this server's domain**. Mixed or external recipients get no
stamp; when that mail is read back locally it classifies as `external`, which
is intentional.

Treat `source` as a hygiene signal for agents (see
[Reading untrusted mail](/docs/guides/security/#7-reading-untrusted-mail)), not
as a cryptographic security boundary against a hostile MTA.

## `POST /mcp`

Stateless remote MCP transport (MCP 2026-07-28 / SDK v2). Same 15 tools as the
stdio package; no `Mcp-Session-Id`. **POST only** — other methods return `405`
with `Allow: POST`.

Requires `Authorization: Bearer <admin key, oa_… identity token, or OAuth
access token>`. Missing or invalid credentials return `401` plus a
`WWW-Authenticate` challenge that includes a `resource_metadata=` URL pointing
at the PRM document below (unlike `/v1/*`, which returns bare JSON without that
header).

```bash
curl -X POST $API/mcp \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Off loopback, serve this over **https** — the Bearer token is sent on every
request. Optional env `MCP_PUBLIC_URL` overrides the public origin inside the
PRM document when the request host is not the external one (the 401
`resource_metadata=` URL still follows the request origin). Client
`type: http` setup:
[MCP client setup — Remote HTTP](/docs/reference/mcp-clients/#remote-http-connection-type-http).

## `GET /.well-known/oauth-protected-resource`

RFC 9728 Protected Resource Metadata for the MCP resource. **No auth.** The
path-aware twin `GET /.well-known/oauth-protected-resource/mcp` returns the same
document. `authorization_servers` lists the AS issuer; clients continue to
[RFC 8414 metadata](#get-well-knownoauth-authorization-server).

```bash
curl $API/.well-known/oauth-protected-resource
# → 200 {"resource":"http://localhost:3100/mcp","authorization_servers":[…],
#        "scopes_supported":["mcp"],"resource_name":"openagentemail", …}
```

## `GET /.well-known/oauth-authorization-server`

RFC 8414 Authorization Server Metadata. **No auth.** Advertises
`authorization_endpoint` (`/authorize`), `token_endpoint` (`/oauth/token`),
`revocation_endpoint` (`/oauth/revoke`), `code_challenge_methods_supported:
["S256"]`, `authorization_response_iss_parameter_supported: true`, and
`client_id_metadata_document_supported: true` (CIMD; no DCR).

```bash
curl $API/.well-known/oauth-authorization-server
# → 200 {"issuer":"…","authorization_endpoint":"…/authorize",
#        "token_endpoint":"…/oauth/token","revocation_endpoint":"…/oauth/revoke",
#        "code_challenge_methods_supported":["S256"], …}
```

Today the AS is reachable on loopback / your tailnet; public exposure is a
later roadmap item. Web-agent wiring:
[MCP client setup — OAuth web authorization](/docs/reference/mcp-clients/#2-oauth-web-authorization-chatgpt--claude-and-similar).

## `GET /authorize`

OAuth 2.1 authorization entry. Redirects (`302`) to `/ui/oauth/authorize`
(Dashboard cookie path `/ui`). Consent is **admin-session only**: the owner
approves or denies, choosing an existing identity or creating one. Successful
and error redirects back to the client include `iss` (RFC 9207). Clients must
send PKCE S256 and the RFC 8707 `resource` parameter (`{base}/mcp`).

## `POST /oauth/token`

Token endpoint. Supports:

| `grant_type` | Notes |
|---|---|
| `authorization_code` | Requires PKCE S256 verifier, `redirect_uri`, `client_id`, and `resource` |
| `refresh_token` | Rotating refresh — previous refresh token is invalidated; access TTL **1h**, refresh TTL **30d** |

Successful responses include `expires_in=3600` (RFC 6749 §4.2.2). This
service does **not** offer RFC 7662 introspection — treat `401` from
`POST /mcp` as the expiry / revocation signal.

## `POST /oauth/revoke`

RFC 7009 token revocation. The caller must present the token value being
revoked and a `client_id` bound to the issuing grant — mismatch skips the
delete but still returns `200` (no anonymous revoke-by-guess). This endpoint
revokes **one token value only**; with rotating refresh, later descendants
are not traced — for a leak, revoke the whole grant at Dashboard
`/ui/oauth/grants` (see [security.md](/docs/guides/security/#1-three-kinds-of-credentials--keep-the-admin-key-offline)).

## `GET /.well-known/agent-card.json`

Public discovery card using A2A v1.0 vocabulary: a fixed `capabilities` object,
free-form task support in `skills`, and the email entrance in `services`. It is
a discovery shape only, not a claim of A2A wire-protocol compatibility. Add an
already-known managed address as `?address=worker@example.com` to put its
`mailto:` endpoint into the card without enumerating identities.

## `GET /.well-known/agent-registration.json`

Matching HTTP well-known domain-control proof. No auth. Shape:

```json
{
  "version": "1.0",
  "domain": "example.com",
  "agentCard": "https://api.example.com/.well-known/agent-card.json",
  "proof": {
    "type": "http-well-known-domain-control",
    "domain": "example.com"
  }
}
```

## `POST /v1/notify`

Publish a server-side ntfy notification. Agents never provide an ntfy topic or
credential. `target` is `user` or `agent:<identity-localpart>`.

```bash
curl -X POST $API/v1/notify \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"target":"user","title":"Approval needed","message":"Please review the draft","level":"urgent"}'
# → 200 {"target":"user","title":"Approval needed","level":"urgent"}
```

`level` is `urgent`, `normal` (default), or `low`; optional `tags` has at most
five strings. Admin keys may alert the user. An identity token needs its
admin-created `canNotifyUser` grant and is subject to `NOTIFY_RATE_LIMIT`.

## `GET /v1/notify/messages?topic=&since=`

Read cached notification history. `topic` is a logical route: `self`,
`user-alerts`, `user-low`, or `agent:<identity-localpart>`. Identity tokens may
only pass `self` (or their exact own agent route); they cannot read user or
other-agent history.

```bash
curl "$API/v1/notify/messages?topic=self&since=1h" \
  -H "Authorization: Bearer $IDENTITY_TOKEN"
# → 200 {"messages":[{"id":"…","time":…,"title":"…","message":"…","priority":3,"tags":[]}]}
```

## `POST /v1/notify/verify`

Publish a harmless notification check and poll the ntfy cache for it. This is
the same self-check used by `./deploy/doctor.sh`. It has the same permission
rule and independent rate limit as `target:"user"` notifications.

```bash
curl -X POST $API/v1/notify/verify -H "Authorization: Bearer $KEY"
# → 200 {"ok":true}
```

## `POST /v1/notify/devices`

Create a new dedicated read-only ntfy account for one phone. This is an
admin-only setup action; it is not exposed through MCP. The request's public
URL must exactly match the active `NOTIFY_PUBLIC_URL`, which means the HTTPS
reverse proxy and a full stack restart must happen first.

```bash
curl -X POST $API/v1/notify/devices \
  -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"publicUrl":"https://ntfy.example.com"}'
# → 201 {"serverUrl":"https://ntfy.example.com","username":"phone-…",
#        "password":"…","topics":{"userAlerts":"user-alerts-x7k2","userLow":"user-low-x7k2"}}
```

Save the returned password privately. Subscribe the ntfy app to both returned
topics using this one account; it has no access to any agent topic. The
[phone notification guide](/docs/guides/phone-notifications/) has the public
proxy and iOS/Android steps.

## Status codes

| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `401` | Missing/invalid bearer token |
| `403` | Valid token, disallowed action (identity token outside its scope, non-identity `from`, non-admin managing identities) |
| `408` | `wait` timed out |
| `429` | Send rate limit hit — back off `retryAfterSec` |
| `5xx` | Mailserver unreachable or internal error — check `docker compose logs api` |
