---
title: "Amazon Route 53 DNS for openagent.email"
description: Create dns-records.sh records in the authoritative public hosted zone, with MX priority plus FQDN and DKIM TXT in 255-character quoted chunks.
---

Start from the values printed by `./deploy/dns-records.sh`. This page maps those
A, MX, SPF, DKIM, and DMARC records into Amazon Route 53. Do not invent IPs or
DKIM material — paste what the script prints.

The generic record meanings live in [DNS setup](/docs/guides/dns-setup/).

No live AWS account or DNS mutation was performed for this content card. Console field names, TXT size rules, and Elastic IP reverse DNS were checked against current official AWS documentation, not against a live console session.

## Authoritative public hosted zone

Create records in the **authoritative public hosted zone** for your `DOMAIN` —
the zone whose NS records the registrar actually delegates. A private hosted
zone does not answer public MX lookups.

In the Route 53 console:
[Hosted zones → your zone → Create record](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html).
Use Simple routing. TTL 300 is fine while you iterate.

Apex **Record name** is blank (Route 53 already knows the zone name).
[MX Value](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html)
is one field: **priority plus FQDN**, for example `10 mail.example.com.`

Changes generally reach Route 53 name servers within 60 seconds. Public
resolvers still honor TTL, so `dig @1.1.1.1` can lag the console.

## Record map

Assume the script printed records for `example.com` / `mail.example.com`.
Substitute your `DOMAIN` and paste the script's values.

| Script record | Record name | Type | Value |
|---|---|---|---|
| `mail.example.com. A <IPv4>` | `mail` | A | the IPv4 from the script |
| `mail.example.com. AAAA <IPv6>` | `mail` | AAAA | the IPv6 from the script, **only if** IPv6 works end to end |
| `example.com. MX 10 mail.example.com.` | *(leave blank)* | MX | `10 mail.example.com.` |
| `example.com. TXT "v=spf1 mx ~all"` | *(leave blank)* | TXT | `"v=spf1 mx ~all"` |
| `mail._domainkey.example.com. TXT "v=DKIM1; …"` | `mail._domainkey` | TXT | the script's DKIM string, split into quoted chunks of at most 255 characters |
| `_dmarc.example.com. TXT "v=DMARC1; …"` | `_dmarc` | TXT | `"v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com"` (or the exact string the script printed) |

Do not add AAAA unless IPv6 works end to end. If DKIM is not generated yet,
boot the stack once and re-run `./deploy/dns-records.sh`. Do not invent a `p=`
value.

## DKIM TXT chunking

Route 53 TXT values are strings of at most 255 characters. A 2048-bit DKIM
record is longer than that. Take the **single-line** DKIM value printed by
`./deploy/dns-records.sh` and split it into adjacent quoted chunks of at most
255 characters:

```
"v=DKIM1; k=rsa; p=<first-chunk>" "<next-chunk>"
```

Route 53 concatenates the quoted chunks. Do not insert spaces inside the key.
After save, `dig TXT mail._domainkey.example.com` must reconstruct to the
script's exact string. Do not paste one unbroken 300+ character TXT and hope
the console splits it.

## PTR is an EC2 Elastic IP action, not a hosted-zone record

`dns-records.sh` prints reverse DNS as `SERVER_IP -> mail.DOMAIN`. For an EC2
Elastic IP, that is not a PTR record in the hosted zone.

[Configure reverse DNS on the Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Elastic_Addressing_Reverse_DNS.html)
after the forward `mail` A record exists and matches. Creating a PTR inside
the public hosted zone does not set the reverse mapping for an AWS-owned IP.

## Verify

```bash
./deploy/doctor.sh

dig @1.1.1.1 +short A      mail.example.com
dig @1.1.1.1 +short MX     example.com
dig @1.1.1.1 +short TXT    example.com
dig @1.1.1.1 +short TXT    mail._domainkey.example.com
dig @1.1.1.1 +short TXT    _dmarc.example.com
```

Replace `example.com` with your `DOMAIN`. Check a public resolver, not only
the Route 53 console. `doctor.sh` does not log in over IMAP/SMTP or send a
round-trip message.
