---
title: Use your own mail server
description: Run only the openagent.email API with an existing mail provider or mail server.
---

Use this setup when your domain already has a working mail server or hosted mail
provider. `compose.api-only.yaml` runs only the openagent.email API container:
it reads a catch-all mailbox over IMAP and sends through your provider's SMTP
server. It does **not** run docker-mailserver, publish SMTP ports, or configure
DNS for you.

If you need a new mail server on a VPS, use the regular
[Quickstart](/docs/quickstart/) instead.

## 1. Set up a catch-all mailbox at your mail provider

Create one mailbox account, such as `agent@example.com`, and turn on a
**catch-all** (also called a wildcard mailbox or wildcard alias) for your agent
domain. It must receive mail sent to any prefix at that domain:

```text
fox-k7d2@example.com  ─┐
owl-9x1a@example.com  ─┼─> agent@example.com
signup-bot@example.com ─┘
```

This one account's IMAP and SMTP credentials go in the API configuration. Keep
them between your deployment system and the API container; agents use their own
scoped `oa_…` tokens and never need the mailbox password.

Before continuing, send a test email to an unused address at the domain and
confirm that it arrives in the catch-all mailbox. Providers use different names
for this feature, and some plans do not include it.

## 2. Prepare the API-only files

Get the repository files on the server or in the Git repository that Portainer
can access:

```bash
git clone https://github.com/openagentemail/openagentemail.git
cd openagentemail
cp .env.api-only.example .env
```

Edit `.env` with the IMAP and SMTP settings from your provider. The example
file explains every value; these are the important ones:

| Variable | What to enter |
| --- | --- |
| `DOMAIN` | The domain whose addresses your catch-all receives. |
| `API_KEYS` | A new admin key; generate one with `openssl rand -hex 32`. |
| `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS`, `IMAP_USER`, `IMAP_PASS` | The catch-all mailbox's incoming-mail settings. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | The same mailbox account's outgoing-mail settings. |
| `ALLOWED_SEND_DOMAINS` | Domains identities may use in their `From` address. Normally just `DOMAIN`. |
| `UI_ENABLED` | Set `false` to remove the built-in human inbox at `/ui`. |
| `SEND_RATE_LIMIT` | Per-identity messages per rolling hour; `0` turns it off. |
| `RETENTION_DAYS` | Days to keep mail; `0` keeps it forever. |

The regular compose stack intentionally accepts the bundled mailserver's
self-signed certificate. For an external provider with a normal public
certificate, leave these set to `true`:

```dotenv
IMAP_TLS_REJECT_UNAUTHORIZED=true
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

They make the API reject an expired, mismatched, or untrusted TLS certificate.
Only set either one to `false` when you understand why the server uses a
self-signed or privately issued certificate and have verified the connection
path yourself.

## 3. Deploy with Portainer

`compose.api-only.yaml` builds the API from `packages/api`, so it needs the
full repository as its build context. Do not paste only the YAML into
Portainer's Web editor: that editor does not include the source directory.

1. In Portainer, choose **Stacks** → **Add stack** → **Git repository** and
   name it `openagentemail`.
2. Set the repository URL to `https://github.com/openagentemail/openagentemail.git`,
   select the branch you want, and set **Compose path** to
   `compose.api-only.yaml`.
3. Add the variables from `.env.api-only.example` in Portainer's environment
   variables section. Do not paste the example passwords unchanged.
4. Click **Deploy the stack**. The only persistent volume is `api-data`, which
   stores identities and their tokens.

Some Portainer endpoints cannot build a Compose image from a Git stack yet. If
yours reports a build-context error, clone the repository on the Docker host,
build the API once, then use the Web editor with a local image instead:

```bash
git clone https://github.com/openagentemail/openagentemail.git
cd openagentemail
docker build -t openagentemail-api:local ./packages/api
```

Paste `compose.api-only.yaml` into the editor, replacing this line before
deploying:

```yaml
build: ./packages/api
```

with:

```yaml
image: openagentemail-api:local
```

The API port stays bound to `127.0.0.1` by default. Reach it through an SSH
tunnel or a TLS reverse proxy; see the [security guide](/docs/guides/security/).
Do not change `API_BIND` to `0.0.0.0` just to make Portainer's published-port
UI convenient.

## 4. What works, and the SMTP boundary

Receiving mail, OTP extraction, verification links, identity tokens, and the
web inbox work normally. The API finds each identity's mail from the headers on
messages delivered to the catch-all mailbox.

Sending has one provider-specific boundary: openagent.email logs in as the
catch-all account, then asks SMTP to send with an agent identity such as
`fox-k7d2@example.com` in `From`. A self-hosted MTA usually permits that
sender rewrite. A hosted provider may allow only the mailbox's own address, or
may require aliases to be created first. Check your provider's sender-alias or
"send as" policy before relying on agents to send mail. If it rejects the
rewrite, receiving and OTP flows still work; only sending as arbitrary agent
prefixes is affected.
