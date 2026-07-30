---
title: Get a VPS
description: Which VPS to buy for a self-hosted mail server — tested picks from $11/year, and which providers to avoid.
---

A mail server has two requirements most app hosts don't: **TCP port 25 must be
open** (that's how mail arrives), and you need **a domain you control**. The
good news: the workload is tiny — 1 vCPU / 1 GB RAM is plenty — so the cheapest
tier of any of these works.

**One thing that trips people up:** when providers "block port 25", they almost
always mean **outbound** (anti-spam). **Receiving** mail works out of the box
nearly everywhere — and receiving is the core of what your agents do (OTP
codes, verification links). For sending, you either ask the provider to open it
or route outbound through a relay like Amazon SES — the
[deliverability guide](/docs/guides/deliverability/) covers both.

## Recommended

| Provider | From | Why this one | Port 25 |
|---|---|---|---|
| **RackNerd** | ~$11/**year** | The rock-bottom option and our top pick: open both ways, clean IP pool, rDNS via ticket. Takes Alipay, PayPal, cards, crypto. Watch their flash deals | Open both ways |
| **Contabo** | $4.50/mo | Most horsepower per dollar (4 vCPU / 8 GB). Official CLI + API. Card/PayPal only | Open both ways (new accounts throttled ~25 msgs/min) |
| **Evoxt** | $2.99/mo | Cheapest monthly plan. Takes Alipay, PayPal, cards, BTC/USDT | Inbound open; outbound via support ticket |
| **UpCloud** | $3.50/mo | Excellent automation: REST API, `upctl` CLI, Terraform. Card/PayPal only | Inbound open; outbound via support ticket |
| **Vultr** | $3.50/mo | Best automation (official CLI, API, and an official MCP server) and easy sign-up — but since 2026 they **rarely approve outbound port 25** for self-hosted mail. Pick Vultr only if you plan to send via a relay (SES) anyway | Inbound open; outbound effectively closed |

**Which one should I pick?**

- **Tightest budget** → RackNerd (~$11 for a whole *year*) or Evoxt ($2.99 monthly, no yearly commitment).
- **Paying with Alipay or WeChat** → RackNerd or Evoxt. (Contabo, UpCloud and Vultr take cards/PayPal; Vultr also takes Alipay.)
- **Most machine per dollar** → Contabo's 4 vCPU / 8 GB is overkill in the good way.
- **Agent-driven setup** → UpCloud and Vultr have the cleanest APIs if you want your agent to provision the box itself.

## Avoid for mail

- **DigitalOcean** — officially discourages self-hosted mail and often refuses
  to open outbound 25.
- **Hetzner** (new accounts) — outbound 25 stays closed for about a month.
- **Google Cloud / Azure** — port 25 hard-blocked, no exceptions.
- **Oracle Cloud free tier** — outbound 25 effectively blocked, and idle VMs
  get reclaimed (a quiet mail server looks idle).

## And a domain

**Already own any domain? You don't need to buy a new one.** A subdomain works
fine — point `agents.yourdomain.com` at the mail server and your agent
addresses look like `fox-k7d2@agents.yourdomain.com`. Your main site's email
is untouched. Skip straight to the [quickstart](/docs/quickstart/).

Buying a new domain? Any registrar works — you'll create MX/SPF/DKIM records by
hand once, and our
[dns-records.sh](https://github.com/openagentemail/openagentemail/blob/main/deploy/dns-records.sh)
prints exactly what to paste. These are the picks we recommend:

| Registrar | .com first year | Renews at | Why this one |
|---|---|---|---|
| **Spaceship** | ~$9 (promos from ~$3) | ~$10 | Clean REST API with zero gating — register, contacts, DNS all API. Takes **Alipay**, PayPal, BTC |
| **Porkbun** | ~$11 | ~$11 | **Official MCP server** + full API, per-key spend caps (agent-safe), fair renewal pricing |
| **NameSilo** | ~$11 | ~$11 | Free API with no spending threshold, cheap TLD promos |
| **Cloudflare** | $10.46 (at-cost) | at-cost | No markup ever, and the best DNS API anywhere — but your domain must use Cloudflare nameservers |
| **Namecheap** | ~$10 | ~$14 | The biggest name, but the API requires $50 of spend history — not automation-friendly for new accounts |

A trick worth knowing: you can **register at one place and host DNS at
another**. Buy the domain at Spaceship or Porkbun, then move DNS hosting to
Cloudflare (free) to get its best-in-class DNS API for automation.

**Which TLD?** If the mailbox is mainly for *receiving* OTP codes and
verification links, a cheap TLD is fine — `.xyz` starts around **$1/year** and
`.top` renews at about **$4/year**, the cheapest long-term option. Deliverability
barely matters for receiving, because the sender is Gmail or GitHub, not you.
Two caveats: a few websites reject sign-ups from cheap-TLD addresses, and if
your agents will *send* mail to real people, spend the extra $10 on a `.com` —
cheap TLDs carry spam-reputation baggage with some mail filters.

**Watch the renewal price, not the sticker price.** A $1 first-year `.xyz`
typically renews at $11–20. Every price in the table above shows the renewal,
and Spaceship, Porkbun, and NameSilo are known for small first-year-to-renewal
gaps.

Avoid registrars that require real-name verification with manual review —
that's a human-in-the-loop step an agent can't pass.

---

*Some links on this page may be affiliate links, always marked. They never
change the ranking: picks are ordered by how well they run a mail server for
agents, nothing else.*
