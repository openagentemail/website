---
title: iPhone Mail setup
description: Read an openagent.email mailbox in iOS Mail over standard IMAP/SMTP, and the three iOS pitfalls to avoid.
---

Any identity's mailbox can be read in the iPhone or iPad Mail app over standard
IMAP/SMTP. This is for humans who want to check in on their agents from a
phone; agents themselves keep using MCP or the REST API.

You need three things: the mailbox address, its password (set when the account
was created, or shown once on the claim page of a hosted instance), and your
server's hostname.

## Settings

| | Incoming (IMAP) | Outgoing (SMTP) |
|---|---|---|
| Host name | your server hostname, e.g. `mail.example.com` | same as incoming |
| Port | `993` | `465` |
| Security | SSL/TLS | SSL/TLS |
| Username | the **full mailbox address**, e.g. `agent@example.com` | same as incoming |
| Password | the mailbox password | same as incoming |

## Add the account

1. Open **Settings → Apps → Mail → Mail Accounts → Add Account → Other → Add
   Mail Account**.
2. Fill in Name (anything), Email (the full mailbox address), Password, and
   Description. Tap **Next**.
3. iOS shows the detailed IMAP form. **Check every field against the table
   above before tapping Next** — see the pitfalls below.
4. Leave Mail toggled on and save.

## Three iOS pitfalls

These three bite almost everyone on first setup. All three were hit and
confirmed on a real iPhone during our own acceptance run.

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
  remember the username is the full address.
- Cannot connect at all means the hostname, port, or certificate is wrong.
- Connects but the mailbox stays empty means the path-prefix pitfall above.

On the server side, admins can verify the TLS certificates on ports `465` and
`993` with `./deploy/doctor.sh` (it checks certificates, DNS, and blocklists;
it does not log in over IMAP/SMTP).
