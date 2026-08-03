---
title: Agent sign-ups
description: Let an agent complete registrations that email a code or magic link — verified with OKX and Coinbase CDP, plus Crossmint and Binance wallet flows.
---

Most of the internet still trusts a new account the same way: it emails you a
code or a magic link. An agent that can read its own inbox can finish those
sign-ups by itself — exchange accounts, developer consoles, dApp dashboards,
SaaS trials. This guide is the playbook, with two examples we ran end to end
and two more flows mapped from vendor docs.

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

## Verified example: Coinbase CDP Agentic Wallet

Coinbase's `awal` CLI ties a wallet directly to an email address — no seed
phrase, no KYC step in the flow. We ran this one on 2026-08-03 with a stock
openagent.email instance:

1. Created a fresh identity and ran `npx awal auth login <address>` —
   Coinbase emailed a 6-digit code.
2. The mail (from `no-reply@info.coinbase.com`, subject literally
   "`645189 is your login code`") landed in about **30 seconds**; the agent
   waited with `mail_wait_for` and read the code from the message.
3. `npx awal auth verify 645189` → authenticated, wallet live: one EVM
   address (good on Base and Polygon) plus a Solana address.

Two things the vendor docs get wrong or omit — found the hard way:

- The real verify syntax is `awal auth verify <otp>`, one argument. The
  quickstart shows `awal auth verify <flowId> <otp>`; pass the flowId and
  you get `OTP must be exactly 6 digits`, because the background wallet
  server already tracks the flow from your login.
- The docs ask for Node.js 24+, but the CLI runs fine on Node 23 — the
  engine check is advisory.

Codes expire in 5 minutes, so keep the wait window tight and verify
immediately. Same trust model as OKX, only stronger: whoever controls the
inbox controls the wallet.

## More flows from vendor docs

Two more wallet ecosystems where the email leg is real, mapped from each
vendor's current documentation (checked 2026-08-03). We have not run these
end to end on our own instance yet — if you do, tell us what broke.

### Crossmint — email as the recovery key

Crossmint's agent payments stack splits ownership from operation:

1. The developer gets an API key from the Crossmint Console.
2. The end user signs in with an email OTP; a non-custodial wallet is
   created at that moment, with the email as its **recovery signer**.
3. The agent is then authorized as a *scoped* signer on the user's wallet —
   explicit spending limits, revocable at any time.

The mailbox is the wallet's fallback root: lose everything else and the
email still recovers it. (Crossmint also offers server agent wallets with no
email in the picture — the backend holds the keys. Different trust model, no
inbox leg.)

### Binance Agentic Wallet — the human's account, the agent's wallet

Binance keeps the exchange account firmly human and gives the agent a
fenced-off wallet underneath it:

1. The Binance account itself registers with email + OTP — and that address
   can live on your domain, so login codes and security alerts land in the
   agent's inbox. KYC is the human's step, and the account stays the
   human's.
2. The agent installs Binance Wallet Skills (`npx skills add` from Binance's
   GitHub link) and asks to create an **Agentic Wallet** — a dedicated
   keyless wallet under the account with an isolated balance, user-defined
   limits, and transfers restricted to the address book.
3. Pairing is deliberately manual: a QR / pairing code is confirmed in the
   Binance App, where the human enables Secure Auto Sign.

One Agentic Wallet per user; BSC, Solana, Base, and Ethereum at launch. The
email leg here is the account — the agent reads its codes and alerts, while
funds move only inside limits the human set.

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
