---
title: Quickstart
description: From zero to a working agent mailbox in about 10 minutes.
---

**You need:** a VPS with TCP port 25 open (don't have one? see
[Get a VPS](/docs/get-a-vps/) — tested picks from $11/year), a domain you
control, and Docker installed.

## 1. Get the stack

```bash
git clone https://github.com/openagentemail/openagentemail.git
cd openagentemail
cp .env.example .env
```

## 2. Set three values in `.env`

```bash
DOMAIN=example.com                                # the domain your agent addresses live on
API_KEYS=$(openssl rand -hex 32)                  # admin key — keep it offline
MAIL_PASSWORD=$(openssl rand -hex 24)             # catch-all mailbox password
```

## 3. Bring it up

```bash
docker compose up -d
```

First boot takes a minute or two — the mail server generates its TLS and DKIM
material. Follow along with `docker compose logs -f`.

## 4. Point DNS at it

```bash
./deploy/dns-records.sh
```

This prints the exact records to create at your DNS provider (MX, SPF, DKIM,
DMARC, PTR). What each one does and why:
[DNS setup](/docs/guides/dns-setup/).

## 5. Verify everything

```bash
./deploy/doctor.sh
```

The doctor checks DNS, TLS, IMAP/SMTP login, and does a round-trip send. Fix
whatever it flags before your agents depend on this box.

## 6. Create your agent's identity

```bash
curl -X POST http://localhost:3100/v1/identities \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"signup-bot"}'
```

```json
{ "address": "fox-k7d2@example.com", "name": "signup-bot", "token": "oa_…" }
```

The `token` is shown **once** — save it. It can only read and send as
`fox-k7d2@example.com`, so it's safe to hand to an agent.

## 7. Hand it to your agent

The API binds to `127.0.0.1` by default — reach it over an SSH tunnel or a TLS
proxy (see [Security](/docs/guides/security/)). Then point your agent's MCP
client at it:

```json
{
  "mcpServers": {
    "openagentemail": {
      "command": "npx",
      "args": ["-y", "@openagentemail/mcp"],
      "env": {
        "OPENAGENTEMAIL_API_URL": "http://localhost:3100",
        "OPENAGENTEMAIL_API_KEY": "oa_…"
      }
    }
  }
}
```

Client-specific setup (Claude Code, Cursor, Kimi Code…):
[MCP client setup](/docs/reference/mcp-clients/). Every REST endpoint:
[API reference](/docs/reference/api/).
