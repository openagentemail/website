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
# Feed the bearer header through curl config on stdin so the token stays off argv.
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/identities \
  -H "Content-Type: application/json" \
  --config - \
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl $API/v1/identities --config -
# → 200 {"identities":[{"address":"fox-k7d2@example.com","name":"signup-bot",
#      "createdAt":"2026-07-26T00:00:00.000Z","pushContentTier":1}]}
```

Token hashes are never included in responses.

## `POST /v1/identities/:address/token` — admin only

Rotate an identity's token. The old token stops working immediately; the new
plaintext is returned once.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/identities/fox-k7d2@example.com/token \
  --config -
# → 200 {"address":"fox-k7d2@example.com","token":"oa_…"}
```

## `DELETE /v1/identities/:address` — admin only

Delete an identity (and invalidate its token). Its mail stays in the catch-all
mailbox until the retention sweeper removes it.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X DELETE $API/v1/identities/fox-k7d2@example.com --config -
# → 200 {"deleted":true}
```

## `GET /v1/identities/:address/push-tier`

Read the mail-arrival **push content tier** for one identity. Admin keys may
read any address. An identity token may read **only its own** address
(otherwise `403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl $API/v1/identities/fox-k7d2@example.com/push-tier \
  --config -
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X PUT $API/v1/identities/fox-k7d2@example.com/push-tier \
  -H "Content-Type: application/json" \
  --config - \
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl "$API/v1/messages?address=fox-k7d2@example.com&limit=10" \
  --config -
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl "$API/v1/messages/42?address=fox-k7d2@example.com" \
  --config -
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/messages/42/seen \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"address":"fox-k7d2@example.com","seen":true}'
# → 200 {"id":"42","seen":true}
```

## `POST /v1/messages/wait`

Long-poll until a matching message arrives. This is the workhorse for automated
signups: create the identity, trigger the signup, then wait.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/messages/wait \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"address":"fox-k7d2@example.com","subjectContains":"verify","timeoutSec":180}'
```

| Field | Type | Notes |
|---|---|---|
| `address` | string | Identity to watch (required) |
| `fromContains` | string? | Case-insensitive substring match on the sender |
| `subjectContains` | string? | Case-insensitive substring match on the subject |
| `timeoutSec` | number? | Default 60 (clamped by `MCP_MAX_WAIT_SECONDS`, range 1–600) |

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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/send \
  -H "Content-Type: application/json" \
  --config - \
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
private `X-OA-Task` UUID and `X-OA-Task-State: submitted` (or
`X-OA-Task-State: input-required` for approval tasks), then wakes the
recipient's server-side agent route. Standard tasks start in the `submitted`
state; approval tasks start in `input-required`. Task mail is exempt from the
ordinary `SEND_RATE_LIMIT`.

With an identity token, omit `from` and the server uses that identity. Admin
keys must include `from` explicitly.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/tasks \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"to":"worker@example.com","subject":"Check staging","body":"Run the smoke test.","wait":true}'
```

| Field | Type | Notes |
|---|---|---|
| `from` | string? | Required only with an admin key; must be a known identity |
| `to` | string | A different known identity on this server (becomes reviewer for approval tasks) |
| `subject` | string | Required task subject |
| `body` | string? | Plain-text instructions. Required when `kind !== "approval"`; optional for approval tasks |
| `kind` | string? | Optional task kind; set to `"approval"` for reviewer approval tasks |
| `approval` | object? | Required when `kind === "approval"`. Object with `action` (`{ type, name, arguments }`) and `expiresAt` (ISO 8601 string). `action.type` and `action.name` must be 1–200 chars; serialized `action` JSON must be ≤ 65,536 UTF-8 bytes with nesting depth ≤ 10; `expiresAt` must be in the future and ≤ 30 days ahead |
| `wait` | boolean? | Wait up to 600 seconds for `completed` or `failed` before returning — clamped by `MCP_MAX_WAIT_SECONDS` (default 60) |

Returns `201` with a task object. A wait may return a non-terminal task after
the clamped timeout; use `GET /v1/tasks/:id?wait=true` again, or poll without
`wait`.

Approval task validation errors:
- `400 {"error":"invalid_request"}`: `expiresAt` is missing, invalid, or already in the past.
- `400 {"error":"approval_expiry_too_far"}`: `expiresAt` is more than 30 days in the future.
- `400 {"error":"approval_action_too_large"}`: Serialized `action` JSON exceeds 65,536 bytes.
- `400 {"error":"approval_action_too_deep"}`: `action` nesting depth exceeds 10.

## `GET /v1/tasks?state=`

List task threads. Identity tokens see only threads where they are one of the
two participants. Admin keys see all task threads. Optional `state` is one of
`submitted`, `working`, `input-required`, `completed`, or `failed`.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl "$API/v1/tasks?state=working" --config -
```

## `GET /v1/tasks/:id?wait=true`

Read one task thread, including the email-backed state history and latest JSON
`result` when present. Only a participant or an admin key may read it. Add
`wait=true` to hold the request for up to 600 seconds until a terminal state
appears — clamped by `MCP_MAX_WAIT_SECONDS` (default 60); a long-lived client
can repeat this call with the same task ID.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl "$API/v1/tasks/0fdc3207-056e-47c1-a65c-b29d39f66b83?wait=true" \
  --config -
```

## `POST /v1/tasks/:id/state`

Advance a task. The API, not the caller, writes the task state headers onto a
new reply in the email thread. `completed` and `failed` are terminal; later
updates return `409 {"error":"task_already_terminal"}`. Concurrent
non-terminal updates use last-writer-wins mailbox order.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$WORKER_TOKEN" | \
curl -X POST $API/v1/tasks/0fdc3207-056e-47c1-a65c-b29d39f66b83/state \
  -H "Content-Type: application/json" \
  --config - \
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

## `POST /v1/tasks/:id/decision`

Record an approval or rejection decision for an approval task (`kind: "approval"`).

Only the designated reviewer (`approval.reviewer`, the task's `to` participant)
can decide the task. Among callers authorized to view the task, any non-reviewer
(such as the requester `from`) receives `403 {"error":"forbidden: approval reviewer required"}`.
Unrelated identities not permitted to view the task receive `404 {"error":"not_found"}` to
mask task existence. Identity tokens derive the reviewer identity automatically; admin keys
must include `from` explicitly.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/tasks/0fdc3207-056e-47c1-a65c-b29d39f66b83/decision \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"decision":"approved"}'
```

| Field | Type | Notes |
|---|---|---|
| `from` | string? | Required with an admin key; derived automatically from identity tokens |
| `decision` | string | Required: `"approved"` or `"rejected"` |

Deciding the task transitions it to terminal `completed` state. The decision,
reviewer address, decided timestamp, and action digest are recorded into the
stamped task result block:

```json
{
  "decision": "approved",
  "digest": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "reviewer": "reviewer@example.com",
  "decidedAt": "2026-09-20T06:00:00.000Z"
}
```

Error responses:
- `403 {"error":"forbidden: approval reviewer required"}`: The caller is authorized to view the task but is not the task's designated reviewer (for example, the requester `from`).
- `404 {"error":"not_found"}`: The task does not exist, or the caller is an unrelated identity not permitted to view it.
- `409 {"error":"task_expired"}`: The current time is past `approval.expiresAt`. The task is transitioned to terminal `failed` with result `{"decision":"expired","digest":"...","expiredAt":"..."}`.
- `409 {"error":"task_already_decided"}`: The task has already reached a terminal state (`completed` or `failed`) or is no longer in `input-required`.
- `409 {"error":"not_approval_task"}`: The task was created without `kind: "approval"`.

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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --config - \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Off loopback, serve this over **https** — the Bearer token is sent on every
request. Env `MCP_PUBLIC_URL` sets the canonical public origin for the PRM
document, OAuth issuer / audience, and the 401 `resource_metadata=` URL
(required for public ingress; see
[Exposing MCP publicly](/docs/guides/public-mcp/)). Client `type: http` setup:
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

Loopback / tailnet remains the default. Public AS + `/mcp` ingress is
supported when you set `MCP_PUBLIC_URL` and `OAE_PUBLIC_EDGE=true` — see
[Exposing MCP publicly](/docs/guides/public-mcp/). Web-agent wiring:
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
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/notify \
  -H "Content-Type: application/json" \
  --config - \
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
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl "$API/v1/notify/messages?topic=self&since=1h" \
  --config -
# → 200 {"messages":[{"id":"…","time":…,"title":"…","message":"…","priority":3,"tags":[]}]}
```

## `POST /v1/notify/verify`

Publish a harmless notification check and poll the ntfy cache for it. This is
the same self-check used by `./deploy/doctor.sh`. It has the same permission
rule and independent rate limit as `target:"user"` notifications.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEY" | \
curl -X POST $API/v1/notify/verify --config -
# → 200 {"ok":true}
```

## `POST /v1/notify/devices`

Create a new dedicated read-only ntfy account for one phone. This is an
admin-only setup action; it is not exposed through MCP. The request's public
URL must exactly match the active `NOTIFY_PUBLIC_URL`, which means the HTTPS
reverse proxy and a full stack restart must happen first.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_KEY" | \
curl -X POST $API/v1/notify/devices \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"publicUrl":"https://ntfy.example.com"}'
# → 201 {"serverUrl":"https://ntfy.example.com","username":"phone-…",
#        "password":"…","topics":{"userAlerts":"user-alerts-x7k2","userLow":"user-low-x7k2"}}
```

Save the returned password privately. Subscribe the ntfy app to both returned
topics using this one account; it has no access to any agent topic. The
[phone notification guide](/docs/guides/phone-notifications/) has the public
proxy and iOS/Android steps.

## Webhooks

Outbound webhooks deliver real-time HTTP POST notifications to external endpoints when events occur (such as incoming mail or task approval requests). Webhooks are disabled by default (`WEBHOOKS_ENABLED=false`). When enabled, subscriptions can be created and managed per identity address or globally with an admin key.

All webhook endpoints require `WEBHOOKS_ENABLED=true` in server configuration; when disabled, requests return `404 {"error":"webhooks_disabled"}`. Enabling webhooks additionally requires an explicit `TASK_SIGNING_SECRET` of at least 32 characters; existing installations relying on the fallback to `SMTP_PASS` cannot enable webhooks without setting `TASK_SIGNING_SECRET` explicitly, or server startup will abort with a configuration error. OAuth access tokens may read subscriptions but are forbidden from mutating them or revealing signing secrets (`403`).

## `POST /v1/webhooks`

Create a new webhook subscription.

Identity tokens can only create subscriptions for their own scoped email address (`address`) with `contentScope: "metadata"`. Admin keys can create subscriptions for any address and can specify `contentScope: "preview"`. Subscriptions targeting private IP ranges require `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` on the server and must be created with an admin key.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"url":"https://example.com/webhook","address":"agent@example.com","events":["mail.received","approval.requested"]}'
# → 201 {"id":"whk_01h7x8a...","url":"https://example.com/webhook","address":"agent@example.com",
#        "events":["mail.received","approval.requested"],"contentScope":"metadata","description":"",
#        "state":"unverified","secret":"whs_0123456789abcdef...","secretPrefix":"whs_0123…",
#        "signatureScheme":"v1","timestampToleranceSec":300,"createdAt":"2026-09-20T06:00:00.000Z"}
```

| Field | Type | Notes |
|---|---|---|
| `url` | string | Destination HTTPS URL (max 2048 chars). Must use `https:` (or `http:` with `WEBHOOK_ALLOW_PRIVATE_TARGETS=true`), cannot contain query string, fragment, or userinfo, port must be in `WEBHOOK_ALLOWED_PORTS` (default 443), and hostname must resolve to a permitted IP address. |
| `address` | string | Email address of the managed identity to observe. |
| `events` | string[] | Non-empty array of unique event names: `mail.received`, `approval.requested`. |
| `contentScope` | string? | `'metadata'` (default) or `'preview'`. `'preview'` requires an admin key. |
| `description` | string? | Optional description (max 1000 chars, default `""`). |

Headers:
- `Idempotency-Key` (optional): Client idempotency token (max 128 chars). Replays return the cached response with `secret: null`.

Limits:
- Server capacity is governed by `WEBHOOK_MAX_SUBSCRIPTIONS` (default 16 server-wide) and `WEBHOOK_MAX_PER_ADDRESS` (default 4 per address). Exceeding these returns `409 {"error":"webhook_limit_reached"}`.
- Rate-limited by `WEBHOOK_RATE_CREATE_PER_MIN` (default 10 requests per minute).
- Upon creation, the server derives an endpoint signing secret (`whs_...`) and automatically dispatches an initial asynchronous ping delivery (`webhook.ping`) with `trigger: "creation"` to verify destination reachability.

Validation errors:
- `400 {"error":"invalid_webhook_url"}`: URL syntax or configuration violation (non-HTTPS without private target authorization, userinfo present, query string or fragment present, port not in `WEBHOOK_ALLOWED_PORTS`, or IP literal without private target authorization).
- `400 {"error":"webhook_target_forbidden"}`: Target IP address resolves to a forbidden or non-private destination.

Note: The creation response (and rotation response) is the only place where the plaintext signing `secret` is returned automatically without an explicit secret request. Authorized callers (admin or the identity creator for `metadata` scope) can retrieve the secret at any time via `GET /v1/webhooks/:id/secret`. List and detail queries return only `secretPrefix`.

## `GET /v1/webhooks`

List webhook subscriptions. Identity tokens return only subscriptions bound to their own address. Admin keys return all subscriptions across all addresses, or can filter by passing `?address=`.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl $API/v1/webhooks --config -
# → 200 {"webhooks":[{"id":"whk_01h7x8a...","url":"https://example.com/webhook","address":"agent@example.com",
#        "events":["mail.received","approval.requested"],"contentScope":"metadata","description":"",
#        "state":"unverified","disabledReason":null,"secretPrefix":"whs_0123…","signatureScheme":"v1",
#        "timestampToleranceSec":300,"createdAt":"2026-09-20T06:00:00.000Z","updatedAt":"2026-09-20T06:00:00.000Z",
#        "rotatedAt":null,"consecutiveFailures":0,"privateTargetGranted":false,"lastDelivery":null}]}
```

## `GET /v1/webhooks/:id`

Retrieve details for a single webhook subscription. The caller must be an admin key or an identity token bound to the subscription's `address`.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl $API/v1/webhooks/whk_01h7x8a... --config -
# → 200 {"id":"whk_01h7x8a...","url":"https://example.com/webhook","address":"agent@example.com",
#        "events":["mail.received","approval.requested"],"contentScope":"metadata","description":"",
#        "state":"enabled","disabledReason":null,"secretPrefix":"whs_0123…","signatureScheme":"v1",
#        "timestampToleranceSec":300,"createdAt":"...","updatedAt":"...","rotatedAt":null,
#        "consecutiveFailures":0,"privateTargetGranted":false,
#        "lastDelivery":{"deliveryId":"dlv_...","ts":"...","attempt":1,"outcome":"success",
#                        "status":200,"durationMs":42,"reason":null}}
```

Returns `404 {"error":"not_found"}` if the webhook does not exist.

## `POST /v1/webhooks/:id`

Update an existing webhook subscription's configuration. The caller must be an admin key or the identity owner of `address`. OAuth tokens are forbidden (`403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a... \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"events":["mail.received"],"description":"Production alerts"}'
# → 200 {"id":"whk_01h7x8a...", ...}
```

| Field | Type | Notes |
|---|---|---|
| `url` | string? | New destination URL (max 2048 chars; subject to the same protocol, port, syntax, and IP constraints as creation). |
| `events` | string[]? | New non-empty list of event types. |
| `contentScope` | string? | `'metadata'` or `'preview'`. Changing to `'preview'` requires an admin key. |
| `description` | string? | New description string. |

Updating `url` executes static and DNS SSRF verification. If the target URL changes:
- `consecutiveFailures` is reset to 0.
- Unless manually disabled (`disabledReason: "manual"`), the subscription state resets to `unverified` and `disabledReason` is cleared.
- An asynchronous verification ping is dispatched to the new destination if the subscription is not in the `disabled` state (manually paused subscriptions remain disabled and do not fire a ping; subscriptions disabled by threshold or rejection are reset to `unverified` and trigger the ping).
- If the subscription already has `contentScope: "preview"`, non-admin identity callers cannot change `url` (`403 {"error":"content_scope_requires_admin"}`).

## `DELETE /v1/webhooks/:id`

Delete a webhook subscription. The caller must be an admin key or the identity that created the subscription (`createdBy === auth.address`) with `contentScope: "metadata"`. OAuth tokens are forbidden (`403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X DELETE $API/v1/webhooks/whk_01h7x8a... --config -
# → 200 {"ok":true}
```

Deleting a subscription cancels queued pending deliveries in storage and prevents future retries. In-flight HTTP attempts already underway are not aborted and may still reach the receiver, but their results will not trigger further retries.

## `GET /v1/webhooks/:id/secret`

Reveal the active HMAC signing secret for a subscription. Requires an admin key or the identity that created the subscription (`createdBy === auth.address`) with `contentScope: "metadata"`. OAuth tokens are forbidden (`403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl $API/v1/webhooks/whk_01h7x8a.../secret --config -
# → 200 {"id":"whk_01h7x8a...","secret":"whs_0123456789abcdef...","secretPrefix":"whs_0123…",
#        "epoch":0,"overlapUntil":null}
```

The response includes `Cache-Control: no-store` to prevent caching of sensitive credentials.

## `POST /v1/webhooks/:id/rotate`

Rotate the signing secret to a new epoch. Increments `epoch` by 1 and generates a new secret.

Requires an admin key or the creating identity with `contentScope: "metadata"`. OAuth tokens are forbidden (`403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a.../rotate \
  -H "Content-Type: application/json" \
  --config - \
  -d '{"force":false}'
# → 200 {"id":"whk_01h7x8a...","epoch":1,"secret":"whs_9876543210fedcba...",
#        "secretPrefix":"whs_9876…","overlapUntil":"2026-09-21T06:00:00.000Z"}
```

Dual-signing overlap:
- `overlapUntil` is set to current time plus `WEBHOOK_ROTATION_OVERLAP_MS` (default `86400000` ms = 24 hours).
- During this overlap window, all outgoing deliveries carry signatures for **both** the new epoch and the preceding epoch in the `X-OAE-Signature` header (`v1=<new>,v1=<prev>`).
- If a rotation window is already open, further rotations fail with `409 {"error":"rotation_window_open","overlapUntil":"..."}` unless `force: true` is passed.
- Supports optional `Idempotency-Key` header (replays return cached response with `secret: null`).

## `POST /v1/webhooks/:id/test`

Send an immediate test probe delivery (`webhook.ping`) to verify endpoint health and signature configuration.

Requires an admin key or the identity owner of `address`. OAuth tokens are forbidden (`403`). Cannot be called if the subscription is disabled (`409 {"error":"webhook_disabled"}`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a.../test --config -
# → 200 {"deliveryId":"dlv_01h...","outcome":"success","status":200,"reason":null}
```

The test delivery sends a `webhook.ping` event with `data.trigger: "test"`. Ping attempts are capped at 3 attempts (`MAX_PING_ATTEMPTS = 3`). Test probes are rate-limited by `WEBHOOK_RATE_TEST_PER_MIN` (default 3 per minute; returns `429` when exceeded).

## `POST /v1/webhooks/:id/disable`

Manually pause an enabled webhook subscription. Pausing a subscription cancels queued pending deliveries in storage and prevents future retries. In-flight HTTP attempts already underway are not aborted and may still reach the receiver, but their results will not trigger further retries.

Requires an admin key or the creating identity. OAuth tokens are forbidden (`403`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a.../disable --config -
# → 200 {"ok":true,"state":"disabled","disabledReason":"manual"}
```

This operation is idempotent: if the subscription is already disabled, it returns `200` with the existing state and reason without re-modifying the record.

## `POST /v1/webhooks/:id/enable` — admin only

Resume a disabled webhook subscription. **Admin only** (`403` for identity tokens).

The subscription must currently be disabled; calling this on an enabled subscription returns `409 {"error":"webhook_not_disabled"}`.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_KEY" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a.../enable --config -
# → 200 {"ok":true,"state":"unverified"}
```

Resuming resets `consecutiveFailures` to 0, sets `state: "unverified"`, clears `disabledReason`, and immediately dispatches an asynchronous ping to verify destination reachability.

## `GET /v1/webhooks/:id/deliveries` — admin only

Inspect the historical delivery log for a webhook subscription. **Admin only** (`403` for non-admin).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_KEY" | \
curl "$API/v1/webhooks/whk_01h7x8a.../deliveries?limit=20" --config -
# → 200 {"deliveries":[{"deliveryId":"dlv_01h...","ts":"...","webhookId":"whk_...","eventId":"evt_...",
#                      "type":"mail.received","attempt":1,"outcome":"success","status":200,
#                      "durationMs":45,"nextAttemptAt":null,"reason":null}]}
# (nextCursor appears only when more results follow)
```

| Parameter | Type | Notes |
|---|---|---|
| `limit` | integer? | Number of records to return (1 to 100, default 20). |
| `cursor` | string? | Opaque cursor token for forward pagination (max 1024 chars). An invalid cursor—or a cursor pointing to a record evicted from the memory index—returns `400 {"error":"invalid_cursor"}` (callers must restart pagination from the first page without a cursor). |

The response returns `{"deliveries": [...]}`. When additional pages remain, the response includes `nextCursor` as an opaque string token. When no more pages follow, `nextCursor` is omitted entirely rather than returned as `null`.

## `POST /v1/webhooks/deliveries/:deliveryId/redeliver` — admin only

Manually replay a historical delivery attempt. **Admin only** (`403` for non-admin).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_KEY" | \
curl -X POST $API/v1/webhooks/deliveries/dlv_01h.../redeliver --config -
# → 200 {"ok":true,"deliveryId":"dlv_02j...","eventId":"evt_01h..."}
```

The server fetches the referenced delivery record, checks that the target webhook subscription is not disabled, retrieves the underlying email message or task approval, and enqueues a new delivery job preserving the original `eventId`.

Possible errors:
- `404 {"error":"delivery_not_found"}`: Delivery record does not exist in the active delivery log index (either an unknown delivery ID or evicted from memory when log volume exceeds `WEBHOOK_LOG_MAX_ROWS`, default **100,000**; evicted records persist on disk but cannot be queried or replayed via the API).
- `404 {"error":"webhook_not_found"}`: Associated webhook subscription was deleted.
- `404 {"error":"message_not_found"}`: Underlying mail message is no longer in storage. *(Note: If the underlying approval task is missing during replay, the server currently raises an unmapped error resulting in `500 {"error":"internal_error"}` rather than `task_not_found`).*
- `409 {"error":"webhook_disabled"}`: Webhook subscription is currently disabled.
- `409 {"error":"delivery_not_replayable"}`: Delivery record cannot be replayed.
- `409 {"error":"stale_message_generation"}`: IMAP mailbox generation UIDVALIDITY changed since original delivery.
- `409 {"error":"uidvalidity_required"}`: Historical delivery row lacks UIDVALIDITY tracking required for safe mailbox replay.

## Webhook signature verification

All outbound HTTP delivery POST requests include the `X-OAE-Signature` header. Receivers must verify this signature to confirm that requests originated from openagent.email and were not altered or delayed.

### Header format

```text
X-OAE-Signature: t=<unix-timestamp>,v1=<signature-hex>[,v1=<additional-signature-hex>]
```

- `t`: Integer Unix timestamp in seconds (`Math.floor(Date.now() / 1000)`) representing when the signature was created.
- `v1`: Lower-case hexadecimal HMAC-SHA256 signature calculated over the payload. If secret rotation or root key migration is in progress, multiple comma-separated `v1=` signatures are included.

### Verification procedure

1. **Extract timestamp and signatures**: Parse the `X-OAE-Signature` header by splitting on commas. Extract the integer `t` value and all `v1` signature strings. If `t` or `v1` is missing, reject the request.
2. **Check timestamp tolerance**: Compute `|nowSec - t|`. If the difference exceeds `WEBHOOK_TIMESTAMP_TOLERANCE_SEC` (default **300 seconds** / 5 minutes), reject the request as expired (`timestamp_out_of_range`) to defend against replay attacks.
3. **Construct signed payload**: Concatenate the string `t`, a literal dot `.`, and the raw UTF-8 request body bytes:
   ```text
   signedPayload = `${t}.${rawRequestBody}`
   ```
   **Do not** parse or re-serialize JSON before verifying; the exact raw wire body bytes must be used.
4. **Compute HMAC-SHA256**:
   - The signing key is the exact 68-character ASCII string of the displayed secret (`whs_<64-hex>`). The `whs_` prefix is part of the HMAC key body (`Buffer.from(secret, 'utf8')`).
   - Calculate `HMAC-SHA256(key=signingKey, data=signedPayload)` and format as a lower-case hexadecimal string.
5. **Constant-time comparison**: Compare the computed hex digest against each candidate `v1=` signature using a constant-time comparison function (such as Node.js `crypto.timingSafeEqual`). If any signature matches, the request is authentic.

```javascript
import crypto from 'node:crypto';

function verifySignature({ header, rawBody, secret, toleranceSec = 300 }) {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.trim());
  let t = null;
  const signatures = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') t = parseInt(v, 10);
    else if (k === 'v1') signatures.push(v);
  }
  if (!t || signatures.length === 0) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - t) > toleranceSec) return false;

  const signedPayload = `${t}.${rawBody}`;
  const signingKey = Buffer.from(secret, 'utf8');
  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(signedPayload, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  return signatures.some((sig) => {
    const candidateBuf = Buffer.from(sig, 'utf8');
    return (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    );
  });
}
```

## Webhook delivery semantics

### Event types

The webhook subsystem dispatches three distinct event types:

1. `mail.received`: Dispatched when new incoming mail arrives at a managed mailbox over IMAP. Includes sender, recipients, subject, message ID, flags, and size. When `contentScope: "preview"` is enabled (admin only), text snippet previews, extracted security codes, and links are included.
2. `approval.requested`: Dispatched when a task with `kind: "approval"` is submitted targeting the reviewer identity. Carries task ID, state (`input-required`), requester, reviewer, action type/name, expiration timestamp, and `actionArguments`. Note that `actionArguments` is only included for subscriptions configured with `contentScope: "preview"` (admin-only) subject to size and depth bounds; default `metadata` subscriptions never include it.
3. `webhook.ping`: Diagnostic ping sent when creating a subscription, changing its destination URL, or executing a manual test probe (`trigger: "creation"` or `trigger: "test"`).

### Retry schedule and backoff

Delivery outcomes determine whether failures are retried automatically:

- **Retryable failures**: Network errors, connection timeouts, HTTP `408`, HTTP `429`, and HTTP `5xx` responses are classified as `retryable` and are retried automatically on a deterministic backoff ladder.
- **Permanent failures (no retry)**: HTTP `3xx` redirects (`redirect_forbidden`), responses exceeding `WEBHOOK_RESPONSE_MAX_BYTES` (`response_too_large`), and client errors (all other HTTP `4xx` codes, such as `400`, `401`, `403`, or `404`) are classified as `permanent` failures. They are recorded directly to dead-letter storage and **are never retried**.
- **Idempotency requirement**: Because retry attempts and manual redeliveries dispatch with the original stable `eventId`, receivers **must deduplicate deliveries idempotently by event ID**.

- **11 attempts across 72 hours**: Non-ping events are attempted up to 11 times (`MAX_RETRY_SCHEDULE_ATTEMPTS = 11`, `WEBHOOK_MAX_ATTEMPTS = 11`) spanning a 72-hour horizon (`RETRY_HORIZON_SEC = 259200`).
- **Cumulative attempt offsets**:
  - Attempt 1: Immediate (`0s`)
  - Attempt 2: `+5s`
  - Attempt 3: `+5m` (`300s`)
  - Attempt 4: `+30m` (`1,800s`)
  - Attempt 5: `+2h` (`7,200s`)
  - Attempt 6: `+5h` (`18,000s`)
  - Attempt 7: `+10h` (`36,000s`)
  - Attempt 8: `+20h` (`72,000s`)
  - Attempt 9: `+34h` (`122,400s`)
  - Attempt 10: `+48h` (`172,800s`)
  - Attempt 11: `+72h` (`259,200s`, pinned)
- **Ping cap**: `webhook.ping` deliveries are capped at 3 attempts (`MAX_PING_ATTEMPTS = 3`: immediate, +5s, +5m).
- **Jitter**: Each retry interval is randomized by **±10% non-cumulative jitter** applied to the gap between consecutive steps (`gap * (rand() * 0.2 - 0.1)`). Attempt 11 is pinned to exactly +72h unjittered.
- **HTTP 429 Retry-After**: If the remote server returns HTTP `429` with a valid `Retry-After` header between 1 and 3600 seconds, the delivery engine respects the delay and clamps the next attempt into the schedule.

### Circuit breaker and automatic disablement

- Each subscription maintains a `consecutiveFailures` counter.
- If consecutive delivery attempts fail and reach `WEBHOOK_DISABLE_THRESHOLD` (default **10**), the circuit breaker trips:
  - The subscription is automatically disabled: `state: "disabled"`, `disabledReason: "threshold"`.
  - All remaining queued deliveries for this subscription are discarded.
- To recover, an administrator must call `POST /v1/webhooks/:id/enable` (or update the endpoint URL via `POST /v1/webhooks/:id`). Enabling resets `consecutiveFailures` to 0, transitions state to `unverified`, and fires a creation test ping.

### SSRF protection and network constraints

- **Connection-time DNS pinning**: Webhook deliveries use socket-level connection hooks (`pinnedFetch`). The target hostname is resolved at connect time, and every returned IP is verified against blocked private, loopback, link-local, and multicast CIDRs. This neutralizes DNS-rebinding Time-of-Check to Time-of-Use (TOCTOU) exploits.
- **Redirects forbidden**: HTTP `3xx` redirects are unconditionally rejected (`redirect_forbidden`) to prevent endpoints from pivoting into internal network assets.
- **Allowed ports**: Destination ports are restricted by `WEBHOOK_ALLOWED_PORTS` (default `443` only).
- **Private network targets**: Delivering to private IP addresses (RFC 1918 / loopback) is blocked by default. It requires server setting `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` (default `false`) and must be explicitly authorized with an admin key.

### Bounded payloads and timeouts

- **Payload ceiling**: Outbound webhook request bodies are capped at `WEBHOOK_PAYLOAD_MAX_BYTES` (default **16,384 bytes** / 16 KiB). If a payload exceeds this limit, fields are shed in deterministic order per event type before failing closed (`payload_too_large`):
  - **`mail.received`**: In `preview` scope, drops `links` → `securityCodes` → `textPreview`; then across both scopes empties `cc` (`[]`) → `to` (`[]`) → `subject` (`""`) → drops `from.name`.
  - **`approval.requested`**: In `preview` scope, drops `actionArguments` first (dropped whole); then across both scopes empties `subject` (`""`).
  - If the envelope still exceeds the limit after shedding droppable fields, delivery fails closed.
- **Approval argument bounds**: In `approval.requested` events, action arguments are bounded by `WEBHOOK_APPROVAL_ARGS_MAX_BYTES` (default **4,096 bytes**) and maximum JSON nesting depth `WEBHOOK_APPROVAL_ARGS_MAX_DEPTH` (default **4**).
- **Timeouts and buffers**: Remote endpoint responses are capped at `WEBHOOK_RESPONSE_MAX_BYTES` (default **4,096 bytes**) to prevent buffer exhaustion. Each delivery attempt has a wall-clock timeout of `WEBHOOK_DELIVERY_TIMEOUT_MS` (default **10,000 ms** / 10 seconds).
- **Concurrency**: Delivery dispatching is throttled by per-subscription and process-wide worker concurrency pools (`WEBHOOK_MAX_CONCURRENT` default 8).

## Status codes

| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `401` | Missing/invalid bearer token |
| `403` | Valid token, disallowed action (identity token outside its scope, non-identity `from`, non-admin managing identities) |
| `408` | `wait` timed out |
| `429` | Send rate limit hit — back off `retryAfterSec` |
| `5xx` | Mailserver unreachable or internal error — check `docker compose logs api` |
