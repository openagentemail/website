---
title: "Namecheap DNS for openagent.email"
description: Map dns-records.sh into Namecheap BasicDNS, PremiumDNS, or FreeDNS using Custom MX and relative Host values.
---

Start from the values printed by `./deploy/dns-records.sh`. This page maps those
A, MX, SPF, DKIM, and DMARC records into Namecheap Advanced DNS. Do not invent
IPs or DKIM material — paste what the script prints. PTR is not a Namecheap
DNS record; set it at the VPS host.

The generic record meanings live in [DNS setup](/docs/guides/dns-setup/).

No live Namecheap account or DNS mutation was performed for this content card. Dashboard names and mail-mode behavior were checked against current official Namecheap documentation, not against a live dashboard session.

## Nameserver and mail-mode preconditions

This flow applies only when the domain uses **BasicDNS**, **PremiumDNS**, or
**FreeDNS** (Namecheap's nameservers). If the domain uses custom DNS at
Cloudflare or Route 53, use that provider's page instead.

In Advanced DNS, set **Mail Settings** to **Custom MX**. Email Forwarding,
Private Email, and other Namecheap mail modes can replace or discard custom MX
records. Turn those modes off before pasting the script's MX.

Namecheap's Host field omits the zone suffix. Apex host is `@`. DKIM host is
the relative `mail._domainkey`, not a duplicated full zone.

## Dashboard: Advanced DNS

Open **Domain List → Manage → Advanced DNS**.
[MX records](https://www.namecheap.com/support/knowledgebase/article.aspx/322/2237/how-can-i-set-up-mx-records-required-for-mail-service/)
and
[TXT / SPF / DKIM / DMARC](https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/)
use Type, Host, Value, and TTL. TTL 300 is fine while you iterate.

Assume the script printed records for `example.com` / `mail.example.com`.
Substitute your `DOMAIN` and paste the script's values.

| Script record | Type | Host | Value | extra |
|---|---|---|---|---|
| `mail.example.com. A <IPv4>` | A Record | `mail` | the IPv4 from the script | — |
| `mail.example.com. AAAA <IPv6>` | AAAA Record | `mail` | the IPv6 from the script, **only if** IPv6 works end to end | — |
| `example.com. MX 10 mail.example.com.` | MX Record (Custom MX) | `@` | `mail.example.com` | Priority `10` |
| `example.com. TXT "v=spf1 mx ~all"` | TXT Record | `@` | `v=spf1 mx ~all` | one SPF TXT only |
| `mail._domainkey.example.com. TXT "v=DKIM1; …"` | TXT Record | `mail._domainkey` | the exact DKIM string the script printed | Host stays relative |
| `_dmarc.example.com. TXT "v=DMARC1; …"` | TXT Record | `_dmarc` | the exact DMARC string the script printed | — |

Host `@` is the apex. Host `mail` becomes `mail.example.com`. Host
`mail._domainkey` becomes `mail._domainkey.example.com`. Pasting a full zone
into Host makes Namecheap append the zone a second time.

If DKIM is not generated yet, boot the stack once and re-run
`./deploy/dns-records.sh`. Do not invent a `p=` value. Do not add AAAA unless
IPv6 works end to end.

## PTR stays at the VPS host

`dns-records.sh` prints reverse DNS as `SERVER_IP -> mail.DOMAIN`. Create that
at Hetzner / DigitalOcean / Vultr / AWS, not in Advanced DNS.

## Verify

```bash
./deploy/doctor.sh

dig @1.1.1.1 +short A      mail.example.com
dig @1.1.1.1 +short MX     example.com
dig @1.1.1.1 +short TXT    example.com
dig @1.1.1.1 +short TXT    mail._domainkey.example.com
dig @1.1.1.1 +short TXT    _dmarc.example.com
```

Replace `example.com` with your `DOMAIN`. Check against a public resolver, not
only Namecheap's preview. `doctor.sh` does not log in over IMAP/SMTP or send a
round-trip message.
