---
title: Agent sign-ups
description: Let an agent complete registrations that email a code or magic link — with a real, verified example (OKX Agentic Wallet).
---

Most of the internet still trusts a new account the same way: it emails you a
code or a magic link. An agent that can read its own inbox can finish those
sign-ups by itself — exchange accounts, developer consoles, dApp dashboards,
SaaS trials. This guide is the playbook, with one example we ran end to end.

## The playbook

Every email-based sign-up is the same five steps:

1. **Create an identity** for the job — one per site or per purpose, so the
   account is easy to revoke later:

   ```
   mail_new_identity  →  okx@yourdomain.com
   ```

2. **Start the sign-up** on the website and give it that address. Some flows
   the agent can drive itself (through a browser bridge); some you'll do by
   hand. Either way the mailbox is the agent's.

3. **Wait for the email** instead of polling by hand:

   ```
   mail_wait_for(address, subjectContains: "verification", timeoutSec: 300)
   ```

   The call returns the moment the mail lands — typically well under a minute.

4. **Take the code or link.** Codes and verification links come back already
   extracted (`otp` and `links` fields) — no HTML parsing, no regex.

5. **Complete the sign-up** with the code or link. Done. The whole loop is
   usually 1–2 minutes, and most of that is the website's own latency.

Because each identity is a real address on your own domain, the account you
just created is durable: password resets, login alerts, and receipts keep
working as long as your server runs.

## Verified example: OKX Agentic Wallet

Agent wallets and Web3 dashboards all start with an email — there is no way
around it. We ran this one on 2026-08-01 with a stock openagent.email
instance:

1. Installed OKX's official agent toolkit (`onchainos` CLI) and asked it to
   create a wallet: it returned a login URL.
2. Chose **email login** on OKX's page and entered `okx@openagent.email` — an
   identity created with `mail_new_identity` seconds earlier.
3. OKX's verification email landed in about **30 seconds**; the API flagged
   `hasOtp: true` and handed us the 6-digit code.
4. Submitted the code → wallet created, `loginType: "email"`, fresh EVM and
   Solana addresses.

No human touched the mailbox; the agent waited, extracted, and confirmed.
One detail worth knowing: the OKX wallet itself already has per-day and
per-transaction **spend limits** in its policy settings — set them before you
let an agent hold funds, ours or anyone's.

## Boundaries — read this once

- **The accounts are yours.** openagent.email is self-hosted; you are
  responsible for what your agents register for and for complying with each
  site's terms of service. Some sites (exchanges especially) restrict
  automation or require KYC — those steps are yours to do, honestly.
- **Captcha, KYC, and wallet signatures are human steps.** The playbook covers
  the email leg. When a site asks for a puzzle or an identity check, do it
  yourself; don't try to automate around it.
- **One identity per purpose.** It keeps audit trails clean and makes
  revoking one compromised account a one-line call.
- **OTP codes are credentials.** They're as sensitive as passwords while
  valid — see the [security guide](/docs/guides/security/) for token hygiene.
- **Don't bulk-register.** Automated mass sign-ups are abuse everywhere;
  this playbook is for accounts your agents genuinely operate.

## Troubleshooting

- **`mail_wait_for` timed out.** Check that the site actually sent (resend
  button), then widen the filter — drop `subjectContains` and match on
  `fromContains` instead. Self-hosted catch-alls occasionally get a slow
  first delivery from a new sender; the retry usually lands in seconds.
- **The code expired.** Most codes live 5–10 minutes. Keep the wait window
  tight and use the code immediately after extraction.
- **Nothing extracted (`hasOtp: false`).** The sender changed their email
  template. `mail_read_message` still returns the full text and all links —
  the code or confirmation link is in there, just not auto-recognized. (Tell
  us which site broke and we'll teach the extractor.)
- **Mail went to spam on the *receiving* side.** Irrelevant here — your
  server is the receiver and accepts everything for the catch-all. If a
  *sender* refuses to email your domain at all, that's their policy, not
  your server; try a different TLD next time (see
  [Get a VPS → domains](/docs/get-a-vps/)).
