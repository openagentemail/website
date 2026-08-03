---
title: REST API reference
description: Every endpoint — identities, messages, wait-for-mail, OTP extraction, send.
---

Base URL: `http://localhost:3100` (the compose stack binds the API to
localhost by default — see [security.md](/docs/guides/security/) for reaching it
remotely).

All endpoints except `GET /healthz` require a bearer token:

```
Authorization: Bearer <admin key or identity token>
```

Two token kinds (details in [security.md](/docs/guides/security/)):

- **Admin key** (from the `API_KEYS` env) — full access, every endpoint below.
- **Identity token** (`oa_…`, returned by `POST /v1/identities`) — scoped to
  one address: only the `messages`/`wait`/`send` endpoints, and only for its
  own address. Anything else returns `403`.

Failures return `401 {"error":"unauthorized"}` for bad tokens. Examples below
assume:

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
# → 201 {"address":"fox-k7d2@example.com","name":"signup-bot","token":"oa_…"}
```

| Field | Type | Notes |
|---|---|---|
| `name` | string? | Free-form label for the identity |
| `localpart` | string? | Force a specific address, e.g. `billing` → `billing@example.com` |
| `canNotifyUser` | boolean? | Admin-granted permission for this identity to call `notify_user` and `notify_verify` |

## `GET /v1/identities` — admin only

```bash
curl $API/v1/identities -H "Authorization: Bearer $KEY"
# → 200 {"identities":[{"address":"fox-k7d2@example.com","name":"signup-bot","createdAt":"2026-07-26T00:00:00.000Z"}]}
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

## `GET /v1/messages?address=x@y&limit=50`

List an identity's inbox, newest first. `limit` defaults to 50.
Identity tokens may only list their own address.

```bash
curl "$API/v1/messages?address=fox-k7d2@example.com&limit=10" \
  -H "Authorization: Bearer $KEY"
# → 200 {"messages":[{"id":"42","from":"noreply@github.com","to":"fox-k7d2@example.com",
#      "subject":"Verify your email","date":"2026-07-26T00:01:00.000Z","seen":false,
#      "snippet":"Confirm your address by clicking…"}]}
```

## `GET /v1/messages/:id?address=x@y`

Full message, including extracted OTP codes and links.

```bash
curl "$API/v1/messages/42?address=fox-k7d2@example.com" \
  -H "Authorization: Bearer $KEY"
# → 200 {"id":"42","from":"noreply@github.com","to":"fox-k7d2@example.com",
#      "subject":"Verify your email","date":"2026-07-26T00:01:00.000Z",
#      "text":"Your code is 482913 …","html":"<p>Your code is …</p>",
#      "otp":{"codes":["482913"],"links":["https://github.com/verify?token=…"]}}
```

`otp.codes` holds short numeric/alphanumeric verification codes found in the body;
`otp.links` holds URLs that look like verification/confirmation links. Both are
best-effort extraction — the raw `text`/`html` are always there as fallback.

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

Success returns the same shape as `GET /v1/messages/:id` (including `otp`).
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

## `GET /.well-known/agent-card.json`

Public discovery card using A2A v1.0 vocabulary: a fixed `capabilities` object,
free-form task support in `skills`, and the email entrance in `services`. It is
a discovery shape only, not a claim of A2A wire-protocol compatibility. Add an
already-known managed address as `?address=worker@example.com` to put its
`mailto:` endpoint into the card without enumerating identities.

`GET /.well-known/agent-registration.json` provides the matching HTTP
well-known domain-control proof.

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

## Status codes

| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `401` | Missing/invalid bearer token |
| `403` | Valid token, disallowed action (identity token outside its scope, non-identity `from`, non-admin managing identities) |
| `408` | `wait` timed out |
| `429` | Send rate limit hit — back off `retryAfterSec` |
| `5xx` | Mailserver unreachable or internal error — check `docker compose logs api` |
