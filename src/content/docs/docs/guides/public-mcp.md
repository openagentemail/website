---
title: Exposing MCP publicly
description: Three tracks for opening /mcp and OAuth — stay private, Cloudflare optional fronting, or a bare reverse proxy.
---

Self-hosted openagent.email already speaks remote MCP (`POST /mcp`) and OAuth
on whatever network you give it. **Nothing here requires Cloudflare.** The
open-source server is feature-complete with zero CF bindings; orange-cloud
fronting is only one deployment preference (the shape we use for our own
hosted edge). Pick the track that matches how far you want the API to travel.

Related reading:
[Security guide](/docs/guides/security/) (tokens, localhost binding) ·
[MCP client setup — Remote HTTP](/docs/reference/mcp-clients/#remote-http-connection-type-http).

## Track 0 — stay private (default)

If every MCP client lives on the same host, an SSH tunnel, WireGuard, or a
Tailscale/headscale tailnet, **do not open a public hostname.** Keep the
compose bind on `127.0.0.1:3100` (or `API_BIND` only on the private interface).
Leave `OAE_PUBLIC_EDGE` unset/`false` and skip `MCP_PUBLIC_URL`.

This is the secure default. Tracks 1 and 2 below are for operators who
*choose* to let web agents (ChatGPT / Claude connectors and similar) reach the
Authorization Server and `/mcp` from the public internet.

## Public deployment — required env (tracks 1 and 2)

Any public ingress — Cloudflare, nginx, Caddy, or something else — must set
both:

| Variable | Value | Why |
|---|---|---|
| `MCP_PUBLIC_URL` | Canonical public origin, e.g. `https://mcp.example.com` (no trailing path) | OAuth issuer, token audience, PRM `resource`, and the 401 `WWW-Authenticate` `resource_metadata=` URL all follow this origin |
| `OAE_PUBLIC_EDGE` | `true` | Closes CIMD’s private-network fetch exception (draft -01 MUST). Permanent denylist stays: `169.254/16`, `0.0.0.0/8`, `fd00:ec2::/16`, `fe80::/10` |

Also tune (or accept the defaults):

| Variable | Default | Notes |
|---|---|---|
| `MCP_MAX_WAIT_SECONDS` | `60` (clamp 1–600) | Server-side cap for blocking waits (`mail_wait_for`, task waits). Aligns with common edge read timeouts (Cloudflare Free/Pro proxy read timeout is **100s**) |
| `TRUST_PROXY_HEADERS` | `false` | Set `true` **only** when a reverse proxy **overwrites or strips** client-supplied `X-Forwarded-For`. Then the app trusts the first XFF hop as client IP for pre-auth rate limits |
| `OAUTH_RATE_PER_MIN` | `30` | Pre-auth per-IP bucket on OAuth routes |
| `MCP_PREAUTH_RATE_PER_MIN` | `120` | Pre-auth per-IP bucket on unauthenticated `/mcp` (401 challenge path). Authenticated traffic uses the existing per-token read/write buckets (60/20) |

Audit events land in `audit.jsonl` (authorize / token / revoke / MCP writes with
grant attribution). OAuth consent remains **owner-approved** in the Dashboard
(`/ui/oauth/authorize`) — public exposure does not weaken that gate.

## Track 1 — recommended: Cloudflare in front (optional)

Copy the shape we run for hosted traffic. CF is a **deployment option**, not a
product dependency — skip this track entirely if you prefer Track 2.

1. **DNS** — move the zone’s nameservers to Cloudflare (a single hostname
   cannot migrate NS by itself unless it is its own zone). Keep mail / MX /
   existing grey-cloud records as they are.
2. **Orange-cloud only the MCP hostname** — e.g. `mcp.example.com` → your
   origin; leave every other record grey-cloud unless you deliberately want
   it proxied.
3. **Origin TLS = Let’s Encrypt (not Cloudflare Origin CA)** — Origin CA
   certificates are trusted only by Cloudflare. If you ever flip the record to
   DNS-only (grey) as a fallback, browsers and agents hitting the origin
   directly will fail TLS. Let’s Encrypt stays valid on both paths.
4. **WAF custom rule — skip Bot Fight Mode** on `/mcp` and `/oauth/*`. Bot
   Fight / Bot Fight Mode precursors routinely classify MCP clients as bots;
   that is a measured footgun, not a theory.
5. **Timeouts** — Free/Pro proxy **read timeout is 100s**. Keep
   `MCP_MAX_WAIT_SECONDS` at the default `60` (or lower). Clients that need
   longer waits should poll / re-call rather than hold one request open.
6. **`Mcp-*` request headers must pass through** — MCP 2026-07-28 uses headers
   such as `Mcp-Method` / `Mcp-Name`. If **any** hop (CF WAF transform, nginx
   `proxy_set_header` wipe, corporate proxy) strips `Mcp-*`, the session fails
   hard. Verify with a real client and include this check in the same WAF rule
   pass as Bot Fight skip.

Origin still terminates with your normal reverse proxy (OpenResty/nginx/Caddy)
→ `127.0.0.1:3100`. On the API set:

```bash
MCP_PUBLIC_URL=https://mcp.example.com
OAE_PUBLIC_EDGE=true
TRUST_PROXY_HEADERS=true   # only if that origin proxy overwrites/strips client XFF
```

Same XFF hard prerequisite as Track 2: the hop that talks to the API must
**overwrite or strip** client-supplied `X-Forwarded-For` before you enable
`TRUST_PROXY_HEADERS`. Otherwise leave it `false` and per-IP buckets key on
the TCP peer (often the local proxy).

What CF buys you on this track (and what you lose if you grey-cloud fallback):
managed WAF rulesets, edge DDoS, IP hiding, optional edge rate limit. The
**application-layer** pre-auth and per-token buckets remain the real floor —
they keep working when the orange cloud is off.

## Track 2 — direct reverse proxy (no Cloudflare)

Expose `/mcp`, OAuth, and discovery yourself. You keep full control and accept
the edge risk yourself.

### What you give up vs Track 1

- No managed edge DDoS absorption — volumetric abuse hits your VPS first
- Origin IP is visible in public DNS
- No hosted WAF / Bot Fight layer — you own the rules
- Application-layer rate limits (`OAUTH_RATE_*` / `MCP_PREAUTH_*` / per-token)
  become your primary brake

### Hard prerequisite for `TRUST_PROXY_HEADERS`

Before setting `TRUST_PROXY_HEADERS=true`, the proxy **must overwrite or strip
client-supplied `X-Forwarded-For`**. Append-only XFF lets a client rotate
spoofed first hops and evaporate per-IP buckets. If you cannot guarantee that
rewrite, leave `TRUST_PROXY_HEADERS=false` (limits then key on the direct TCP
peer — usually the proxy itself).

### nginx / OpenResty example

Same vhost shape as the
[`/ui`-only example in the security guide](/docs/guides/security/#2-dont-expose-the-api-port),
expanded for MCP + OAuth + `/.well-known/*`. Do **not** publish the whole API
(`location /`) unless you intend every `/v1/*` route to be internet-reachable.

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;

    # Let's Encrypt / certbot paths; HSTS keeps browsers on HTTPS.
    add_header Strict-Transport-Security "max-age=31536000" always;

    location = /mcp {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Replace (do not append) client XFF — required before
        # TRUST_PROXY_HEADERS=true on the API.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Connection "";
        # nginx 默认透传客户端请求头（Mcp-* 随之透传）；上面对 XFF 的
        # proxy_set_header 是显式覆盖，不是「全量透传后再叠加」。
        # Blocking waits need headroom under MCP_MAX_WAIT_SECONDS (default 60).
        proxy_read_timeout 100s;
    }

    location /oauth/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    # Authorization entry redirects into the Dashboard consent UI.
    location = /authorize {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    location /.well-known/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    # Consent UI (owner login) — same Secure-cookie rules as /ui elsewhere.
    location = /ui { return 308 /ui/; }
    location /ui/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    location / { return 404; }
}
```

Then on the API process:

```bash
MCP_PUBLIC_URL=https://mcp.example.com
OAE_PUBLIC_EDGE=true
TRUST_PROXY_HEADERS=true   # only with the XFF overwrite above
```

Point web agents at `https://mcp.example.com/mcp`. Discovery:
`GET https://mcp.example.com/.well-known/oauth-protected-resource` → AS metadata
→ owner consent → token → `Authorization: Bearer` on `POST /mcp`.

## Checklist before you flip DNS

- [ ] Track 0 is not enough (you truly need public web agents)
- [ ] `MCP_PUBLIC_URL` matches the hostname clients will use (https)
- [ ] `OAE_PUBLIC_EDGE=true`
- [ ] Proxy preserves `Mcp-*` request headers end-to-end
- [ ] Blocking wait cap (`MCP_MAX_WAIT_SECONDS`) fits every proxy read timeout on the path
- [ ] If `TRUST_PROXY_HEADERS=true`, XFF is overwritten/stripped at the edge
- [ ] Owner can reach `/ui/oauth/authorize` over HTTPS to approve CIMD clients
