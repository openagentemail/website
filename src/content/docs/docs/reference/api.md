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

### Caller list rate limit

`GET /v1/messages` admits **60 requests per rolling 60 seconds per
authenticated caller** — the ordinary list and `since` share the same bucket.
Over the limit:

```
429 {"error":"rate_limited","retryAfterSec":41}
```

The response carries an integer `Retry-After` header with the same value.

- **Identity key.** The bucket is keyed by the authenticated address,
  lower-cased — not the raw token and not the `address` query parameter. An
  identity's token and its OAuth credentials share one budget, and a delegating
  caller spends its own budget regardless of which mailbox it targets. All admin
  credentials share a single `list:admin` bucket; admin is not exempt.
- **Admission order.** Query-schema and ACL failures (`400`, `401`, `403`) do not
  spend budget. Admission happens synchronously before the first IMAP call, and
  downstream failures — including a rejected opaque `since` cursor or an IMAP
  error — are not refunded.
- **Burst.** Up to 60 requests may be admitted back-to-back; the 61st inside the
  same window is `429`.
- **Process-local.** The window is in-process monotonic time and resets when the
  API restarts. At most 10,000 caller buckets are tracked (60 live stamps each);
  expired buckets are reclaimed lazily, only when a new caller would exceed that
  cap. A new caller rejected at full capacity gets a conservative
  `retryAfterSec: 60` — admission then is not guaranteed.
- **Not a global guard.** This is a per-caller request-rate bound, not IMAP
  concurrency or exhaustion protection. Message detail, wait, and Dashboard
  reads are not covered by this bucket, and multiple instances do not share it —
  the deployment contract assumes a single instance.
- **Independent.** It does not change the existing send, MCP, or wait buckets.

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
| `approval` | object? | Required when `kind === "approval"`. Object with `action` (`{ type, name, arguments }`) and `expiresAt` (RFC 3339 timestamp with explicit `Z` or timezone offset). `action.type` and `action.name` must be 1–200 chars; serialized `action` JSON must be ≤ 65,536 UTF-8 bytes with nesting depth ≤ 10; `expiresAt` must be in the future and ≤ 30 days ahead |
| `wait` | boolean? | Wait up to 600 seconds for `completed` or `failed` before returning — clamped by `MCP_MAX_WAIT_SECONDS` (default 60) |

Returns `201` with a task object. A wait may return a non-terminal task after
the clamped timeout; use `GET /v1/tasks/:id?wait=true` again, or poll without
`wait`.

Approval task validation errors:
- `400 {"error":"invalid_request"}`: `expiresAt` is missing, lacks an explicit timezone offset (must include `Z` or numeric offset like `+00:00`), is invalid, or is already in the past.
- `400 {"error":"approval_expiry_too_far"}`: `expiresAt` is more than 30 days in the future.
- `400 {"error":"approval_action_too_large"}`: Serialized `action` JSON exceeds 65,536 bytes.
- `400 {"error":"approval_action_too_deep"}`: `action` nesting depth exceeds 10.

Wait-path failure codes:

| Stage | Status | `body` | Meaning |
|---|---|---|---|
| Not created, no task ID returned | `502` | `{error:"smtp_error"}` (no `taskId`) | SMTP or validation failed on the create path — **no task ID is returned**; an ID-less error is *not* proof the message was never accepted (see the note below) |
| Created, journal error | `503` | `{error:"lease_journal_*", taskId, created:true}` | Task **exists**; the lease journal is unavailable |
| Created, other wait-stage error | `502` | `{error:"wait_failed", taskId, created:true}` | Task **exists**; the wait did not complete |
| Wait slots full | `429` | `{error:"too_many_waits", retryAfterSec, taskId}` | Task **exists**; read it later with `GET /v1/tasks/:id` (MCP `task_get`) |

Monitoring note: on a `502`, the presence or absence of `taskId` is what distinguishes
pre-creation from post-creation failures (no new metric or log field is added). An error
without a `taskId` is **not** proof that SMTP never accepted the task: reconcile your task
list before attempting another create (the API deliberately performs no automatic POST retry).

Lease and state mutation fallback:

| Stage | Status | `body` | Meaning |
|---|---|---|---|
| `POST /v1/tasks/:id/{claim,lease,release,claim-lost,decision,state}` and the console task-mutation path, when a failure is not mapped to a domain error | `502` | `{error:"task_operation_failed"}` (no `taskId`) | These paths **do deliver mail during the write stage** (lease-journal delivery, approval-terminal delivery, remind, update notification), so an SMTP delivery failure is **one possible cause** — but the same code also covers unmapped/internal failures. The previous `smtp_error` label attributed all of them to SMTP alone. Mapped domain errors keep their own codes and statuses. |

Monitoring note: this fallback carries **no** `taskId`, so on these routes the pre/post-create `taskId` test above does not apply; the server-side `console.warn` on the mutate paths is the primary attribution aid — **except** on `/lease` (renew) and `/release`, which log only static messages without the underlying exception, so for those two routes the response alone cannot distinguish an SMTP failure from an internal one.

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
non-terminal updates use last-writer-wins mailbox order. Approval tasks
(`kind: "approval"`) cannot be advanced through this endpoint; they must use
`POST /v1/tasks/:id/decision`. Calling this endpoint on an approval task returns
`409 {"error":"approval_decision_required"}`.

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

Error responses:
- `403 {"error":"forbidden: task participant required"}`: The caller is not a participant in the task thread.
- `404 {"error":"not_found"}`: The task does not exist.
- `409 {"error":"approval_decision_required"}`: The task is an approval task (`kind: "approval"`). Approval tasks cannot be advanced through this endpoint; use `POST /v1/tasks/:id/decision`.
- `409 {"error":"task_already_terminal"}`: The task has already reached terminal `completed` or `failed`.

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
- `409 {"error":"task_already_decided"}`: The task has already reached a terminal state (`completed` by a prior decision, or `failed` for reasons other than expiry) or is no longer in `input-required`. Tasks materialized to `failed` due to expiry continue to return `task_expired` rather than `task_already_decided`.
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

Stateless remote MCP transport (MCP 2026-07-28 / SDK v2). Exposes the same tool
set as the stdio package (see [MCP client setup — Tools your agent gets](/docs/reference/mcp-clients/#tools-your-agent-gets)
for the authoritative tool table); no `Mcp-Session-Id`. **POST only** — other
methods return `405` with `Allow: POST`.

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

> **How to read this section**
>
> **Who this section is for.** There is nothing to compile or deploy to receive webhooks. This section is for developers integrating a webhook receiver into an application; you do not need to read the server source. Every *Normative* statement below is generated from, and cited against, the implementation.
>
> **Normative vs Explanatory layers:**
> - **Normative**: Formal interface contracts (endpoints, request/response fields, event types, configuration defaults, and wire error codes). Where documentation and implementation conflict, the Normative layer and actual server behavior govern.
> - **Explanatory**: Observable behavior descriptions and receiver guidance. This layer describes externally visible outcomes and is non-normative.
>
> **Authorization premise (applies to all endpoints below).** Unless stated otherwise, every authorization statement in this section describes tokens **without** a persisted `scopes` array — unscoped identity tokens and OAuth tokens derived from unscoped identities. Scope-carrying tokens (an identity token with a `scopes` array — even an empty one — or an OAuth token whose identity has one) are default-denied: the server's operation-policy table (`OPERATION_POLICIES`) defines no webhook operations, so every `/v1/webhooks*` request from such a token is rejected with `403 {"error":"forbidden: insufficient_scope"}` — **including read-only requests**.

Outbound webhooks deliver real-time HTTP POST notifications to external endpoints when events occur (such as incoming mail or task approval requests). Webhooks are disabled by default (`WEBHOOKS_ENABLED=false`). When enabled, subscriptions can be created and managed per identity address or globally with an admin key.

Business events are dispatched only to subscriptions whose `events` list includes the event type and that are not in the `disabled` state at dispatch time; diagnostic pings (`webhook.ping`) are dispatched regardless of the `events` list. A delivery already queued (including its retries) or manually redelivered is gated by the subscription state only, so removing the event type from `events` afterwards does not stop it. A successful delivery attempt from the `unverified` state transitions the subscription to `enabled`.

Webhook endpoints require `WEBHOOKS_ENABLED=true` in server configuration; when disabled, requests return `404 {"error":"webhooks_disabled"}`. Enabling webhooks additionally requires an explicit `TASK_SIGNING_SECRET` of at least 32 characters; existing installations relying on the fallback to `SMTP_PASS` cannot enable webhooks without setting `TASK_SIGNING_SECRET` explicitly, or server startup will abort with a configuration error. OAuth access tokens may read subscriptions but are forbidden from mutating them or revealing signing secrets (`403`).

## `POST /v1/webhooks`

Create a new webhook subscription.

Identity tokens can only create subscriptions for their own scoped email address (`address`) with `contentScope: "metadata"`. Admin keys can create subscriptions for any address and can specify `contentScope: "preview"`. Subscriptions targeting private IP ranges require `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` on the server, `OAE_PUBLIC_EDGE=false`, and must be created with an admin key.

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
| `url` | string | Destination HTTPS URL (max 2048 chars). Must use `https:` (or `http:` with private target authorization), cannot contain query string, fragment, or userinfo, port must be in `WEBHOOK_ALLOWED_PORTS` (default 443), and hostname must resolve to a permitted IP address. |
| `address` | string | Email address of the managed identity to observe. |
| `events` | string[] | Non-empty array of unique event names: `mail.received`, `approval.requested`. |
| `contentScope` | string? | `'metadata'` (default) or `'preview'`. `'preview'` requires an admin key. |
| `description` | string? | Optional description (max 1000 chars, default `""`). |

Headers:
- `Idempotency-Key` (optional): Client idempotency token (max 128 chars). Replays return the cached response with `secret: null`.

Limits:
- Server capacity is governed by `WEBHOOK_MAX_SUBSCRIPTIONS` (default 16 server-wide) and `WEBHOOK_MAX_PER_ADDRESS` (default 4 per address). Exceeding these returns `409 {"error":"webhook_limit_reached"}`.
- Rate-limited by `WEBHOOK_RATE_CREATE_PER_MIN` (default 10 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).
- Upon creation, the server derives an endpoint signing secret (`whs_...`) and automatically dispatches an initial asynchronous ping delivery (`webhook.ping`) with `trigger: "creation"` to verify destination reachability. This ping shares the `WEBHOOK_RATE_TEST_PER_MIN` bucket with `POST /v1/webhooks/:id/test`. When that bucket is exhausted at creation or retarget time, the ping is queued for a delayed re-check (`WEBHOOK_POOL_RETRY_MS`, default 5000 ms); it is attempted over HTTP if the bucket has capacity by then, and is recorded with `reason: "probe_rate_limited"` (no HTTP attempt) only if the bucket is still exhausted at that re-check.

Valid destination quick reference:
Target URLs are evaluated against a three-tier validation ladder before acceptance:
1. **Protocol and syntax constraints**: Destination URLs must be valid URLs (max 2048 characters) without query strings (`?`), fragments (`#`), or user credentials (`user:pass@`). The port must be explicitly listed in `WEBHOOK_ALLOWED_PORTS` (default `443` only). The hostname must be a DNS hostname; IP literals are forbidden unless private targets are enabled.
2. **Private target authorization**: Targeting private IP addresses (RFC 1918, CGNAT `100.64.0.0/10`, loopback, or IPv6 ULA `fd00::/8`) requires server configuration `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` **and** `OAE_PUBLIC_EDGE=false` (when `OAE_PUBLIC_EDGE=true`, private targets are disabled server-wide regardless of `WEBHOOK_ALLOW_PRIVATE_TARGETS`). Furthermore, private-target subscriptions must be created or updated with an **admin key** (identity callers attempting to target private addresses receive `400 {"error":"webhook_target_forbidden"}`).
3. **HTTP scheme constraints**: The `http:` scheme is permitted **only** when private targets are allowed as above, and requires **every** resolved IP address of the target hostname to be private or loopback. If any resolved IP is public, the endpoint is rejected with `webhook_target_forbidden`.

Validation errors:
- `400 {"error":"invalid_request","details":[...]}`: Payload schema validation failed before destination resolution (for example, malformed URL syntax, URL length exceeding 2048 characters, or missing required fields).
- `400 {"error":"invalid_webhook_url"}`: URL resolution failed after passing schema validation (unsupported scheme, userinfo, query string, fragment, port not in `WEBHOOK_ALLOWED_PORTS`, or DNS lookup failure).
- `400 {"error":"webhook_target_forbidden"}`: Target IP address violates SSRF policy, or an unprivileged identity attempted to configure a private network target, or an HTTP endpoint resolved to non-private addresses.

Note: The creation response (and rotation response) is the only place where the plaintext signing `secret` is returned automatically without an explicit secret request. Authorized callers (admin or the identity creator for `metadata` scope) can retrieve the secret at any time via `GET /v1/webhooks/:id/secret`. List and detail queries return only `secretPrefix`.

*(Outbound event payload contracts and delivery semantics are documented in the delivery-semantics slice).*

## `GET /v1/webhooks`

List webhook subscriptions. Identity tokens return subscriptions bound to their own address. Admin keys return subscriptions across addresses, or can filter by passing `?address=`.

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl $API/v1/webhooks --config -
# → 200 {"webhooks":[{"id":"whk_01h7x8a...","url":"https://example.com/webhook","address":"agent@example.com",
#        "events":["mail.received","approval.requested"],"contentScope":"metadata","description":"",
#        "state":"unverified","disabledReason":null,"secretPrefix":"whs_0123…","signatureScheme":"v1",
#        "timestampToleranceSec":300,"createdAt":"2026-09-20T06:00:00.000Z","updatedAt":"2026-09-20T06:00:00.000Z",
#        "rotatedAt":null,"consecutiveFailures":0,"privateTargetGranted":false,"lastDelivery":null}]}
```

Rate-limited by the shared webhook read bucket (also used by subscription detail and delivery-log reads; `WEBHOOK_RATE_CREATE_PER_MIN`, default 10 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).

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

Returns `404 {"error":"not_found"}` if the webhook does not exist. Rate-limited by the shared webhook read bucket (also used by the subscription list and delivery-log reads; `WEBHOOK_RATE_CREATE_PER_MIN`, default 10 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).

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
| `events` | string[]? | Non-empty array of unique event names: `mail.received`, `approval.requested`. |
| `contentScope` | string? | `'metadata'` or `'preview'`. Changing to `'preview'` requires an admin key. |
| `description` | string? | Optional description (max 1000 chars). |

The update payload schema is evaluated with `.strict()`; unrecognized fields return `400 {"error":"invalid_request","details":[...]}`. Rate-limited by `WEBHOOK_RATE_CREATE_PER_MIN` (default 10 requests per minute per caller, shared with subscription creation; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).

Updating `url` executes static and DNS SSRF verification. If the target URL changes:
- `consecutiveFailures` is reset to 0.
- Unless manually disabled (`disabledReason: "manual"`), the subscription state resets to `unverified` and `disabledReason` is cleared.
- An asynchronous verification ping is dispatched to the new destination if the subscription is not in the `disabled` state (manually paused subscriptions remain disabled and do not fire a ping; subscriptions disabled by threshold or rejection are reset to `unverified` and trigger the ping). This ping shares the `WEBHOOK_RATE_TEST_PER_MIN` bucket with `POST /v1/webhooks/:id/test`. When that bucket is exhausted at creation or retarget time, the ping is queued for a delayed re-check (`WEBHOOK_POOL_RETRY_MS`, default 5000 ms); it is attempted over HTTP if the bucket has capacity by then, and is recorded with `reason: "probe_rate_limited"` (no HTTP attempt) only if the bucket is still exhausted at that re-check.
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
- `overlapUntil` is set to the current time plus `WEBHOOK_ROTATION_OVERLAP_MS` (default `86400000` ms = 24 hours) only when `WEBHOOK_ROTATION_OVERLAP_MS > 0`. When configured to `0`, `overlapUntil` is `null`.
- Endpoint-rotation dual signing occurs only while an active overlap window is open (`overlapUntil` is non-null and the current server timestamp is before `overlapUntil`): during this window, outgoing deliveries add a signature for the preceding epoch in the `X-OAE-Signature` header (`v1=<new>,v1=<prev>`).
- Root-key rotation is an independent second signature source: when `WEBHOOK_SIGNING_SECRET_PREVIOUS` is configured, every outgoing delivery additionally carries a signature derived from that previous root signing key, regardless of `overlapUntil`.
- The two mechanisms compose, so the `X-OAE-Signature` header carries 1, 2, or 3 `v1=` signatures: 1 when neither is active, 2 when exactly one is active (a configured previous root key, or an open overlap window), 3 when both are active. If `WEBHOOK_ROTATION_OVERLAP_MS` is `0`, `overlapUntil` is `null` and the endpoint-rotation signature is omitted, but a configured previous root key still adds its signature.
- If an active rotation window is already open, further rotations fail with `409 {"error":"rotation_window_open","overlapUntil":"..."}` unless `force: true` is passed.
- Supports optional `Idempotency-Key` header (replays return cached response with `secret: null`).
- Rate-limited by an independent rotation bucket (`WEBHOOK_RATE_TEST_PER_MIN`, default 3 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).

## `POST /v1/webhooks/:id/test`

Send an immediate test probe delivery (`webhook.ping`) to verify endpoint health and signature configuration.

Requires an admin key or the identity owner of `address`. OAuth tokens are forbidden (`403`). Cannot be called if the subscription is disabled (`409 {"error":"webhook_disabled"}`).

```bash
printf 'header = "Authorization: Bearer %s"\n' "$IDENTITY_TOKEN" | \
curl -X POST $API/v1/webhooks/whk_01h7x8a.../test --config -
# → 200 {"deliveryId":"dlv_01h...","outcome":"success","status":200,"reason":null}
```

The test delivery sends a `webhook.ping` event with `data.trigger: "test"`. Ping attempts are capped at `MAX_PING_ATTEMPTS` attempts (default 3, scheduled at base offsets: immediate, +5s, +5m). Retry times are jittered by up to ±10% of the gap between consecutive offsets, and a valid `Retry-After` on a `429` response can delay the next attempt further. Test probes are rate-limited by `WEBHOOK_RATE_TEST_PER_MIN` (default 3 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded).

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

Resuming resets `consecutiveFailures` to 0, sets `state: "unverified"`, clears `disabledReason`, and immediately dispatches an asynchronous ping to verify destination reachability. This ping shares the `WEBHOOK_RATE_TEST_PER_MIN` bucket with `POST /v1/webhooks/:id/test`. When that bucket is exhausted at enable time, the ping is queued for a delayed re-check (`WEBHOOK_POOL_RETRY_MS`, default 5000 ms); it is attempted over HTTP if the bucket has capacity by then, and is recorded with `reason: "probe_rate_limited"` (no HTTP attempt) only if the bucket is still exhausted at that re-check.

## `GET /v1/webhooks/:id/deliveries` — admin only

Inspect the historical delivery log for a webhook subscription. **Admin only** (`403` for non-admin). Rate-limited by the shared webhook read bucket (also used by the subscription list and detail reads; `WEBHOOK_RATE_CREATE_PER_MIN`, default 10 requests per minute per caller; returns `429 {"error":"rate_limited","retryAfterSec":...}` when exceeded). The read-rate check runs before the admin check, so an over-limit caller may receive `429` instead of `403`.

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
| `cursor` | string? | Opaque cursor token for forward pagination (max 1024 chars). An unknown or stale cursor (including one whose row was evicted from the in-memory index) returns `400 {"error":"invalid_cursor"}` (callers must restart pagination from the first page without a cursor). |

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
- `404 {"error":"message_not_found"}`: Underlying mail message is no longer in storage.
- `404 {"error":"task_not_found"}`: Underlying approval task is no longer available for replay.
- `404 {"error":"missing_task_id"}`: Historical delivery row lacks the approval task ID required for replay.
- `500 {"error":"internal_error"}`: Unexpected server error during replay (unmapped failure).
- `409 {"error":"webhook_disabled"}`: Webhook subscription is currently disabled.
- `409 {"error":"delivery_not_replayable"}`: Delivery record cannot be replayed.
- `409 {"error":"stale_message_generation"}`: IMAP mailbox generation UIDVALIDITY changed since original delivery.
- `409 {"error":"uidvalidity_required"}`: Historical delivery row lacks UIDVALIDITY tracking required for safe mailbox replay.

## Webhook signature verification

Outbound HTTP delivery POST requests include the `X-OAE-Signature` header. Receivers must verify this signature to confirm that requests originated from openagent.email and were not altered or delayed.

### Header format

> **Layer:** Normative — generated from, and cited against, the implementation.

```text
X-OAE-Signature: t=<unix-timestamp>,v1=<signature-hex>[,v1=<additional-signature-hex>[,v1=<additional-signature-hex>]]
```

- `t`: Integer Unix timestamp in seconds (`Math.floor(Date.now() / 1000)`) representing when the signature was created.
- `v1`: Lower-case hexadecimal HMAC-SHA256 signature calculated over the payload. If secret rotation or root key migration is in progress, multiple comma-separated `v1=` signatures are included (up to three: the current signature plus the previous epoch and previous root-key signatures during rotation overlap).

### Verification procedure

> **Layer:** Explanatory — observable behaviour only; not normative.

1. **Extract timestamp and signatures**: Parse the `X-OAE-Signature` header by splitting on commas. Extract the integer `t` value and candidate `v1` signature strings. If `t` or `v1` is missing, reject the request.
2. **Check timestamp tolerance**: Compute `|nowSec - t|`. If the difference exceeds your configured tolerance — the server's `WEBHOOK_TIMESTAMP_TOLERANCE_SEC` (default **300 seconds** / 5 minutes) is a reasonable baseline — reject the request as expired (`timestamp_out_of_range`) to defend against replay attacks. (Within the tolerance window a replayed request still verifies; receivers should also deduplicate events by `id` — see the webhook delivery semantics section.)
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
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === 't') {
      if (/^(?:0|[1-9]\d*)$/.test(v)) {
        const parsed = Number(v);
        if (Number.isSafeInteger(parsed)) t = parsed;
      }
    } else if (k === 'v1' && v.length > 0) {
      signatures.push(v);
    }
  }
  if (t === null || signatures.length === 0) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - t) > toleranceSec) return false;

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const signedPayload = `${t}.${body}`;
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

### Outbound envelope

> **Layer:** Normative — generated from, and cited against, the implementation.

Outbound webhook delivery HTTP POST requests carry a JSON body consisting of five standardized envelope fields wrapping event-specific `data`:

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable event identifier (prefixed `evt_`). Retried attempts and manual redeliveries of the same event retain this exact `id`. |
| `type` | string | Event type identifier: `'mail.received'`, `'approval.requested'`, or `'webhook.ping'`. |
| `payloadVersion` | string | Wire schema format version (`'v1'`). |
| `createdAt` | string | ISO 8601 UTC timestamp recording when the event was generated on the server. |
| `domain` | string | Server domain originating the delivery. |
| `data` | object | Event-specific data object containing the event payload fields. |

### Event types

> **Layer:** Normative — generated from, and cited against, the implementation.

The webhook subsystem dispatches event types defined by `WebhookEventType`:

1. `mail.received`: Dispatched when incoming mail arrives at a managed mailbox over IMAP. The `data` object includes `object` (`"mail"`), `address`, `messageId`, `cursor`, `uid`, `uidValidity` (nullable), `receivedAt`, `from` (`{ address }`, or `{ address, name }` when the sender display name is present), `to`, `cc`, `subject`, `sizeBytes`, `hasAttachments`, `unread`, `containsSecurityCode`, and `containsLink`. When `contentScope: "preview"` is enabled (admin only), `textPreview`, `securityCodes`, and `links` are included when present.
2. `approval.requested`: Dispatched when a task with `kind: "approval"` is submitted targeting the reviewer identity. The `data` object includes `object` (`"approval"`), `taskId`, `taskState` (`"input-required"`), `from`, `to`, `reviewer`, `subject`, `createdAt`, `expiresAt`, `expiresInSec` (nullable), `digest`, `actionType`, and `actionName`. When `contentScope: "preview"` is enabled (admin only), `actionArguments` is included subject to size and depth bounds; default `metadata` subscriptions do not include it.
3. `webhook.ping`: Diagnostic ping sent when creating a subscription, re-enabling a disabled subscription, changing its destination URL, or executing a manual test probe (`trigger: "creation"` or `trigger: "test"`). Changing the URL of a subscription that remains disabled (manually paused, `disabledReason: "manual"`) leaves it disabled and does not send a ping. The `data` object includes `object` (`"webhook"`), `webhookId`, and `trigger`.

### Retry schedule and backoff

> **Layer:** Normative — generated from, and cited against, the implementation.

Delivery outcomes determine whether failures are retried automatically:

- **Retryable failures**: Network errors, connection timeouts, HTTP `408`, HTTP `429`, and HTTP `5xx` responses are classified as `retryable` and are retried automatically on a deterministic backoff ladder.
- **Permanent failures (no retry)**: HTTP `3xx` redirects (`redirect_forbidden`), responses exceeding `WEBHOOK_RESPONSE_MAX_BYTES` (`response_too_large`), and client errors (HTTP `4xx` responses, including `400`, `401`, `403`, and `404`, excluding `408` and `429`) are classified as `permanent` failures. They are recorded directly to dead-letter storage and are not retried automatically.
- **Idempotency requirement**: Because retry attempts and manual redeliveries dispatch with the original stable top-level event `id`, receivers **must deduplicate deliveries idempotently by this `id`**.

- **Retry horizon and attempts**: Non-ping events are attempted up to `MAX_RETRY_SCHEDULE_ATTEMPTS` (default `11` attempts, governed by `WEBHOOK_MAX_ATTEMPTS`) spanning a 72-hour horizon (`RETRY_HORIZON_SEC = 259200`). The 11th attempt is pinned to the horizon boundary itself, and a job waking after that boundary is recorded as `retry_horizon_exceeded` without an HTTP delivery. After a process restart, pending deliveries are re-evaluated against the horizon using the original event's generation time; in particular, a manual redelivery of an event generated more than 72 hours earlier is recorded as `retry_horizon_exceeded` without an HTTP delivery.
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
  - Attempt 11: `+72h` (`259,200s`, pinned at the horizon boundary; normally not delivered — see the retry-horizon note above)
- **Ping cap**: `webhook.ping` deliveries are capped at `MAX_PING_ATTEMPTS` attempts (default `3`: immediate, +5s, +5m).
- **Jitter**: Each attempt's cumulative offset is shifted by **±10% non-cumulative jitter** of that step's nominal gap (`gap * (rand() * 0.2 - 0.1)`); adjacent attempts jitter independently, so the interval between two consecutive attempts can deviate from its nominal length by more than ±10%. Attempt 11 is pinned to exactly +72h unjittered.
- **HTTP 429 Retry-After**: If the remote server returns HTTP `429` with a valid `Retry-After` header between 1 and 3600 seconds, the delivery engine respects the delay and clamps the next attempt into the schedule. (The retry scheduled by a manual test probe (`POST /v1/webhooks/:id/test`) is an exception: it uses the base ping offsets and does not apply `Retry-After`.)

### Circuit breaker and automatic disablement

> **Layer:** Explanatory — observable behaviour only; not normative.

- Each subscription maintains a `consecutiveFailures` counter, reset to 0 by a successful delivery attempt.
- **Failures counting toward circuit breaking**: Qualifying delivery attempts resulting in `retryable` or `permanent` outcomes increment `consecutiveFailures` (`refused`, `deferred`, and `pending` outcomes do not increment the counter). Diagnostic pings (`webhook.ping`) follow two rules:
  - A ping failure while the subscription is in the `unverified` state does not increment the counter (preventing initial setup and validation probes from tripping the breaker).
  - A ping failure with a permanent outcome does not increment the counter, regardless of subscription state. A retryable ping failure on an enabled subscription increments the counter and can advance the subscription toward threshold disablement.
- If consecutive qualifying delivery attempts fail and reach `WEBHOOK_DISABLE_THRESHOLD` (default **10**), the circuit breaker trips:
  - The subscription is automatically disabled (state: `"disabled"`, disabledReason: `"threshold"`). Deliveries already queued are not discarded: when a queued delivery wakes, it checks the subscription state and exits without sending if the subscription is still disabled. If the subscription has been re-enabled by the time it wakes, that delivery is sent. (Queue preservation applies within a single process run: after a restart, a pending delivery whose subscription is still disabled at boot is recorded as `webhook_disabled` without delivery, even if the subscription is re-enabled later.)
- **Immediate disablement on `refused` attempts**: A delivery attempt whose target resolves to a blocked address range is classified `refused` (`ssrf_refused`) and disables the subscription immediately (state: `"disabled"`, disabledReason: `"refused"`), without waiting for the `consecutiveFailures` threshold. Manual test probes and redeliveries follow the same rule.
- To recover a disabled subscription:
  - **Resume without URL change (`POST /v1/webhooks/:id/enable`)**: Admin only (`403` for identity callers). Calling this resets `consecutiveFailures` to 0, sets `state: "unverified"`, clears `disabledReason`, and dispatches an asynchronous ping.
  - **Update destination URL (`POST /v1/webhooks/:id`)**: Available to an admin key or the identity owner of `address` (admin-only for subscriptions that already have `contentScope: "preview"`; identity callers receive `403 {"error":"content_scope_requires_admin"}`). Changing `url` on a subscription disabled by threshold (`disabledReason: "threshold"`) resets `consecutiveFailures` to 0, transitions state to `unverified`, clears `disabledReason`, and fires a verification ping. (Subscriptions manually paused with `disabledReason: "manual"` remain disabled when updating `url`).

### SSRF protection and network constraints

> **Layer:** Explanatory — observable behaviour only; not normative.

- **Connection-time DNS pinning**: Webhook deliveries pin resolved IP addresses at connection time. The target hostname is resolved when connecting, and each returned IP address is verified against blocked private, loopback, link-local, and multicast ranges. This neutralizes DNS-rebinding Time-of-Check to Time-of-Use (TOCTOU) risks.
- **Redirects forbidden**: HTTP `3xx` redirects are rejected (`redirect_forbidden`) to prevent endpoints from pivoting into internal network assets.
- **Allowed ports**: Destination ports are restricted by `WEBHOOK_ALLOWED_PORTS` (default `443` only).
- **Private network targets**: Delivering to private IP addresses (RFC 1918 / loopback) is blocked by default. It requires server setting `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` (default `false`), `OAE_PUBLIC_EDGE=false`, and must be authorized with an admin key.

### Bounded payloads and timeouts

> **Layer:** Normative — generated from, and cited against, the implementation.

- **Payload ceiling**: Outbound webhook request bodies are capped at `WEBHOOK_PAYLOAD_MAX_BYTES` (default **16,384 bytes** / 16 KiB). If a payload exceeds this limit, fields are shed in deterministic order per event type before failing closed (`payload_too_large`):
  - **`mail.received`**: In `preview` scope, drops `links` → `securityCodes` → `textPreview`; then across both scopes empties `cc` (`[]`) → `to` (`[]`) → `subject` (`""`) → drops `from.name`.
  - **`approval.requested`**: In `preview` scope, drops `actionArguments` first (dropped whole); then across both scopes empties `subject` (`""`).
  - If the envelope still exceeds the limit after shedding droppable fields, delivery fails closed.
- **Approval argument bounds**: In `approval.requested` events, action arguments are bounded by `WEBHOOK_APPROVAL_ARGS_MAX_BYTES` (default **4,096 bytes**) and maximum JSON nesting depth `WEBHOOK_APPROVAL_ARGS_MAX_DEPTH` (default **4**).
- **Timeouts and buffers**: Remote endpoint responses are capped at `WEBHOOK_RESPONSE_MAX_BYTES` (default **4,096 bytes**) to prevent buffer exhaustion. Each delivery attempt has a wall-clock timeout of `WEBHOOK_DELIVERY_TIMEOUT_MS` (default **10,000 ms** / 10 seconds).
- **Concurrency**: Delivery dispatching admits at most one in-flight attempt per subscription, and at most `WEBHOOK_MAX_CONCURRENT` (default 8) attempts in flight process-wide.

## Status codes

> **Layer:** Normative — generated from, and cited against, the implementation.

| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `401` | Missing/invalid bearer token |
| `403` | Valid token, disallowed action (identity token outside its scope, non-identity `from`, non-admin managing identities) |
| `408` | `wait` timed out |
| `429` | Rate limit hit — send, message-list, or task-wait slots; back off `retryAfterSec` |
| `5xx` | Mailserver unreachable or internal error — check `docker compose logs api` |
