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
| **Vultr** | $3.50/mo | Best automation: official CLI, API, **and an official MCP server** — your agent can drive it. Crypto top-ups (BitPay) | Inbound open; outbound via support ticket (1–2 days) |
| **Contabo** | $4.50/mo | Most horsepower per dollar (4 vCPU / 8 GB). Official CLI + API | Open both ways (new accounts throttled ~25 msgs/min) |
| **RackNerd** | ~$11/**year** | The rock-bottom option. Watch their flash deals | Open both ways; rDNS via ticket |
| **UpCloud** | $3.50/mo | Excellent automation: REST API, `upctl` CLI, Terraform | Inbound open; outbound via support ticket |
| **Evoxt** | $2.99/mo | Cheapest monthly plan; balance-based order API | Closed by default; support ticket to open |

## Avoid for mail

- **DigitalOcean** — officially discourages self-hosted mail and often refuses
  to open outbound 25.
- **Hetzner** (new accounts) — outbound 25 stays closed for about a month.
- **Google Cloud / Azure** — port 25 hard-blocked, no exceptions.
- **Oracle Cloud free tier** — outbound 25 effectively blocked, and idle VMs
  get reclaimed (a quiet mail server looks idle).

## And a domain

Any registrar works — you'll create MX/SPF/DKIM records by hand once, and our
[dns-records.sh](https://github.com/openagentemail/openagentemail/blob/main/deploy/dns-records.sh)
prints exactly what to paste. If you want your agent to **register domains and
set DNS records via API** as well, these are the automation-friendly picks:

| Registrar | .com/yr | Why this one |
|---|---|---|
| **Porkbun** | ~$11 | **Official MCP server** + full API, crypto accepted, per-key spend caps (agent-safe). First-ever domain may need one manual web purchase |
| **Spaceship** | ~$9 (promos from ~$3) | Clean REST API with zero gating — register, contacts, DNS all API. Bitcoin top-ups |
| **Cloudflare** | $10.46 (at-cost) | Official MCP + the best DNS API anywhere, one token for everything. Registrar API still beta; requires Cloudflare nameservers |
| **NameSilo** | ~$11 | Official MCP, crypto accepted, cheap TLD promos (.xyz from ~$1.79) |

Avoid registrars that require real-name verification with manual review —
that's a human-in-the-loop step an agent can't pass.

---

*No affiliate links on this page today. If we add them later they'll be marked
clearly — picks are ranked by how well they run a mail server, nothing else.*
