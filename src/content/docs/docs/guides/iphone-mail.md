---
title: iPhone Mail setup
description: Read your instance's catch-all mailbox in iOS Mail over standard IMAP/SMTP, and the three iOS pitfalls to avoid.
---

openagent.email keeps every identity's mail in **one catch-all mailbox**: the
API logs into that single account over IMAP and matches messages to identities
by the `To` header. That same account is what you add to iOS Mail — one
account, all of your agents' mail in one inbox, and the `To` field tells you
which identity each message was for.

This is for humans who want to check in on their agents from a phone; agents
themselves keep using MCP or the REST API.

## Prerequisite: a publicly trusted certificate

iOS Mail refuses self-signed certificates. The default stack boots with a
self-signed one so that IMAPS/465 work out of the box locally, but a phone
will not connect to it. Finish the Let's Encrypt setup in the
[Quickstart](/docs/quickstart/) first, and confirm `./deploy/doctor.sh` is
green on its TLS checks (ports `465`/`993`) before continuing here.

## Before you start: this is the master mailbox password

The account you are adding is the catch-all account, protected by
`MAIL_PASSWORD` from your server's `.env`. As the
[security guide](/docs/guides/security/) notes, only the API container normally
uses it. Putting it on a phone means the phone can read **every** identity's
mail and send as the catch-all address **or any of your agents' addresses**
(the default mail server permits that sender rewrite) — add it only to a
device you control, and if the phone is lost, rotate `MAIL_PASSWORD` as
described in the [security guide](/docs/guides/security/). Keep the password
out of agent-facing env vars and prompts as usual.

If you would rather not put the master password on a phone at all, skip this
guide and open the dashboard `/ui` in the phone's browser instead — that needs
only a dashboard login session, with nothing stored in the Mail app.

You need: the catch-all address (default `agent@your-domain`, or your
[`MAIL_ACCOUNT`](https://github.com/openagentemail/openagentemail/blob/main/.env.example)
value in `.env` if you changed it), the `MAIL_PASSWORD`, and the hostname your
Let's Encrypt certificate covers (usually `mail.example.com`).

## Settings

| | Incoming (IMAP) | Outgoing (SMTP) |
|---|---|---|
| Host name | your mail server hostname, e.g. `mail.example.com` | same as incoming |
| Port | `993` | `465` |
| Security | SSL/TLS | SSL/TLS |
| Username | the full email address, e.g. `agent@example.com` | same as incoming |
| Password | the `MAIL_PASSWORD` from your server `.env` | same as incoming |

iOS Mail talks straight to the shared mailbox: deleting, archiving, or marking
messages read on the phone changes what your agents see through the API.
Treat the phone as read-mostly.

## Add the account

1. Open **Settings → Apps → Mail → Mail Accounts → Add Account → Other → Add
   Mail Account**.
2. Fill in Name (anything), Email (the catch-all address), Password
   (`MAIL_PASSWORD`), and Description. Tap **Next**.
3. iOS shows the detailed IMAP form. **Check every field against the table
   above before tapping Next** — see the pitfalls below.
4. Leave Mail toggled on and save.

## Three iOS pitfalls

Check these three first — they account for most "it does not work" reports.

1. **iOS guesses wrong field values.** It copies your "Name" into the incoming
   Host Name field, and strips the `@domain` part from the username. Fix each
   field by hand: Host Name is just the server hostname (no `@`, no spaces),
   and User Name is the full email address **including `@example.com`** — for
   both the incoming and the outgoing sections.
2. **Leave "IMAP Path Prefix" empty.** iOS sometimes fills it with a port
   number such as `143`. With a non-empty prefix the account *connects*
   successfully but the mailbox looks empty. Open **Advanced** and delete
   whatever is in **IMAP Path Prefix**.
3. **Force-quit Mail after changing advanced settings.** iOS caches the old
   session with a backoff timer, so editing settings does not retry the
   connection. Kill the Mail app completely and reopen it, or you will stare at
   a stale failure for minutes.

## If it still does not work

- An immediate password prompt means the username or password is wrong —
  remember the username is the full email address.
- Cannot connect at all means the hostname, port, or certificate is wrong —
  see the certificate prerequisite above.
- Connects but the mailbox stays empty means the path-prefix pitfall above.
