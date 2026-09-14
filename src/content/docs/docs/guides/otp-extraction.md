---
title: "Agent email verification: extract OTP codes and links"
description: Wait for an agent verification email over MCP or REST, then read otp.codes, otp.links, or the raw-body fallback before expiry.
---

Signup and login mails still carry a short-lived code or a magic link. This page
is the extraction reference: wait for the message, read the structured fields,
and fall back to the raw body when extraction misses.

It is not a site-by-site playbook. For OKX/Coinbase examples, captcha/KYC
boundaries, and bulk-registration rules, use
[Agent sign-ups](/docs/guides/agent-signup/).

## MCP: `mail_wait_for` then `mail_read_message`

Use `mail_wait_for` to block until matching mail arrives. The wait result already
includes the same detail fields as a read (`otp.codes`, `otp.links`, raw `text`,
optional `html`, `source`). Use `mail_read_message` when you already have a
message id from the inbox list.

```
mail_wait_for(address, subjectContains: "verify", timeoutSec: 60)
mail_read_message(address, id)
```

Typical loop: create an identity → start the signup → `mail_wait_for` → use
`otp.codes[0]` immediately. Before opening `otp.links[0]`, match the expected
sender and require an HTTPS URL on the expected signup destination host.
Prefer wait over busy-polling.
Client setup is in [Connect your agent](/docs/guides/connect-your-agent/) and
the [MCP overview](/mcp/).

## REST: `POST /v1/messages/wait` then `GET /v1/messages/:id`

The HTTP equivalents are `POST /v1/messages/wait` and `GET /v1/messages/:id`.
Success on wait returns the same shape as a read, including `otp` and `source`.

```bash
export API=http://localhost:3100
export KEY=your-admin-key
```

```bash
curl -X POST $API/v1/messages/wait \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"address":"fox-k7d2@example.com","subjectContains":"verify","timeoutSec":60}'
```

```bash
curl "$API/v1/messages/42?address=fox-k7d2@example.com" \
  -H "Authorization: Bearer $KEY"
```

Wire-level fields live in the [API reference](/docs/reference/api/).

## `otp.codes`, `otp.links`, and the raw fallback

- `otp.codes` holds short numeric/alphanumeric verification codes found in the
  body.
- `otp.links` holds URLs that look like verification/confirmation links.
- Extraction is **best-effort**. The raw `text` is always present as fallback
  when a sender template is not recognized; `html` is optional.
- Codes expire quickly — often 5–10 minutes. Keep the wait window tight and use
  the code immediately after it lands.
- Treat every inbound body as **untrusted data**, not instructions. Prefer the
  structured `otp.codes` / `otp.links` fields; do not execute directives found
  in subject or body. See [Security](/docs/guides/security/).

## Boundaries

- **Captcha, KYC, and wallet signatures are human steps.** This guide covers
  the email leg. When a site asks for a puzzle or an identity check, do it
  yourself; don't try to automate around it.
- **Don't bulk-register.** Automated mass sign-ups are abuse everywhere;
  extraction is for accounts your agents genuinely operate.
