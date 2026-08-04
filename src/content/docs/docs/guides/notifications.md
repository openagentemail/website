---
title: Server-side notifications
description: Use the built-in ntfy transport to alert people and wake locally managed agents.
---

openagent.email v0.3 includes a private
[ntfy](https://ntfy.sh/) service inside the Docker stack. It is an
**interrupt channel**, not another mailbox: agents still read mail through the
normal protected API, while a notification only says that action may be needed.

The default is a server-only loop. It supports `notify_verify`, manual
agent/user notifications, and mail-arrival alerts without opening ntfy to the
internet. [Phone delivery](/docs/guides/phone-notifications/) is optional and
uses a separate public HTTPS hostname. Webhooks are not part of this feature.

## Bring it up safely

`.env.example` includes the required values:

```dotenv
NTFY_ENABLED=true
NOTIFY_PUBLIC_URL=http://127.0.0.1:2586
NTFY_UPSTREAM=true
NTFY_ADMIN_PASSWORD=replace-with-openssl-rand-hex-24
```

`NTFY_ADMIN_PASSWORD` stays between Docker and the server. It is not returned
by the API and must never go in an agent's MCP configuration. Protect the whole
file before starting the stack:

```bash
chmod 600 .env
docker compose up -d
./deploy/doctor.sh
```

The doctor calls `POST /v1/notify/verify`: it publishes a harmless check and
polls it back from ntfy's cache. The ntfy port is bound to `127.0.0.1:2586` by
default. Keep it that way in v0.3.

Setting `NTFY_ENABLED=false` turns off notification API operations and the mail
watcher, but the ntfy container still runs. This is intentional for v0.3: the
fixed Compose graph is simpler and costs about 20 MB RAM. Set
`NTFY_UPSTREAM=false` if you do not want ntfy to forward unknown topics to
`ntfy.sh`.

## Topics, without leaking topics to agents

The server creates random-suffixed physical topics, for example:

| Logical route | Example physical topic | Who can use it |
| --- | --- | --- |
| `user-alerts` | `user-alerts-x7k2` | server-side human alerts |
| `user-low` | `user-low-x7k2` | server-side low-priority human alerts |
| `agent:<localpart>` | `agent-qa-bot-x7k2` | the matching agent route |

The suffix and all ntfy tokens are stored only in the server's private JSON
state. MCP clients use `notify_user` and `notify_agent` and never receive a
topic name or ntfy credential. ntfy is deny-by-default: the server publisher is
write-only, while reserved reader accounts are read-only. The optional phone
setup creates one separate read-only account for the two human topics; it has
no access to an agent route. Creating an identity in a running stack creates
its reader account and route before the API returns the new identity, and also
records it for the next ntfy restart.

Phone setup prints a password and the two random-suffixed human topic names.
Treat them as credentials: do not paste them into a ticket, chat transcript,
image, or shell history. v0.3.1 deliberately does not generate a QR code.

## Who may interrupt whom

`notify_user` is deliberately stronger than normal mail operations. An admin
key may use it. An identity token needs that identity to be created with
`canNotifyUser: true`, and it has its own `NOTIFY_RATE_LIMIT` rolling-hour
budget (default 10). It does not share the email send limit.

An identity may read notification history only for its own route:

```text
identity qa-bot@example.com -> GET /v1/notify/messages?topic=self
```

The server maps `self` to `agent:qa-bot`. Trying to read `agent:other-agent`,
`user-alerts`, or `user-low` returns `403`, even if the caller guesses their
logical names.

## Mail arrival policy

`PUSH_POLICY=otp` is the default: a new message causes a notification only when
the server finds an OTP code or verification link. Set `all` for every new
message, or `none` to disable the watcher.

The payload is deliberately small — for example, `qa-bot@example.com received
new email (contains OTP or verification link)`. It never includes the sender,
subject, preview, or code. Mail from outside your own managed identities can
alert the user, but it can **never** wake an `agent:<localpart>` route. The
IMAP watcher only publishes to human topics; an agent wake-up is emitted only
after the API has accepted a server-authenticated send to another managed
identity. That boundary does not depend on email text or attacker-controlled
headers.

## API and MCP

The REST shapes are in the [API reference](/docs/reference/api/). The MCP
package exposes four matching operations:

- `notify_user(title, message, level?, tags?)`
- `notify_agent(name, title, message, level?, tags?)`
- `notify_check(since?)`
- `notify_verify()`

Levels map to ntfy priority conservatively: `urgent` → priority 5,
`normal` → 3, and `low` → 1. For user alerts, `urgent` and `normal` use the
normal human-alert route; `low` uses the separate low-priority route.
