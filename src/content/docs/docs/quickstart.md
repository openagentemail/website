---
title: Quickstart
description: From zero to a working agent mailbox in about 10 minutes.
---

**You need:** a VPS with TCP port 25 open (don't have one? see
[Get a VPS](/docs/get-a-vps/) — tested picks from $11/year), a domain you
control, and Docker installed.

Rather not do it by hand? `npx -y @openagentemail/setup` is a guided wizard:
it checks what you already have, helps you pick a VPS and domain if you're
missing either, and connects your agent clients once the server is up. The
steps below are the same install done manually.

## 1. Get the stack

```bash
git clone https://github.com/openagentemail/openagentemail.git
cd openagentemail
cp .env.example .env
```

## 2. Set five values in `.env`

```bash
DOMAIN=example.com                                # the domain your agent addresses live on
API_KEYS=$(openssl rand -hex 32)                  # admin key — keep it offline
MAIL_PASSWORD=$(openssl rand -hex 24)             # catch-all mailbox password
NTFY_ADMIN_PASSWORD=$(openssl rand -hex 24)       # server-only ntfy administrator password
TASK_SIGNING_SECRET=$(openssl rand -hex 32)       # keep this stable when rotating the mail password
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

The doctor checks `.env` permissions; MX, A, SPF, DKIM, and DMARC; PTR;
outbound port 25; DNS blocklists; TLS certificates on 465 and 993; and the
server-side ntfy verification endpoint. It does not log in over IMAP/SMTP or
send a round-trip message. Fix whatever it flags before your agents depend on
this box.

## Optional: public TLS with Let's Encrypt

The default stack remains self-signed: a normal `docker compose up -d` does
not start Certbot or expose TCP 80. To opt in to a publicly trusted mail
certificate, first point `mail.$DOMAIN` (A, and AAAA if used) at this VPS and
allow inbound TCP 80. HTTP-01 cannot create DNS records or open your firewall.

Before starting the mailserver in Let's Encrypt mode, add this to `.env`:

```dotenv
SSL_TYPE=letsencrypt
SSL_DOMAIN=mail.example.com       # exactly mail.$DOMAIN
LETSENCRYPT_EMAIL=admin@example.net  # optional, but recommended
```

Bootstrap the first certificate with the dedicated one-shot profile, then
confirm the two files exist. Do not start the full `letsencrypt` profile until
this succeeds:

```bash
docker compose --profile letsencrypt-bootstrap up -d certbot-bootstrap
docker compose logs -f certbot-bootstrap
# Wait for “Successfully received certificate”, then:
docker compose --profile letsencrypt-bootstrap run --rm --no-deps \
  --entrypoint ls certbot-bootstrap -l \
  /etc/letsencrypt/live/mail.example.com/fullchain.pem \
  /etc/letsencrypt/live/mail.example.com/privkey.pem
```

The whole persistent `/etc/letsencrypt` tree is shared read-only with the
mailserver; `live/` contains symlinks into `archive/`, so mounting only
`live/` is incorrect. This temporary container reads that shared volume, so the
check still works after the one-shot bootstrap has stopped. Once it succeeds,
start the normal opt-in profile:

```bash
docker compose --profile letsencrypt up -d
./deploy/doctor.sh
```

If bootstrap fails, correct DNS, port 80, or the domain and explicitly rerun
the bootstrap command; it intentionally stops instead of repeatedly consuming
ACME attempts. After success, the renewal sidecar runs `certbot renew` every
12 hours and restarts with Docker. docker-mailserver detects updated
Let's Encrypt material and reloads Postfix and Dovecot, so renewed certificates
take effect on 465 and 993 without a manual restart.

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

## 8. Watch from your browser

The agent works the mailbox on its own from here. To see what it's doing,
open `http://localhost:3100/ui` and paste the admin key (or any identity
token). The dashboard shows every identity, its unread count, and each
message with codes and links already extracted — and you can mark messages
read or unread. There is also a **Notifications** panel for server-side ntfy
history (and a Tasks ticket board when you use email-backed tasks). Admin
sessions can also create identities (with custom address prefixes), rotate
tokens, and delete identities from the overview table. Tick **Trust this
device** at sign-in to stay logged in on that browser for 30 days.

Want to reach the dashboard from other machines? Give it a real hostname
with HTTPS, proxying only the `/ui` path — details in
[Security](/docs/guides/security/).

## Next: let agents assign work

When two identities on this server need to coordinate, use
[email-backed tasks](/docs/guides/tasks/). They keep task state in the email
thread itself and can wake the assigned agent through the built-in private
notification route.
