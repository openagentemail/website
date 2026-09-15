---
title: "Cloudflare DNS for openagent.email"
description: Map A, MX, SPF, DKIM, and DMARC from dns-records.sh into Cloudflare DNS Records, with mail A/AAAA left DNS only.
---

Start from the values printed by `./deploy/dns-records.sh`. This page maps those
A, MX, SPF, DKIM, and DMARC records into Cloudflare's DNS Records fields. Do
not invent IPs, zone IDs, tokens, or DKIM material — paste what the script
prints. PTR is not a Cloudflare record; set it at the VPS host.

The generic record meanings live in [DNS setup](/docs/guides/dns-setup/).

No live Cloudflare account or DNS mutation was performed for this content card. Dashboard names and proxy behavior were checked against current official Cloudflare documentation, not against a live dashboard session.

## Mail hostname must stay DNS only

The mail `A`/`AAAA` record must stay **DNS only** (grey cloud). Cloudflare
[does not proxy SMTP](https://developers.cloudflare.com/dns/manage-dns-records/how-to/email-records/)
on port 25 by default. An orange-cloud / Proxied mail hostname terminates at
Cloudflare, so SMTP on 25/465/587 never reaches your VPS.

MX must target that **unproxied** mail hostname (`mail.example.com` in the
examples below — use the hostname the script printed).

## Dashboard: DNS → Records

In the Cloudflare dashboard, open the zone for your `DOMAIN`, then
[DNS → Records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)
→ **Add record**. TTL 300 is fine while you iterate (the script says the same).

Assume the script printed records for `example.com` / `mail.example.com`.
Substitute your `DOMAIN` and paste the script's values.

Before you add the self-hosted root MX/SPF rows below, make sure managed
[Cloudflare Email Routing](https://developers.cloudflare.com/dns/troubleshooting/email-issues/#is-email-routing-turned-on)
is not still enabled on this zone. Email Routing manages root MX/SPF (and related)
records that conflict with self-hosted mail; it does not deliver to your self-hosted
SMTP host. Follow Cloudflare's
[disable / remove-domain cutover](https://developers.cloudflare.com/email-service/configuration/domains/#remove-a-domain-from-email-routing)
guidance, then verify those managed routing records are removed before continuing.

| Script record | Type | Name | Content | Proxy status / extra |
|---|---|---|---|---|
| `mail.example.com. A <IPv4>` | A | `mail` | the IPv4 from the script | **DNS only** |
| `mail.example.com. AAAA <IPv6>` | AAAA | `mail` | the IPv6 from the script, **only if** IPv6 works end to end | **DNS only** |
| `example.com. MX 10 mail.example.com.` | MX | `@` | `mail.example.com` | Priority `10`; MX is not a proxied type |
| `example.com. TXT "v=spf1 mx ~all"` | TXT | `@` | `v=spf1 mx ~all` | — |
| `mail._domainkey.example.com. TXT "v=DKIM1; …"` | TXT | `mail._domainkey` | the exact DKIM string the script printed | — |
| `_dmarc.example.com. TXT "v=DMARC1; …"` | TXT | `_dmarc` | the exact DMARC string the script printed | — |

Name is the relative host: Cloudflare appends the zone. Do not paste
`mail.example.com` into Name for the A record.

Do not add AAAA unless IPv6 actually works (Docker IPv6 is often off). If the
script has not generated DKIM yet, boot the stack once and re-run
`./deploy/dns-records.sh` — do not invent a `p=` value.

## Token-scoped API

A Cloudflare API token with **Zone.DNS Edit** on this zone can create the same
records. Values still come from `./deploy/dns-records.sh`. The mail A record
must send `"proxied":false`:

```bash
# CF_TOKEN = Zone.DNS Edit token; CF_ZONE = this zone's ID.
# Paste <VPS IP> and the DKIM/DMARC strings from ./deploy/dns-records.sh.
# Feed the bearer header through curl config on stdin so the token stays off argv.
printf 'header = "Authorization: Bearer %s"\n' "$CF_TOKEN" | \
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \
  -H "Content-Type: application/json" \
  -K - \
  --data '{"type":"A","name":"mail.example.com","content":"<VPS IP>","proxied":false,"ttl":300}'
```

The full five-record helper stays on [DNS setup](/docs/guides/dns-setup/#cloudflare-api-shortcut).
`"proxied":false` on `mail` is mandatory. PTR is still not a Cloudflare record.

## PTR stays at the VPS host

`dns-records.sh` prints reverse DNS as `SERVER_IP -> mail.DOMAIN`. Create that
at Hetzner / DigitalOcean / Vultr / AWS, not under DNS → Records.

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
only Cloudflare's preview. `doctor.sh` does not log in over IMAP/SMTP or send a
round-trip message.
