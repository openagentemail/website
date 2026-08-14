---
title: Phone notifications
description: Deliver openagent.email alerts to the ntfy app without exposing ntfy directly.
---

Phone delivery is optional. The normal server-side notification loop works
without it. Adding a phone means publishing ntfy through a public **HTTPS**
hostname, so make that choice deliberately.

This guide creates one read-only phone account for the two human channels. It
does not give the phone access to an agent channel, and it does not give agents
an ntfy password or topic name.

## Pair from the dashboard

Once ntfy has a public HTTPS address (step 1 below), the short path is the
built-in dashboard — Add device, scan a QR, revoke if the phone is lost. No
command line.

1. Sign in to `/ui` as the instance admin.
2. Open **Configure → Push & Devices**.
3. Click **Add device**. The server mints a dedicated read-only ntfy account
   and shows a one-time password together with a QR code.
4. Scan the QR in the ntfy app (or type the server URL, username, and
   password). Subscribe to both topics it names — alerts (ring) and low
   (silent).
5. Lost the phone? **Revoke** on that row. The ntfy login for that device is
   deleted and push to it stops immediately.

The CLI and ntfy-app steps below stay as the underlying reference: same public
HTTPS requirement, same two human topics, same read-only phone account. The
dashboard is a shortcut over that path, not a different protocol.

## 1. Give ntfy a public HTTPS address

Pick a separate hostname such as `ntfy.example.com`. Create a DNS `A` record
for it pointing at your server. Keep Docker's ntfy port bound to
`127.0.0.1:2586`; only the reverse proxy should accept public traffic.

Set the exact public origin in `.env` **before pairing a phone**, then restart
the complete stack so ntfy writes it into `server.yml`:

```dotenv
NOTIFY_PUBLIC_URL=https://ntfy.example.com
NTFY_UPSTREAM=true
```

```sh
docker compose down
docker compose up -d
```

If the base URL was wrong when the phone account was created, messages can
arrive but iOS will not ring. Repair it by setting the correct URL, restarting
the stack, and subscribing again in the app.

### Caddy

Caddy obtains and renews the certificate automatically. Its site block can be
as small as:

```text
ntfy.example.com {
  reverse_proxy 127.0.0.1:2586
}
```

### nginx or OpenResty

With nginx or OpenResty, obtain a certificate first (for example with
Certbot), then proxy both normal HTTP and ntfy's WebSocket upgrade:

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 443 ssl http2;
  server_name ntfy.example.com;
  ssl_certificate     /etc/letsencrypt/live/ntfy.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ntfy.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:2586;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

Test the public address before continuing. It must be a trusted `https://`
origin; a LAN address, a raw IP address, or a self-signed certificate is not
enough for iOS push delivery.

## 2. Create the phone reader

Run the guided setup command and choose **Set up phone notifications now?**
when it offers the optional branch:

```sh
npx -y @openagentemail/setup
```

Answer that you have a public HTTPS hostname, enter the same
`NOTIFY_PUBLIC_URL`, confirm that the stack was restarted, and provide an
`API_KEYS` admin key once. Setup creates a new dedicated **read-only** ntfy
account and prints four things to save: server URL, username, password, and two
topic names.

The two printed topics are random-suffixed physical names such as
`user-alerts-x7k2` and `user-low-x7k2`. They are the actual names to subscribe
to; `user-alerts` and `user-low` are only the server's logical channel names.
Do not put the printed password in a ticket, chat, image, or shell history. It
is intentionally not stored by setup. The dashboard path above is the QR
shortcut; this CLI path still prints the four values to save.

If you skip the optional branch, nothing changes. The server-side notification
loop continues to work, and you can run setup again later.

## 3. Add it in the ntfy app

### iPhone and iPad

Install [ntfy](https://apps.apple.com/app/ntfy/id1625396347), add your
self-hosted server URL, and sign in with the dedicated reader account created
above. Subscribe to both topics with that **one** server and user:

- the printed `user-alerts-…` topic: leave alerts enabled (ring);
- the printed `user-low-…` topic: set its alerts to silent.

Leave `NTFY_UPSTREAM=true` if you want iOS alerts. ntfy uses its `ntfy.sh`
upstream for APNs delivery; it is roughly limited to 250 requests per day per
source IP. Set it to `false` only when you deliberately do not need that relay.
A paid relay, PWA, or a custom app is a later option, not part of v0.3.1.

### Android

Install the same ntfy app, add the self-hosted server, sign in with the same
reader, and subscribe to the same two printed topics. Android does not need a
separate server-side setup path.

## What reaches the phone

What the phone shows for mail-arrival alerts depends on that identity's **push
content tier** (default `1` — interrupt only):

| Tier | On the phone |
|---|---|
| `1` (default) | Small alert such as `agent@example.com received new email (contains OTP or verification link)` — no subject, sender, preview, or OTP |
| `2` | Adds **masked** `From` / `Subject` |
| `3` | **Unmasked** `From` / `Subject`, plus body preview and OTP codes/links — that content leaves your server via ntfy |

Admins change the tier with
[`PUT /v1/identities/:address/push-tier`](/docs/reference/api/#put-v1identitiesaddresspush-tier)
(`confirm_risk: true` required for tier `3`). See
[Server-side notifications](/docs/guides/notifications/#mail-arrival-policy).

Agent wake-up topics stay separate: the phone account cannot read or publish
them.

For a lower-level API integration, an admin may call
[`POST /v1/notify/devices`](/docs/reference/api/#post-v1notifydevices). It
requires the active `NOTIFY_PUBLIC_URL` in the request, so it refuses to hand
out a reader before the URL and restarted stack agree.
