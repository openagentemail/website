import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { isIP } from 'node:net';
import { parse } from 'parse5';

const quickstart = await readFile(new URL('../src/content/docs/docs/quickstart.md', import.meta.url), 'utf8');
const connect = await readFile(new URL('../src/content/docs/docs/guides/connect-your-agent.md', import.meta.url), 'utf8');
const otp = await readFile(new URL('../src/content/docs/docs/guides/otp-extraction.md', import.meta.url), 'utf8');
const dnsSetup = await readFile(new URL('../src/content/docs/docs/guides/dns-setup.md', import.meta.url), 'utf8');
const dnsCloudflare = await readFile(new URL('../src/content/docs/docs/guides/dns-cloudflare.md', import.meta.url), 'utf8');
const dnsNamecheap = await readFile(new URL('../src/content/docs/docs/guides/dns-namecheap.md', import.meta.url), 'utf8');
const dnsRoute53 = await readFile(new URL('../src/content/docs/docs/guides/dns-route53.md', import.meta.url), 'utf8');
const playwrightOtp = await readFile(new URL('../src/content/docs/docs/guides/playwright-email-otp.md', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/content/docs/docs/reference/api.md', import.meta.url), 'utf8');
const mcpClients = await readFile(new URL('../src/content/docs/docs/reference/mcp-clients.md', import.meta.url), 'utf8');
const mcp = await readFile(new URL('../src/pages/mcp.astro', import.meta.url), 'utf8');
const homepage = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const astroConfig = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const QUICKSTART_TITLE = 'Quickstart: Deploy openagent.email on a VPS with Docker Compose';
const QUICKSTART_DESCRIPTION =
  'Deploy openagent.email on a VPS with Docker Compose and an HTTPS reverse proxy — from zero to a working agent mailbox in about 10 minutes.';
const CONNECT_TITLE = 'Connect Your Agent to openagent.email (MCP + REST)';
const CONNECT_DESCRIPTION =
  'Wire Claude Desktop, Cursor, and REST into openagent.email — CLI, desktop, and web chat in one place.';
const OTP_TITLE = 'Agent email verification: extract OTP codes and links';
const OTP_DESCRIPTION =
  'Wait for an agent verification email over MCP or REST, then read otp.codes, otp.links, or the raw-body fallback before expiry.';
const MCP_DOCUMENT_TITLE = 'openagent.email MCP Server — Claude, Cursor, and Agents';
const MCP_DESCRIPTION =
  'Route Claude, Cursor, and other agents to the openagent.email MCP server: local stdio, self-hosted remote HTTP/OAuth, or the hosted connector.';
const MCP_CANONICAL = 'https://openagent.email/mcp/';
const JSONLD_MIME = 'ld+json';
const DNS_CLOUDFLARE_TITLE = 'Cloudflare DNS for openagent.email';
const DNS_CLOUDFLARE_DESCRIPTION =
  'Map A, MX, SPF, DKIM, and DMARC from dns-records.sh into Cloudflare DNS Records, with mail A/AAAA left DNS only.';
const DNS_NAMECHEAP_TITLE = 'Namecheap DNS for openagent.email';
const DNS_NAMECHEAP_DESCRIPTION =
  'Map dns-records.sh into Namecheap BasicDNS, PremiumDNS, or FreeDNS using Custom MX and relative Host values.';
const DNS_ROUTE53_TITLE = 'Amazon Route 53 DNS for openagent.email';
const DNS_ROUTE53_DESCRIPTION =
  'Create dns-records.sh records in the authoritative public hosted zone, with MX priority plus FQDN and DKIM TXT in 255-character quoted chunks.';
const PLAYWRIGHT_OTP_TITLE = 'Playwright email OTP for agent sign-ups';
const PLAYWRIGHT_OTP_DESCRIPTION =
  'Start POST /v1/messages/wait before signup, then use a scoped oa_ identity token to consume otp.codes or HTTPS links.';

const ARTIFACTS = {
  quickstart: 'dist/docs/quickstart/index.html',
  connect: 'dist/docs/guides/connect-your-agent/index.html',
  mcp: 'dist/mcp/index.html',
  otp: 'dist/docs/guides/otp-extraction/index.html',
  dnsSetup: 'dist/docs/guides/dns-setup/index.html',
  dnsCloudflare: 'dist/docs/guides/dns-cloudflare/index.html',
  dnsNamecheap: 'dist/docs/guides/dns-namecheap/index.html',
  dnsRoute53: 'dist/docs/guides/dns-route53/index.html',
  playwrightOtp: 'dist/docs/guides/playwright-email-otp/index.html',
  api: 'dist/docs/reference/api/index.html',
  mcpClients: 'dist/docs/reference/mcp-clients/index.html',
};

const REQUIRED_LINKS = [
  { source: 'Quickstart', markup: quickstart, href: '/docs/guides/connect-your-agent/' },
  { source: 'Quickstart', markup: quickstart, href: '/docs/guides/security/' },
  { source: 'Quickstart', markup: quickstart, href: '/docs/guides/deliverability/' },
  { source: 'Connect', markup: connect, href: '/docs/quickstart/' },
  { source: 'Connect', markup: connect, href: '/mcp/' },
  { source: 'Connect', markup: connect, href: '/docs/guides/otp-extraction/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/guides/connect-your-agent/' },
  { source: 'OTP extraction', markup: otp, href: '/mcp/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/reference/api/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/guides/security/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/guides/agent-signup/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/guides/playwright-email-otp/' },
  { source: 'OTP extraction', markup: otp, href: '/docs/reference/mcp-clients/#external-mail-fence-expected-not-a-bug' },
  { source: 'DNS setup', markup: dnsSetup, href: '/docs/guides/dns-cloudflare/' },
  { source: 'DNS setup', markup: dnsSetup, href: '/docs/guides/dns-namecheap/' },
  { source: 'DNS setup', markup: dnsSetup, href: '/docs/guides/dns-route53/' },
  { source: 'Cloudflare DNS', markup: dnsCloudflare, href: '/docs/guides/dns-setup/' },
  { source: 'Namecheap DNS', markup: dnsNamecheap, href: '/docs/guides/dns-setup/' },
  { source: 'Route 53 DNS', markup: dnsRoute53, href: '/docs/guides/dns-setup/' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: '/docs/guides/otp-extraction/' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: '/docs/guides/agent-signup/' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: '/docs/guides/security/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/quickstart/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/connect-your-agent/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/reference/mcp-clients/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/public-mcp/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/reference/api/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/otp-extraction/' },
  { source: 'MCP hub', markup: mcp, href: '/compare#mailslurp' },
];

const OFFICIAL_LINKS = [
  { source: 'Cloudflare DNS', markup: dnsCloudflare, href: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/' },
  { source: 'Cloudflare DNS', markup: dnsCloudflare, href: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/email-records/' },
  { source: 'Cloudflare DNS', markup: dnsCloudflare, href: 'https://developers.cloudflare.com/dns/troubleshooting/email-issues/#is-email-routing-turned-on' },
  { source: 'Cloudflare DNS', markup: dnsCloudflare, href: 'https://developers.cloudflare.com/email-service/configuration/domains/#remove-a-domain-from-email-routing' },
  { source: 'Namecheap DNS', markup: dnsNamecheap, href: 'https://www.namecheap.com/support/knowledgebase/article.aspx/322/2237/how-can-i-set-up-mx-records-required-for-mail-service/' },
  { source: 'Namecheap DNS', markup: dnsNamecheap, href: 'https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/' },
  { source: 'Route 53 DNS', markup: dnsRoute53, href: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html' },
  { source: 'Route 53 DNS', markup: dnsRoute53, href: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html' },
  { source: 'Route 53 DNS', markup: dnsRoute53, href: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Elastic_Addressing_Reverse_DNS.html' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: 'https://playwright.dev/docs/api-testing' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: 'https://playwright.dev/docs/test-fixtures' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: 'https://playwright.dev/docs/best-practices' },
  { source: 'Playwright email OTP', markup: playwrightOtp, href: 'https://playwright.dev/docs/api/class-page#page-wait-for-timeout' },
];

const OTP_CONTRACT_TERMS = [
  'mail_wait_for',
  'mail_read_message',
  'POST /v1/messages/wait',
  'GET /v1/messages/:id',
  'otp.codes',
  'otp.links',
];

const quickstartMeta = frontmatter(quickstart, 'Quickstart');
assertPinnedMetadata('Quickstart', quickstartMeta, QUICKSTART_TITLE, QUICKSTART_DESCRIPTION);
assert.match(quickstartMeta.description, /Docker Compose/, 'Quickstart description must name Docker Compose');
assert.match(quickstartMeta.description, /HTTPS reverse proxy/, 'Quickstart description must name HTTPS reverse proxy');
assert.doesNotMatch(quickstart, /Traefik/i, 'Quickstart must not name Traefik');
assert.match(quickstart, /## Next steps/, 'Quickstart must include a Next steps cluster');

const connectMeta = frontmatter(connect, 'Connect');
assertPinnedMetadata('Connect', connectMeta, CONNECT_TITLE, CONNECT_DESCRIPTION);
assert.match(connectMeta.description, /Claude Desktop/, 'Connect description must name Claude Desktop');
assert.match(connectMeta.description, /Cursor/, 'Connect description must name Cursor');
assert.match(connectMeta.description, /REST/, 'Connect description must name REST');

const otpMeta = frontmatter(otp, 'OTP extraction');
assertPinnedMetadata('OTP extraction', otpMeta, OTP_TITLE, OTP_DESCRIPTION);

for (const term of OTP_CONTRACT_TERMS) {
  assert.ok(otp.includes(term), `OTP guide is missing required contract term: ${term}`);
}
assert.match(otp, /best-effort/i, 'OTP guide must explain best-effort extraction');
assert.match(otp, /untrusted/, 'OTP guide must require untrusted-body handling');
assert.match(otp, /5–10 minutes|5-10 minutes/, 'OTP guide must explain short OTP expiry');
assert.match(otp, /Captcha, KYC/, 'OTP guide must keep captcha/KYC boundaries');
assert.match(otp, /Don't bulk-register/, 'OTP guide must keep the bulk-registration boundary');
assert.match(
  otp,
  /^export API=http:\/\/localhost:3100$/m,
  'OTP guide is missing API setup: export API=http://localhost:3100',
);
assert.match(
  otp,
  /^export KEY=oa_your-identity-token$/m,
  'OTP guide is missing identity-token setup: export KEY=oa_your-identity-token',
);
assert.doesNotMatch(
  otp,
  /your-admin-key/,
  'OTP guide must not use the admin-key placeholder',
);
assert.match(
  otp,
  /must belong to the mailbox/,
  'OTP guide must say the identity token belongs to the target mailbox',
);
assert.match(otp, /`html` is optional/, 'OTP guide must describe html as optional, not always present');
assert.doesNotMatch(
  otp,
  /`html` are always there|`html` is always present|html is always present/i,
  'OTP guide must not say html is always present',
);
assert.match(otp, /expected\s+sender/, 'OTP guide is missing expected-sender validation');
assert.match(
  otp,
  /HTTPS URL on the expected signup destination host/,
  'OTP guide is missing HTTPS expected-host/destination validation',
);
assert.match(
  otp,
  /mail_wait_for\([^\n]*fromContains/,
  'OTP MCP wait is missing fromContains',
);
assert.match(otp, /"fromContains"/, 'OTP REST wait is missing fromContains');
assert.match(
  otp,
  /Before using `otp\.codes\[0\]` or `otp\.links\[0\]`, match the expected\s+sender/,
  'OTP guide must validate expected sender before codes and links',
);
assert.match(
  otp,
  /REST exposes the raw body/,
  'OTP guide must state that REST exposes the raw body',
);
assert.match(otp, /nonce fence/, 'OTP guide must mention the MCP nonce fence');
assert.match(
  otp,
  /external or missing-source|external\/missing-source/,
  'OTP guide must distinguish MCP fencing for external/missing-source bodies',
);
assert.match(
  otp,
  /\/docs\/reference\/mcp-clients\/#external-mail-fence-expected-not-a-bug/,
  'OTP guide is missing the MCP fencing contract link',
);
assert.match(
  otp,
  /MCP does not return a raw external body/,
  'OTP guide must not call the MCP external body raw',
);
assert.match(
  otp,
  /\$MESSAGE_ID/,
  'OTP REST read is missing $MESSAGE_ID',
);
assert.match(
  otp,
  /^export MESSAGE_ID=REPLACE_WITH_WAIT_RESPONSE_ID$/m,
  'OTP guide is missing a valid MESSAGE_ID assignment: export MESSAGE_ID=REPLACE_WITH_WAIT_RESPONSE_ID',
);
assert.doesNotMatch(
  otp,
  /^export MESSAGE_ID=</m,
  'OTP guide must not use an invalid export MESSAGE_ID=< assignment',
);
assert.doesNotMatch(
  otp,
  /\/v1\/messages\/42/,
  'OTP guide must not hardcode /v1/messages/42',
);
assert.match(
  otp,
  /`MESSAGE_ID` is the `id` returned by the successful wait response/,
  'OTP guide must say MESSAGE_ID comes from the successful wait id',
);

assert.match(mcp, /import Legal from '\.\.\/layouts\/Legal\.astro'/, 'MCP hub must use Legal.astro');
assert.equal(
  pageConst(mcp, 'pageTitle'),
  MCP_DOCUMENT_TITLE,
  `MCP hub document title must be ${JSON.stringify(MCP_DOCUMENT_TITLE)}`,
);
assert.equal(
  pageConst(mcp, 'pageDescription'),
  MCP_DESCRIPTION,
  `MCP hub description must be ${JSON.stringify(MCP_DESCRIPTION)}`,
);
assert.match(mcp, /documentTitle=\{pageTitle\}/, 'MCP hub must pass the exact document title through Legal');
const mcpCanonicals = [...mcp.matchAll(/rel="canonical" href="([^"]+)"/g)].map((match) => match[1]);
assert.equal(
  mcpCanonicals.length,
  1,
  `/mcp/ source canonical count: expected 1, actual ${mcpCanonicals.length}`,
);
assert.equal(
  mcpCanonicals[0],
  MCP_CANONICAL,
  `/mcp/ source canonical href: expected ${MCP_CANONICAL}, actual ${mcpCanonicals[0]}`,
);
assert.match(mcp, /local stdio/, 'MCP hub must route local stdio users');
assert.match(mcp, /self-hosted remote HTTP\/OAuth/, 'MCP hub must route self-hosted remote HTTP/OAuth users');
assert.match(mcp, /[Hh]osted connector/, 'MCP hub must route hosted connector users');
assert.match(
  mcp,
  /openagent\.email can be self-hosted; MailSlurp's MCP is hosted SaaS/,
  'MCP hub must state the bounded self-hosted vs hosted SaaS distinction',
);
assert.doesNotMatch(mcp, /FAQPage|application\/ld\+json|ld\+json/, 'MCP hub must not add FAQ JSON-LD');
const mcpFaqHeadings = [...mcp.matchAll(/<h2>([^<]*\?)<\/h2>/g)].map((match) => match[1]);
assert.ok(
  mcpFaqHeadings.length >= 2 && mcpFaqHeadings.length <= 3,
  `MCP hub must include 2–3 semantic FAQ headings; actual ${mcpFaqHeadings.length}: ${mcpFaqHeadings.join(' | ')}`,
);

const docsFooter = homepage.match(/<h4>Docs<\/h4>\s*<ul>([\s\S]*?)<\/ul>/);
assert.ok(docsFooter, 'Homepage is missing the Docs footer list');
assert.ok(
  docsFooter[1].includes('href="/mcp/"'),
  'missing required link: homepage Docs footer → /mcp/',
);
assert.ok(
  docsFooter[1].includes('href="/docs/guides/otp-extraction/"'),
  'missing required link: homepage Docs footer → /docs/guides/otp-extraction/',
);
assert.match(docsFooter[1], />MCP overview</, 'Homepage Docs footer must label the MCP hub as MCP overview');
assert.match(
  docsFooter[1],
  />OTP extraction guide</,
  'Homepage Docs footer must label the OTP page as OTP extraction guide',
);

assert.match(
  astroConfig,
  /label: 'Guides',\s*items: \[[^\]]*['"]docs\/guides\/otp-extraction['"]/s,
  'OTP extraction guide must be in the existing Guides sidebar',
);

const guidesItems = astroConfig.match(/label: 'Guides',\s*items: \[([\s\S]*?)\],\n\s+\}/);
assert.ok(guidesItems, 'Guides sidebar items are missing');
const guideSlugs = [...guidesItems[1].matchAll(/['"](docs\/guides\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.deepEqual(
  guideSlugs.slice(0, 4),
  [
    'docs/guides/dns-setup',
    'docs/guides/dns-cloudflare',
    'docs/guides/dns-namecheap',
    'docs/guides/dns-route53',
  ],
  'provider pages must follow DNS setup in the Guides sidebar',
);
const otpSidebarIndex = guideSlugs.indexOf('docs/guides/otp-extraction');
assert.equal(
  guideSlugs[otpSidebarIndex + 1],
  'docs/guides/playwright-email-otp',
  'Playwright page must follow OTP extraction in the Guides sidebar',
);

const dnsCloudflareMeta = frontmatter(dnsCloudflare, 'Cloudflare DNS');
assertPinnedMetadata('Cloudflare DNS', dnsCloudflareMeta, DNS_CLOUDFLARE_TITLE, DNS_CLOUDFLARE_DESCRIPTION);
const dnsNamecheapMeta = frontmatter(dnsNamecheap, 'Namecheap DNS');
assertPinnedMetadata('Namecheap DNS', dnsNamecheapMeta, DNS_NAMECHEAP_TITLE, DNS_NAMECHEAP_DESCRIPTION);
const dnsRoute53Meta = frontmatter(dnsRoute53, 'Route 53 DNS');
assertPinnedMetadata('Route 53 DNS', dnsRoute53Meta, DNS_ROUTE53_TITLE, DNS_ROUTE53_DESCRIPTION);
const playwrightOtpMeta = frontmatter(playwrightOtp, 'Playwright email OTP');
assertPinnedMetadata('Playwright email OTP', playwrightOtpMeta, PLAYWRIGHT_OTP_TITLE, PLAYWRIGHT_OTP_DESCRIPTION);

for (const [label, markup] of [
  ['Cloudflare DNS', dnsCloudflare],
  ['Namecheap DNS', dnsNamecheap],
  ['Route 53 DNS', dnsRoute53],
  ['Playwright email OTP', playwrightOtp],
]) {
  assert.match(
    markup,
    /No live[\s\S]{0,160}mutation was performed for this content card/,
    `${label} must state that no live mutation E2E was performed for this content card`,
  );
  assert.match(
    markup,
    /official .+ documentation/,
    `${label} must say UI labels/behavior were checked against current official documentation`,
  );
}

for (const [label, markup] of [
  ['Cloudflare DNS', dnsCloudflare],
  ['Namecheap DNS', dnsNamecheap],
  ['Route 53 DNS', dnsRoute53],
]) {
  assert.match(markup, /\.\/deploy\/dns-records\.sh/, `${label} must start from ./deploy/dns-records.sh`);
  assert.match(markup, /\.\/deploy\/doctor\.sh/, `${label} must end with ./deploy/doctor.sh`);
  assert.match(markup, /dig @1\.1\.1\.1/, `${label} must include public-resolver dig checks`);
  assertExactResolverIpv4Allowlist(markup, label);
}

assertExactResolverIpv4Allowlist(dnsCloudflare, 'Cloudflare DNS');
assert.doesNotThrow(
  () => assertExactResolverIpv4Allowlist('dig @1.1.1.1 +short A mail.example.com', 'exact 1.1.1.1 fixture'),
  'exact 1.1.1.1 must pass the IPv4 allowlist',
);
assert.throws(
  () => assertExactResolverIpv4Allowlist('dig @1.1.1.10 +short A mail.example.com', '1.1.1.10 fixture'),
  /1\.1\.1\.10|exact|1\.1\.1\.1/,
  '1.1.1.10 must fail the exact IPv4 allowlist',
);
assert.throws(
  () => assertExactResolverIpv4Allowlist('dig @1.1.1.19 +short A mail.example.com', '1.1.1.19 fixture'),
  /1\.1\.1\.19|exact|1\.1\.1\.1/,
  '1.1.1.19 must fail the exact IPv4 allowlist',
);
assert.throws(
  () => assertExactResolverIpv4Allowlist('dig @203.0.113.10 +short A mail.example.com', 'arbitrary IPv4 fixture'),
  /203\.0\.113\.10|exact|1\.1\.1\.1/,
  'an arbitrary IPv4 literal must fail the exact IPv4 allowlist',
);
{
  const withPrefixHole = dnsCloudflare.replaceAll('1.1.1.1', '1.1.1.10');
  assert.throws(
    () => assertExactResolverIpv4Allowlist(withPrefixHole, 'Cloudflare DNS'),
    /1\.1\.1\.10|exact|1\.1\.1\.1/,
    'mutating the guide to 1.1.1.10 must fail the exact IPv4 allowlist',
  );
}
{
  const weakenedLookahead = (markup, label) => {
    assert.doesNotMatch(
      markup,
      /\b(?!1\.1\.1\.1)(?:\d{1,3}\.){3}\d{1,3}\b/,
      `${label} must not hardcode VPS IPv4 addresses`,
    );
  };
  assert.doesNotThrow(
    () => weakenedLookahead('dig @1.1.1.10 +short A mail.example.com', 'prefix-hole fixture'),
    'precondition: prefix-sensitive negative lookahead exempts 1.1.1.10',
  );
  assert.throws(
    () => assertExactResolverIpv4Allowlist('dig @1.1.1.10 +short A mail.example.com', 'prefix-hole fixture'),
    /1\.1\.1\.10|exact|1\.1\.1\.1/,
    'restoring/using the prefix-sensitive negative lookahead must not pass the exact allowlist contract',
  );
}

assert.match(
  dnsCloudflare,
  /mail `A`\/`AAAA` record must stay \*\*DNS only\*\*/,
  'Cloudflare guide must keep mail A/AAAA on DNS only',
);
assert.match(
  dnsCloudflare,
  /does not proxy SMTP/,
  'Cloudflare guide must not claim orange-cloud proxy supports SMTP',
);
assert.match(
  dnsCloudflare,
  /unproxied/,
  'Cloudflare MX must target the unproxied mail hostname',
);
assert.match(
  dnsCloudflare,
  /"proxied":false/,
  'Cloudflare API path must send proxied:false for the mail hostname',
);
assert.doesNotMatch(
  dnsCloudflare,
  /"proxied"\s*:\s*true/,
  'Cloudflare guide must not set proxied true on mail records',
);

assertCloudflareEmailRoutingPrerequisite(dnsCloudflare);
{
  const withoutRouting = dnsCloudflare
    .replace(/Email Routing[\s\S]*?(?=## |\| Script record)/, '');
  assert.throws(
    () => assertCloudflareEmailRoutingPrerequisite(withoutRouting),
    /Email Routing|prerequisite|MX|SPF/,
    'removing the Cloudflare Email Routing prerequisite must fail the source-contract validator',
  );
}
{
  const withoutOfficialLink = dnsCloudflare.replace(
    /https:\/\/developers\.cloudflare\.com\/email-service\/configuration\/domains\/#remove-a-domain-from-email-routing/g,
    'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/',
  );
  assert.throws(
    () => assertCloudflareEmailRoutingPrerequisite(withoutOfficialLink),
    /remove-a-domain-from-email-routing|Email Routing|official/,
    'replacing the Email Routing disable/cutover link must fail the source-contract validator',
  );
}

assertCloudflareCurlBearerOffArgv(dnsCloudflare);
assertCloudflareDnsApiARecordFqdn(dnsCloudflare);
{
  const unsafeArgvExample = `curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \\
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \\
  --data '{"type":"A","name":"mail.example.com","content":"<VPS IP>","proxied":false,"ttl":300}'`;
  const withBearerOnArgv = dnsCloudflare.includes('-H "Authorization: Bearer $CF_TOKEN"')
    ? dnsCloudflare
    : dnsCloudflare.replace(
      /printf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN" \| \\\ncurl -sS -X POST "https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/\$CF_ZONE\/dns_records" \\\n  -H "Content-Type: application\/json" \\\n  -K - \\\n  --data '\{"type":"A","name":"mail\.example\.com","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
      unsafeArgvExample,
    );
  assert.match(
    withBearerOnArgv,
    /-H "Authorization: Bearer \$CF_TOKEN"/,
    'precondition: bearer-on-argv mutation must restore Authorization Bearer on curl argv',
  );
  assert.throws(
    () => assertCloudflareCurlBearerOffArgv(withBearerOnArgv),
    /Authorization: Bearer|argv|CF_TOKEN|-H/,
    'restoring -H "Authorization: Bearer $CF_TOKEN" on curl argv must fail the source-contract validator',
  );
}
{
  const withoutStdinConfig = dnsCloudflare
    .replace(
      /\nprintf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN" \| \\\n/,
      '\n# $CF_TOKEN remains required in the environment.\n',
    )
    .replace(/\n\s*-K -\s*\\\n/, '\n')
    .replace(/\n\s*--config -\s*\\\n/, '\n');
  assert.throws(
    () => assertCloudflareCurlBearerOffArgv(withoutStdinConfig),
    /stdin|config|-K|Authorization|Bearer|argv|printf/,
    'removing the curl stdin/config bearer channel must fail the source-contract validator',
  );
}
{
  const relativeName = dnsCloudflare.replace(
    /"name":"mail\.example\.com"/,
    '"name":"mail"',
  );
  assert.match(
    relativeName,
    /"name":"mail"/,
    'precondition: A-record name mutation must restore relative "name":"mail"',
  );
  assert.throws(
    () => assertCloudflareDnsApiARecordFqdn(relativeName),
    /mail\.example\.com|"name"|FQDN|complete record name/,
    'restoring relative API "name":"mail" must fail the Cloudflare A-record FQDN validator',
  );
}

assertDnsSetupCloudflareHelperBearerOffArgv(dnsSetup);
{
  const withBearerOnArgv = dnsSetup.includes('-H "Authorization: Bearer $CF_TOKEN"')
    ? dnsSetup
    : dnsSetup.replace(
      /printf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN" \| \\\n\s*curl -sS -X POST "https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/\$CF_ZONE\/dns_records" \\\n\s*-H "Content-Type: application\/json" \\\n\s*-K - \\\n\s*--data "\$1"/,
      `curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \\
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \\
    --data "$1"`,
    );
  assert.match(
    withBearerOnArgv,
    /-H "Authorization: Bearer \$CF_TOKEN"/,
    'precondition: dns-setup bearer-on-argv mutation must restore Authorization Bearer on curl argv',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperBearerOffArgv(withBearerOnArgv),
    /Authorization: Bearer|argv|CF_TOKEN|-H/,
    'restoring -H "Authorization: Bearer $CF_TOKEN" on dns-setup curl argv must fail the source-contract validator',
  );
}

assertDnsSetupCloudflareHelperRecordFqdns(dnsSetup);
{
  const relativeA = dnsSetup.replace(
    /cf_add '\{"type":"A","name":"mail\.example\.com"/,
    'cf_add \'{"type":"A","name":"mail"',
  );
  assert.match(
    relativeA,
    /cf_add '\{"type":"A","name":"mail"/,
    'precondition: A-record mutation must restore relative "name":"mail"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeA),
    /mail\.example\.com|"name"|FQDN|complete record name|A-record/,
    'restoring relative API A "name":"mail" must fail the dns-setup FQDN validator',
  );
}
{
  const relativeMx = dnsSetup.replace(
    /cf_add '\{"type":"MX","name":"example\.com"/,
    'cf_add \'{"type":"MX","name":"@"',
  );
  assert.match(
    relativeMx,
    /cf_add '\{"type":"MX","name":"@"/,
    'precondition: MX-record mutation must restore relative "name":"@"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeMx),
    /example\.com|"name"|FQDN|complete record name|MX/,
    'restoring relative API MX "name":"@" must fail the dns-setup FQDN validator',
  );
}
{
  const relativeSpf = dnsSetup.replace(
    /cf_add '\{"type":"TXT","name":"example\.com","content":"v=spf1 mx ~all"/,
    'cf_add \'{"type":"TXT","name":"@","content":"v=spf1 mx ~all"',
  );
  assert.match(
    relativeSpf,
    /cf_add '\{"type":"TXT","name":"@","content":"v=spf1 mx ~all"/,
    'precondition: SPF TXT mutation must restore relative "name":"@"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeSpf),
    /example\.com|"name"|FQDN|complete record name|SPF/,
    'restoring relative API SPF "name":"@" must fail the dns-setup FQDN validator',
  );
}
{
  const relativeDkim = dnsSetup.replace(
    /cf_add '\{"type":"TXT","name":"mail\._domainkey\.example\.com"/,
    'cf_add \'{"type":"TXT","name":"mail._domainkey"',
  );
  assert.match(
    relativeDkim,
    /cf_add '\{"type":"TXT","name":"mail\._domainkey"/,
    'precondition: DKIM TXT mutation must restore relative "name":"mail._domainkey"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeDkim),
    /mail\._domainkey\.example\.com|"name"|FQDN|complete record name|DKIM/,
    'restoring relative API DKIM "name":"mail._domainkey" must fail the dns-setup FQDN validator',
  );
}
{
  const relativeDmarc = dnsSetup.replace(
    /cf_add '\{"type":"TXT","name":"_dmarc\.example\.com"/,
    'cf_add \'{"type":"TXT","name":"_dmarc"',
  );
  assert.match(
    relativeDmarc,
    /cf_add '\{"type":"TXT","name":"_dmarc"/,
    'precondition: DMARC TXT mutation must restore relative "name":"_dmarc"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeDmarc),
    /_dmarc\.example\.com|"name"|FQDN|complete record name|DMARC/,
    'restoring relative API DMARC "name":"_dmarc" must fail the dns-setup FQDN validator',
  );
}
{
  const weakenedFqdnCheck = (markup) => {
    assert.match(
      markup,
      /cf_add '\{"type":"A","name":"mail/,
      'weakened dns-setup A-record check accepts relative or FQDN mail names',
    );
  };
  const relativeA = dnsSetup.includes('"name":"mail.example.com"')
    ? dnsSetup.replace(
      /cf_add '\{"type":"A","name":"mail\.example\.com"/,
      'cf_add \'{"type":"A","name":"mail"',
    )
    : dnsSetup;
  assert.match(
    relativeA,
    /cf_add '\{"type":"A","name":"mail"/,
    'precondition: relative A name must be present for the weakened-validator probe',
  );
  assert.doesNotThrow(
    () => weakenedFqdnCheck(relativeA),
    'precondition: a weakened A-record check must accept relative "name":"mail"',
  );
  assert.throws(
    () => assertDnsSetupCloudflareHelperRecordFqdns(relativeA),
    /mail\.example\.com|"name"|FQDN|complete record name|A-record/,
    'restoring/using a weakened A-record check must not pass the dns-setup FQDN contract',
  );
}

assert.match(dnsNamecheap, /BasicDNS/, 'Namecheap guide must name BasicDNS');
assert.match(dnsNamecheap, /PremiumDNS/, 'Namecheap guide must name PremiumDNS');
assert.match(dnsNamecheap, /FreeDNS/, 'Namecheap guide must name FreeDNS');
assert.match(dnsNamecheap, /Custom MX/, 'Namecheap guide must use Custom MX');
assert.match(dnsNamecheap, /apex host is `@`/i, 'Namecheap apex host must be @');
assert.match(
  dnsNamecheap,
  /relative `mail\._domainkey`(?!\.)/,
  'Namecheap DKIM Host must be the relative mail._domainkey, not a duplicated full zone',
);
assert.match(
  dnsNamecheap,
  /TXT Record \| `mail\._domainkey` \|/,
  'Namecheap DKIM Host field must be mail._domainkey, not a duplicated full zone',
);
assert.match(
  dnsNamecheap,
  /Email Forwarding/,
  'Namecheap guide must warn about Email Forwarding / conflicting mail modes',
);

assert.match(
  dnsRoute53,
  /authoritative public hosted zone/,
  'Route 53 guide must require the authoritative public hosted zone',
);
assert.match(
  dnsRoute53,
  /Apex \*\*Record name\*\* is blank/,
  'Route 53 apex Record name must be blank',
);
assert.match(
  dnsRoute53,
  /priority plus FQDN/,
  'Route 53 MX value must include priority plus FQDN',
);
assert.match(
  dnsRoute53,
  /quoted chunks of at most 255 characters/,
  'Route 53 DKIM TXT must be split into quoted chunks of at most 255 characters',
);
assert.match(
  dnsRoute53,
  /Elastic IP/,
  'Route 53 PTR must be an EC2 Elastic IP action',
);
assert.match(
  dnsRoute53,
  /not a PTR record in the hosted zone/,
  'Route 53 guide must not treat PTR as a hosted-zone record',
);

const playwrightCode = fencedCode(playwrightOtp);
assert.match(playwrightOtp, /request` fixture/, 'Playwright guide must use the isolated request fixture');
assert.match(playwrightOtp, /APIRequestContext/, 'Playwright guide must name APIRequestContext');
assert.match(playwrightCode, /request\.post/, 'Playwright example must start POST /v1/messages/wait through request');
assert.match(playwrightCode, /\/v1\/messages\/wait/, 'Playwright example must call POST /v1/messages/wait');
assert.match(playwrightCode, /timeoutSec:\s*60/, 'Playwright wait must be bounded');
assert.doesNotMatch(
  playwrightCode,
  /test\.setTimeout\(90_000\)/,
  'Playwright example must not keep the old test.setTimeout(90_000) budget',
);
assert.match(
  playwrightCode,
  /test\.setTimeout\(180_000\)/,
  'Playwright example must set enclosing test timeout with test.setTimeout(180_000)',
);
assertAppearsBefore(
  playwrightCode,
  /test\.setTimeout\(180_000\)/,
  /request\.post/,
  'Playwright example must call test.setTimeout before request.post',
);
assertPlaywrightTimeoutBudget(playwrightCode);
assert.match(
  playwrightOtp,
  /140 seconds/,
  'Playwright guide prose must state the cumulative maximum of 140 seconds',
);
assert.match(
  playwrightOtp,
  /40 seconds/,
  'Playwright guide prose must state the remaining overhead of 40 seconds',
);
{
  const oldNinety = playwrightCode.replace(/test\.setTimeout\(180_000\)/, 'test.setTimeout(90_000)');
  assert.throws(
    () => assertPlaywrightTimeoutBudget(oldNinety),
    /180_000|90_000|enclosing|budget|cumulative/,
    'restoring test.setTimeout(90_000) must fail the cumulative timeout-budget validator',
  );
}
{
  const tooTight = playwrightCode.replace(/test\.setTimeout\(180_000\)/, 'test.setTimeout(140_000)');
  assert.throws(
    () => assertPlaywrightTimeoutBudget(tooTight),
    /180_000|cumulative|budget|exceed|overhead/,
    'lowering the enclosing timeout so it no longer exceeds all bounded phases must fail',
  );
}
assert.match(
  playwrightCode,
  /startsWith\('oa_'\)/,
  'Playwright example must use a scoped oa_ identity token, not an admin key',
);
assert.match(playwrightCode, /OAE_IDENTITY_TOKEN/, 'Playwright example must load the identity token from the environment');
assert.doesNotMatch(
  playwrightCode,
  /your-admin-key|API_KEYS/,
  'Playwright example must not use an admin key',
);
assert.match(
  playwrightOtp,
  /page\.waitForTimeout\(\)/,
  'Playwright guide must name page.waitForTimeout() in prose',
);
assert.doesNotMatch(
  playwrightCode,
  /waitForTimeout/,
  'Playwright example must not call page.waitForTimeout()',
);
const waitCallAt = playwrightCode.indexOf('request.post');
const failClosedAt = playwrightCode.search(
  /!mailbox \|\| !expectedSender \|\| !expectedSubject \|\| !signupUrl/,
);
assert.ok(
  failClosedAt !== -1,
  'Playwright example must fail closed when mailbox, expected sender, expected subject, or signup URL is empty',
);
assert.ok(
  waitCallAt !== -1 && failClosedAt < waitCallAt,
  'Playwright example must fail closed before starting the wait',
);
assert.doesNotMatch(
  playwrightCode,
  /toContain\(expectedSender/,
  'Playwright example must not use toContain(expectedSender); exact mailbox equality is required',
);
assert.doesNotMatch(
  playwrightCode,
  /console\.log/,
  'Playwright example must not log the mail body or code',
);
assert.match(
  playwrightCode,
  /expectedSender/,
  'Playwright example must validate expected sender before consuming otp.codes',
);
assert.match(
  playwrightCode,
  /test\.use\(\{\s*serviceWorkers:\s*'block'\s*\}\)/,
  "Playwright example must call test.use({ serviceWorkers: 'block' })",
);
assertPlaywrightOtpRedirectGuardSourceContract(playwrightCode);
assert.match(
  playwrightCode,
  /link\.protocol !== 'https:'|assertTrustedOtpUrl/,
  'Playwright example must require HTTPS before opening otp.links',
);
assert.match(
  playwrightCode,
  /link\.hostname !== expectedHost|assertTrustedOtpUrl/,
  'Playwright example must require the exact expected host before opening otp.links',
);
assertAppearsBefore(
  playwrightCode,
  /page\.goto\(signupUrl(?:,\s*\{[^}]*\})?\)/,
  /getByLabel\('Email'\)\.fill\(mailbox(?:,\s*\{[^}]*\})?\)/,
  'Playwright example must page.goto(signupUrl) before filling the email field',
);
assertAppearsBefore(
  playwrightCode,
  /getByLabel\('Email'\)\.fill\(mailbox(?:,\s*\{[^}]*\})?\)/,
  /request\.post\([\s\S]*?\/v1\/messages\/wait/,
  'Playwright example must fill the email field before starting request.post(/v1/messages/wait)',
);
assertAppearsBefore(
  playwrightCode,
  /request\.post\([\s\S]*?\/v1\/messages\/wait/,
  /getByRole\('button', \{ name: 'Sign up' \}\)\.click\((?:\{[^}]*\})?\)/,
  'Playwright example must start request.post(/v1/messages/wait) before the Sign up click',
);
assertPlaywrightWaitPreparationOrder(playwrightCode);
{
  const waitBeforePrep = playwrightCode
    .replace(
      /await page\.goto\(signupUrl(?:,\s*\{[^}]*\})?\);\n\s*await page\.getByLabel\('Email'\)\.fill\(mailbox(?:,\s*\{[^}]*\})?\);\n\s*/,
      '',
    )
    .replace(
      /const wait = request\.post\([\s\S]*?\n  \}\);/,
      (block) => `${block}\n\n  await page.goto(signupUrl, { timeout: 30_000 });\n  await page.getByLabel('Email').fill(mailbox, { timeout: 10_000 });`,
    );
  assert.throws(
    () => assertPlaywrightWaitPreparationOrder(waitBeforePrep),
    /page\.goto\(signupUrl|request\.post|preparation|before/,
    'moving page.goto/email fill after request.post must fail the wait-order validator',
  );
}
{
  const withoutGoto = playwrightCode.replace(/await page\.goto\(signupUrl(?:,\s*\{[^}]*\})?\);\n\s*/, '');
  assert.throws(
    () => assertPlaywrightWaitPreparationOrder(withoutGoto),
    /page\.goto\(signupUrl|preparation/,
    'removing page.goto(signupUrl) preparation must fail the wait-order validator',
  );
}
assertAppearsBefore(
  playwrightCode,
  /expect\(parseSingleMailbox\(String\(message\.from\)\)\)\.toBe\(parseSingleMailbox\(expectedSender\)\)/,
  /message\.otp\.codes\[0\]/,
  'Playwright example must exact-match the normalized sender before message.otp.codes[0]',
);
assertPlaywrightOtpLinkSourceContract(playwrightCode);
assertAppearsBefore(
  playwrightCode,
  /isIP\(/,
  /page\.goto\(link\.toString\(\)\)/,
  'Playwright example must apply the IP-literal guard before page.goto(link.toString())',
);
assert.throws(
  () => acceptOtpLinkFromSourceContract(playwrightCode, 'https://192.0.2.1/otp', '192.0.2.1'),
  /OTP link|HTTPS|host|IP/i,
  'IPv4 literal OTP host must be rejected even when it equals OAE_EXPECTED_HOST',
);
{
  const ipv6OtpUrl = 'https://[2001:db8::1]/otp';
  const ipv6ExpectedHost = '[2001:db8::1]';
  assert.equal(
    new URL(ipv6OtpUrl).hostname,
    ipv6ExpectedHost,
    'precondition: Node URL.hostname for bracketed IPv6 equals the exact OAE_EXPECTED_HOST value',
  );
  assert.throws(
    () => acceptOtpLinkFromSourceContract(playwrightCode, ipv6OtpUrl, ipv6ExpectedHost),
    /OTP link|HTTPS|host|IP/i,
    'IPv6 literal OTP host must be rejected even when it equals OAE_EXPECTED_HOST',
  );
}
assert.equal(
  acceptOtpLinkFromSourceContract(playwrightCode, 'https://verify.example.com/otp', 'verify.example.com').hostname,
  'verify.example.com',
  'exact HTTPS DNS hostname must pass the OTP link guard',
);

// GitHub #60 (test(docs): add real-browser OTP redirect regression smoke):
// this suite extracts and executes the guide's manual route.fetch loop against stubs only.
// It does not supply the real-browser redirect regression requested by #60.
assertPlaywrightOtpManualRedirectProse(playwrightOtp);
assertPlaywrightVerificationLinkSelfContained(playwrightOtp);
await assertPlaywrightWaitClickSemanticsFromGuide(playwrightOtp);
assertPlaywrightImmediateWaitObserver(playwrightOtp);
assertPlaywrightBearerWaitMaxRedirects(playwrightOtp);
assertPlaywrightOtpRouteTypeAnnotation(playwrightCode);

{
  const initialHttp = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'http://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {},
  });
  assert.equal(initialHttp.outcome, 'abort', 'initial HTTP OTP URL must abort before any route.fetch');
  assert.deepEqual(initialHttp.fetchedUrls, [], 'untrusted initial HTTP URL must never reach route.fetch');
}

{
  const sameHost = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'https://verify.example.com/step2' },
      },
      'https://verify.example.com/step2': {
        status: 200,
        headers: {},
      },
    },
  });
  assert.equal(sameHost.outcome, 'fulfill', 'same-host HTTPS redirect must fulfill the terminal response');
  assert.deepEqual(
    sameHost.fetchedUrls,
    ['https://verify.example.com/otp', 'https://verify.example.com/step2'],
    'same-host HTTPS redirect must fetch only the initial URL and the validated next hop',
  );
  assert.equal(sameHost.fulfilledStatus, 200, 'terminal same-host response must be fulfilled');
  assert.equal(sameHost.continued, false, 'top-level OTP navigation must not fall back to route.continue()');
}

{
  const relative = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: '/relative-next' },
      },
      'https://verify.example.com/relative-next': {
        status: 200,
        headers: {},
      },
    },
  });
  assert.equal(relative.outcome, 'fulfill', 'relative Location redirect must resolve and fulfill');
  assert.deepEqual(
    relative.fetchedUrls,
    ['https://verify.example.com/otp', 'https://verify.example.com/relative-next'],
    'relative Location must resolve against the current hop before fetch',
  );
}

{
  const toHttp = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'http://verify.example.com/escaped' },
      },
    },
  });
  assert.equal(toHttp.outcome, 'abort', 'HTTP redirect target must abort/fail closed');
  assert.deepEqual(
    toHttp.fetchedUrls,
    ['https://verify.example.com/otp'],
    'HTTP redirect target must never reach route.fetch',
  );
}

{
  const toOtherHost = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'https://evil.example.com/otp' },
      },
    },
  });
  assert.equal(toOtherHost.outcome, 'abort', 'different-host redirect target must abort/fail closed');
  assert.deepEqual(
    toOtherHost.fetchedUrls,
    ['https://verify.example.com/otp'],
    'different-host redirect target must never reach route.fetch',
  );
}

{
  const toIpv4 = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'https://192.0.2.1/otp' },
      },
    },
  });
  assert.equal(toIpv4.outcome, 'abort', 'IPv4 redirect target must abort/fail closed');
  assert.deepEqual(toIpv4.fetchedUrls, ['https://verify.example.com/otp'], 'IPv4 redirect target must never reach route.fetch');
}

{
  const toIpv6 = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'https://[2001:db8::1]/otp' },
      },
    },
  });
  assert.equal(toIpv6.outcome, 'abort', 'IPv6 redirect target must abort/fail closed');
  assert.deepEqual(toIpv6.fetchedUrls, ['https://verify.example.com/otp'], 'IPv6 redirect target must never reach route.fetch');
}

{
  const missingLocation = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: {},
      },
    },
  });
  assert.equal(missingLocation.outcome, 'abort', 'missing Location on a redirect response must fail closed');
  assert.deepEqual(missingLocation.fetchedUrls, ['https://verify.example.com/otp']);
}

{
  const malformedLocation = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        status: 302,
        headers: { location: 'https://[not-a-valid-url' },
      },
    },
  });
  assert.equal(malformedLocation.outcome, 'abort', 'malformed Location must fail closed');
  assert.deepEqual(malformedLocation.fetchedUrls, ['https://verify.example.com/otp']);
}

{
  const fiveHopChain = {};
  const hops = [
    'https://verify.example.com/otp',
    'https://verify.example.com/h1',
    'https://verify.example.com/h2',
    'https://verify.example.com/h3',
    'https://verify.example.com/h4',
    'https://verify.example.com/h5',
  ];
  for (let i = 0; i < hops.length - 1; i += 1) {
    fiveHopChain[hops[i]] = { status: 302, headers: { location: hops[i + 1] } };
  }
  fiveHopChain[hops[5]] = { status: 200, headers: {} };
  const fiveHops = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: hops[0],
    expectedHost: 'verify.example.com',
    chain: fiveHopChain,
  });
  assert.equal(fiveHops.outcome, 'fulfill', 'five redirect hops may complete and fulfill the terminal response');
  assert.deepEqual(fiveHops.fetchedUrls, hops, 'exactly five redirects followed means six fetches including the terminal URL');
  assert.equal(fiveHops.fulfilledStatus, 200);
}

{
  const sixHopChain = {};
  const hops = [
    'https://verify.example.com/otp',
    'https://verify.example.com/h1',
    'https://verify.example.com/h2',
    'https://verify.example.com/h3',
    'https://verify.example.com/h4',
    'https://verify.example.com/h5',
    'https://verify.example.com/h6',
  ];
  for (let i = 0; i < hops.length - 1; i += 1) {
    sixHopChain[hops[i]] = { status: 302, headers: { location: hops[i + 1] } };
  }
  sixHopChain[hops[6]] = { status: 200, headers: {} };
  const overflow = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: hops[0],
    expectedHost: 'verify.example.com',
    chain: sixHopChain,
  });
  assert.equal(overflow.outcome, 'abort', 'a sixth redirect must overflow fail-closed');
  assert.deepEqual(
    overflow.fetchedUrls,
    hops.slice(0, 6),
    'sixth redirect target must not be fetched (stop after the fifth redirect response)',
  );
  assert.equal(overflow.fetchedUrls.includes(hops[6]), false, 'overflow must not fetch the sixth redirect target');
}

{
  const nonNav = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://evil.example.com/otp',
    expectedHost: 'verify.example.com',
    isNavigation: false,
    chain: {},
  });
  assert.equal(nonNav.outcome, 'continue', 'non-navigation requests must continue even when the URL would fail OTP validation');
  assert.deepEqual(nonNav.fetchedUrls, [], 'non-navigation requests must not enter the manual redirect fetch loop');
}

{
  const fetchThrows = await runOtpRedirectManualLoopFromGuide(playwrightCode, {
    initialUrl: 'https://verify.example.com/otp',
    expectedHost: 'verify.example.com',
    chain: {
      'https://verify.example.com/otp': {
        throws: true,
        message: 'stub route.fetch failure',
      },
    },
  });
  assert.equal(fetchThrows.outcome, 'abort', 'route.fetch throw must abort fail-closed via the extracted handler catch path');
  assert.equal(fetchThrows.aborted, true, 'route.fetch throw must call route.abort()');
  assert.equal(fetchThrows.continued, false, 'route.fetch throw must not fall back to route.continue()');
  assert.deepEqual(
    fetchThrows.fetchedUrls,
    ['https://verify.example.com/otp'],
    'route.fetch throw still records the attempted fetch URL before fail-closed abort',
  );
}

{
  const routeCalls = [];
  const unrouteCalls = [];
  const namedHandler = async function abortUntrustedOtpNavigation() {
    throw new Error('named handler must not run during the goto-throw cleanup probe');
  };
  const page = {
    context() {
      return {
        async route(pattern, handler) {
          routeCalls.push({ pattern, handler });
        },
        async unroute(pattern, handler) {
          unrouteCalls.push({ pattern, handler });
        },
      };
    },
    async goto() {
      throw new Error('forced page.goto failure');
    },
  };
  const link = {
    toString() {
      return 'https://verify.example.com/otp';
    },
  };
  const runInstallGotoUnroute = extractOtpRouteInstallGotoUnrouteFromGuide(playwrightCode);
  await assert.rejects(
    () => runInstallGotoUnroute(page, link, namedHandler),
    /forced page\.goto failure/,
    'extracted guide route/try/finally block must still surface the page.goto failure',
  );
  assert.equal(routeCalls.length, 1, 'extracted guide block must install exactly one context route');
  assert.equal(routeCalls[0].pattern, '**/*', 'extracted guide block must route **/*');
  assert.equal(
    routeCalls[0].handler,
    namedHandler,
    'extracted guide block must install the exact named abortUntrustedOtpNavigation handler',
  );
  assert.equal(unrouteCalls.length, 1, 'page.goto throw must still execute exactly one finally unroute');
  assert.equal(unrouteCalls[0].pattern, '**/*', 'finally unroute must target **/*');
  assert.equal(
    unrouteCalls[0].handler,
    namedHandler,
    'finally must unroute the exact named abortUntrustedOtpNavigation handler after page.goto throws',
  );
}

{
  const withoutIpGuard = playwrightCode
    .replace(/\n\s*const hostForIpCheck[\s\S]*?;\n/, '\n')
    .replace(/\s*\|\|\s*isIP\(hostForIpCheck\) !== 0/, '');
  assert.throws(
    () => assertPlaywrightOtpLinkSourceContract(withoutIpGuard),
    /isIP|IP-literal|hostForIpCheck/,
    'removing the IP-literal guard must fail the OTP link source-contract validator',
  );
}
{
  const ipBlockMatch = playwrightCode.match(
    /\n\s*const hostForIpCheck[\s\S]*?throw new Error\('refusing to visit OTP link:[^']*'\);\n\s*\}\n/,
  );
  assert.ok(ipBlockMatch, 'Playwright example is missing the OTP link IP guard block for reorder mutation');
  const withoutBlock = playwrightCode.replace(ipBlockMatch[0], '\n');
  const gotoAt = withoutBlock.search(/page\.goto\(link\.toString\(\)\)/);
  assert.ok(gotoAt !== -1, 'reorder mutation could not find page.goto(link.toString())');
  const movedAfterGoto = `${withoutBlock.slice(0, gotoAt + 'page.goto'.length)}${ipBlockMatch[0]}${withoutBlock.slice(gotoAt + 'page.goto'.length)}`;
  assert.throws(
    () => assertPlaywrightOtpLinkSourceContract(movedAfterGoto),
    /before page\.goto|isIP|IP-literal/,
    'moving the IP-literal guard after page.goto must fail the OTP link source-contract validator',
  );
}
{
  const weakened = playwrightCode.replace(
    /isIP\(hostForIpCheck\) !== 0/,
    'isIP(hostForIpCheck) === 4 && false',
  );
  assert.throws(
    () => assertPlaywrightOtpLinkSourceContract(weakened),
    /isIP|weaken|IP-literal/,
    'weakening the IP-literal guard must fail the OTP link source-contract validator',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(weakened),
    /isIP|weaken|validator|assertTrustedOtpUrl/,
    'weakening/removing the shared validator must fail the OTP redirect-guard validator',
  );
}
{
  const withoutContextRoute = playwrightCode.replace(
    /await page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\);\n\s*/,
    '',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutContextRoute),
    /context\(\)\.route|route/,
    'removing the browserContext route must fail the OTP redirect-guard validator',
  );
}
{
  const withPageRoute = playwrightCode.replace(
    /page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\)/,
    "page.route('**/*', abortUntrustedOtpNavigation)",
  ).replace(
    /page\.context\(\)\.unroute\('\*\*\/\*', abortUntrustedOtpNavigation\)/,
    "page.unroute('**/*', abortUntrustedOtpNavigation)",
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withPageRoute),
    /page\.route|context\(\)\.route|browserContext/,
    'substituting page.route for browserContext.route must fail the OTP redirect-guard validator',
  );
}
{
  const routeInstall = playwrightCode.match(
    /\n\s*await page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\);\n/,
  );
  assert.ok(routeInstall, 'Playwright example is missing context.route install for reorder mutation');
  const withoutInstall = playwrightCode.replace(routeInstall[0], '\n');
  const gotoAt = withoutInstall.search(/page\.goto\(link\.toString\(\)\)/);
  assert.ok(gotoAt !== -1, 'route-after-goto mutation could not find page.goto(link.toString())');
  const afterGoto = `${withoutInstall.slice(0, gotoAt)}${withoutInstall.slice(gotoAt).replace(
    /page\.goto\(link\.toString\(\)\);/,
    `page.goto(link.toString());${routeInstall[0]}`,
  )}`;
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(afterGoto),
    /before page\.goto|route|install/,
    'moving route installation after page.goto must fail the OTP redirect-guard validator',
  );
}
{
  const withoutServiceWorkers = playwrightCode.replace(
    /test\.use\(\{\s*serviceWorkers:\s*'block'\s*\}\);\n?/g,
    '',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutServiceWorkers),
    /serviceWorkers:\s*'block'/,
    "removing test.use({ serviceWorkers: 'block' }) must fail the OTP redirect-guard validator",
  );
}
{
  const withoutMaxRedirects = playwrightCode.replace(
    /route\.fetch\(\{\s*url:\s*currentUrl,\s*maxRedirects:\s*0\s*\}\)/,
    'route.fetch({ url: currentUrl })',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutMaxRedirects),
    /maxRedirects:\s*0/,
    'deleting route.fetch maxRedirects: 0 must fail the OTP redirect-guard validator',
  );
}
{
  const fences = playwrightOtpWaitClickFences(playwrightOtp);
  assert.equal(fences.length, 2, 'precondition: exactly two wait/click TypeScript fences');
  for (const [index, fence] of fences.entries()) {
    const withoutWaitMaxRedirects = playwrightOtp.replace(
      fence,
      fence.replace(/\n\s*maxRedirects:\s*0\s*,?/, '\n'),
    );
    // Keep route.fetch maxRedirects intact so only the bearer-wait lock is exercised.
    assert.match(
      withoutWaitMaxRedirects,
      /route\.fetch\(\{\s*url:\s*currentUrl,\s*maxRedirects:\s*0\s*\}\)/,
      `precondition: fence ${index + 1} bearer-wait maxRedirects deletion must leave route.fetch maxRedirects: 0`,
    );
    assert.throws(
      () => assertPlaywrightBearerWaitMaxRedirects(withoutWaitMaxRedirects),
      /maxRedirects:\s*0|bearer wait|request\.post|fence/,
      `deleting maxRedirects: 0 from bearer wait fence ${index + 1} must fail the OTP wait redirect lock`,
    );
  }
}
{
  const weakenedWaitRedirectCheck = (markup) => {
    assert.match(
      markup,
      /route\.fetch\(\{\s*url:\s*currentUrl,\s*maxRedirects:\s*0\s*\}\)/,
      'weakened check accepts route.fetch maxRedirects and ignores bearer wait options',
    );
  };
  const fence = playwrightOtpWaitClickFences(playwrightOtp)[0];
  const withoutWaitMaxRedirects = playwrightOtp.replace(
    fence,
    fence.replace(/\n\s*maxRedirects:\s*0\s*,?/, '\n'),
  );
  assert.doesNotThrow(
    () => weakenedWaitRedirectCheck(withoutWaitMaxRedirects),
    'precondition: a weakened redirect check must pass when only route.fetch keeps maxRedirects: 0',
  );
  assert.throws(
    () => assertPlaywrightBearerWaitMaxRedirects(withoutWaitMaxRedirects),
    /maxRedirects:\s*0|bearer wait|request\.post|fence/,
    'relaxing the wait redirect lock to route.fetch alone must not pass the bearer-wait contract',
  );
}
{
  const withoutHopCap = playwrightCode
    .replace(/\n\s*const OTP_REDIRECT_MAX = 5;\n/, '\n')
    .replace(/redirectsFollowed >= OTP_REDIRECT_MAX/g, 'false');
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutHopCap),
    /OTP_REDIRECT_MAX|hop|redirect/,
    'deleting/neutralizing the hop cap must fail the OTP redirect-guard validator',
  );
}
{
  const allowsHttp = playwrightCode.replace(
    /link\.protocol !== 'https:'/,
    "link.protocol !== 'https:' && link.protocol !== 'http:'",
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(allowsHttp),
    /https:|http:|protocol|validator/,
    'allowing http: in the shared validator must fail the OTP redirect-guard validator',
  );
}
{
  const continuesDisallowed = playwrightCode.replace(
    /await route\.abort\(\);\n\s*return;/,
    'await route.continue();\n      return;',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(continuesDisallowed),
    /abort|disallowed|continue|fulfill/,
    'continuing a disallowed top-level navigation must fail the OTP redirect-guard validator',
  );
}
{
  const withoutFinally = playwrightCode.replace(
    /try \{\n\s*await page\.goto\(link\.toString\(\)\);\n\s*\} finally \{\n\s*await page\.context\(\)\.unroute\('\*\*\/\*', abortUntrustedOtpNavigation\);\n\s*\}/,
    'await page.goto(link.toString());',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutFinally),
    /finally|unroute/,
    'omitting finally/unroute cleanup must fail the OTP redirect-guard validator',
  );
}
{
  const withoutImmediateObserver = playwrightOtp.replace(
    /\n\s*void wait\.catch\(\(\)\s*=>\s*\{\}\);\n/g,
    '\n',
  );
  assert.throws(
    () => assertPlaywrightImmediateWaitObserver(withoutImmediateObserver),
    /immediate|void wait\.catch|observer|before.*Sign up|creation turn/i,
    'deleting the immediate wait rejection observer must fail',
  );
  await assert.rejects(
    () => assertPlaywrightWaitClickSemanticsFromGuide(withoutImmediateObserver),
    /unhandledRejection|immediate|void wait\.catch|observer/i,
    'deleting the immediate observer must fail the executable wait/click harness',
  );
}
{
  const movedLate = playwrightOtp.replace(
    /\n\s*void wait\.catch\(\(\)\s*=>\s*\{\}\);\n(\s*await page\.getByRole\('button', \{ name: 'Sign up' \}\)\.click\(\{ timeout: 10_000 \}\);)/g,
    '\n$1\n  void wait.catch(() => {});',
  );
  assert.match(
    movedLate,
    /Sign up' \}\)\.click[\s\S]*?void wait\.catch/,
    'precondition: observer-after-click mutation must place void wait.catch after the Sign up click',
  );
  assert.throws(
    () => assertPlaywrightImmediateWaitObserver(movedLate),
    /immediate|void wait\.catch|observer|before.*Sign up|creation turn/i,
    'moving the wait rejection observer after the Sign up click must fail',
  );
  await assert.rejects(
    () => assertPlaywrightWaitClickSemanticsFromGuide(movedLate),
    /unhandledRejection|immediate|void wait\.catch|observer|before/i,
    'moving the observer after the click must fail the executable wait/click harness',
  );
}
{
  const withoutRouteTypeImport = playwrightCode.replace(
    /import \{ expect, test, type Route \} from '@playwright\/test';/g,
    "import { expect, test } from '@playwright/test';",
  );
  assert.throws(
    () => assertPlaywrightOtpRouteTypeAnnotation(withoutRouteTypeImport),
    /type Route|Route/,
    'deleting the Playwright Route type import must fail',
  );
}
{
  const withoutRouteAnnotation = playwrightCode.replace(
    /async function abortUntrustedOtpNavigation\(route: Route\)/,
    'async function abortUntrustedOtpNavigation(route)',
  );
  assert.throws(
    () => assertPlaywrightOtpRouteTypeAnnotation(withoutRouteAnnotation),
    /route: Route|Route/,
    'deleting the route: Route parameter annotation must fail',
  );
}
{
  const linkFence = verificationLinkTypescriptFence(playwrightOtp);
  const outerOnly = linkFence
    .replace(/const message = await response\.json\(\);\n/, '')
    .replace(/async \(\{\s*page\s*,\s*request\s*\}\)/, 'async ({ request })');
  assert.throws(
    () => assertPlaywrightVerificationLinkSelfContained(
      playwrightOtp.replace(linkFence, outerOnly),
    ),
    /self-contained|message|page|callback|scope|async \(\{/,
    'verification-link fence using out-of-scope message/page must fail',
  );
}

assertPlaywrightOaeApiUrlSourceContract(playwrightCode);
assert.equal(
  playwrightCode.includes("?? 'http://localhost:3100'"),
  true,
  'Playwright example must keep the documented local default http://localhost:3100',
);
assert.throws(
  () => acceptOaeApiUrlFromSourceContract(playwrightCode, 'http://mailbox.example.test'),
  /OAE_API/,
  'remote http://mailbox.example.test must be rejected before bearer request',
);
assert.throws(
  () => acceptOaeApiUrlFromSourceContract(playwrightCode, 'http://localhost.evil'),
  /OAE_API/,
  'deceptive http://localhost.evil must be rejected before bearer request',
);
assert.equal(
  acceptOaeApiUrlFromSourceContract(playwrightCode, 'http://localhost:3100').origin,
  'http://localhost:3100',
  'documented local default must remain usable after URL validation',
);
assert.equal(
  acceptOaeApiUrlFromSourceContract(playwrightCode, 'https://mail.example.com').protocol,
  'https:',
  'https OAE_API must be permitted for any hostname',
);
{
  const withoutValidation = playwrightCode
    .replace(/\n\s*const apiUrl = new URL\(api\);[\s\S]*?throw new Error\('OAE_API[^']*'\);\n\s*\}\n/, '\n')
    .replace(/\$\{apiUrl\.origin\}/g, '${api}');
  assert.throws(
    () => assertPlaywrightOaeApiUrlSourceContract(withoutValidation),
    /OAE_API|new URL|request\.post|apiUrl/,
    'removing URL validation must fail the source-contract validator',
  );
}
{
  const urlBlockMatch = playwrightCode.match(
    /\n\s*const apiUrl = new URL\(api\);[\s\S]*?throw new Error\('OAE_API[^']*'\);\n\s*\}\n/,
  );
  assert.ok(urlBlockMatch, 'Playwright example is missing the OAE_API validation block for reorder mutation');
  const withoutBlock = playwrightCode.replace(urlBlockMatch[0], '\n');
  const postAt = withoutBlock.search(/request\.post\(/);
  assert.ok(postAt !== -1, 'reorder mutation could not find request.post');
  const movedAfterPost = `${withoutBlock.slice(0, postAt + 'request.post'.length)}${urlBlockMatch[0]}${withoutBlock.slice(postAt + 'request.post'.length)}`;
  assert.throws(
    () => assertPlaywrightOaeApiUrlSourceContract(movedAfterPost),
    /before request\.post|OAE_API|new URL/,
    'moving URL validation after request.post must fail the source-contract validator',
  );
}
{
  const withEvilHost = playwrightCode.replace(
    "new Set(['localhost', '127.0.0.1', '[::1]'])",
    "new Set(['localhost', '127.0.0.1', '[::1]', 'localhost.evil'])",
  );
  assert.throws(
    () => assertPlaywrightOaeApiUrlSourceContract(withEvilHost),
    /exact three-member|allowHttpLoopback|localhost\.evil|Set/,
    'adding localhost.evil to the allowlist Set must fail the source-contract validator',
  );
}
{
  const withPrefixApprox = playwrightCode.replace(
    /allowHttpLoopback\.has\(apiUrl\.hostname\)/,
    "apiUrl.hostname.startsWith('localhost')",
  );
  assert.throws(
    () => assertPlaywrightOaeApiUrlSourceContract(withPrefixApprox),
    /prefix|suffix|substring|allowHttpLoopback\.has|approximation/,
    'replacing allowHttpLoopback.has with a prefix approximation must fail the source-contract validator',
  );
}

assertPlaywrightSenderSourceContract(playwrightCode);
assert.ok(
  'trusted@example.com.attacker.test'.toLowerCase().includes('trusted@example.com'.toLowerCase()),
  'sanity: attacker mailbox would pass substring containment against trusted@example.com',
);
assert.throws(
  () => assertExactNormalizedSender(playwrightCode, 'trusted@example.com.attacker.test', 'trusted@example.com'),
  /exact|mailbox|sender|match/i,
  'trusted@example.com.attacker.test must not satisfy expected trusted@example.com',
);
assert.equal(
  assertExactNormalizedSender(playwrightCode, 'trusted@example.com', 'trusted@example.com'),
  'trusted@example.com',
);
assert.equal(
  assertExactNormalizedSender(playwrightCode, 'Name <trusted@example.com>', 'trusted@example.com'),
  'trusted@example.com',
);
assert.equal(
  assertExactNormalizedSender(playwrightCode, 'Trusted@Example.com', 'trusted@example.com'),
  'trusted@example.com',
);
assert.equal(
  assertExactNormalizedSender(playwrightCode, '"Doe, Jane" <trusted@example.com>', 'trusted@example.com'),
  'trusted@example.com',
  'quoted display-name with a comma must parse as one mailbox',
);
assert.throws(
  () => assertExactNormalizedSender(playwrightCode, 'not-an-email', 'trusted@example.com'),
  /mailbox|malformed|exact|sender/i,
  'malformed sender input must fail closed',
);
assert.throws(
  () => assertExactNormalizedSender(playwrightCode, 'a@b.com, c@d.com', 'a@b.com'),
  /mailbox|multiple|exact|sender/i,
  'multiple-address sender input must fail closed',
);
assert.throws(
  () => assertExactNormalizedSender(playwrightCode, 'Alias <a@b.com>, Other <c@d.com>', 'a@b.com'),
  /mailbox|multiple|exact|sender/i,
  'multiple angled mailboxes must fail closed',
);
{
  const withContainment = playwrightCode.replace(
    /expect\(parseSingleMailbox\(String\(message\.from\)\)\)\.toBe\(parseSingleMailbox\(expectedSender\)\);/,
    "expect(String(message.from).toLowerCase()).toContain(expectedSender.toLowerCase());",
  );
  assert.throws(
    () => assertPlaywrightSenderSourceContract(withContainment),
    /toContain\(expectedSender/,
    'restoring toContain(expectedSender) must fail the sender source-contract validator',
  );
}

assertPlaywrightSubjectSourceContract(playwrightCode);
assert.equal(
  evaluateDocumentedSubjectGate(playwrightCode, '   '),
  false,
  'whitespace-only OAE_EXPECTED_SUBJECT must be rejected by the documented fail-closed condition',
);
assert.equal(
  evaluateDocumentedSubjectGate(playwrightCode, 'Verify your account'),
  true,
  'non-empty trimmed OAE_EXPECTED_SUBJECT must pass the documented fail-closed condition',
);
{
  const hardCodedVerify = playwrightCode
    .replace(/subjectContains:\s*expectedSubject/, "subjectContains: 'verify'");
  assert.throws(
    () => assertPlaywrightSubjectSourceContract(hardCodedVerify),
    /subjectContains|verify|expectedSubject/,
    "hard-coded subjectContains: 'verify' must fail the subject source-contract validator",
  );
}
{
  const untrimmed = playwrightCode.replace(
    /const expectedSubject = \(process\.env\.OAE_EXPECTED_SUBJECT \?\? ''\)\.trim\(\);/,
    "const expectedSubject = process.env.OAE_EXPECTED_SUBJECT ?? '';",
  );
  assert.throws(
    () => assertPlaywrightSubjectSourceContract(untrimmed),
    /trim|expectedSubject|OAE_EXPECTED_SUBJECT/,
    'untrimmed OAE_EXPECTED_SUBJECT assignment must fail the subject source-contract validator',
  );
}
{
  const withoutSubjectGate = playwrightCode.replace(
    /!mailbox \|\| !expectedSender \|\| !expectedSubject \|\| !signupUrl/,
    '!mailbox || !expectedSender || !signupUrl',
  );
  assert.throws(
    () => assertPlaywrightSubjectSourceContract(withoutSubjectGate),
    /expectedSubject|fail-closed|OAE_EXPECTED_SUBJECT/,
    'removing expectedSubject from the fail-closed condition must fail the subject source-contract validator',
  );
}
assert.match(
  playwrightOtp,
  /expected sender/,
  'Playwright guide must validate expected sender before consuming OTP',
);
assert.match(
  playwrightOtp,
  /exact expected host/,
  'Playwright guide must require HTTPS and the exact expected host before navigation',
);
assert.match(playwrightOtp, /busy-poll/, 'Playwright guide must forbid busy polling');
assert.match(playwrightOtp, /traces/, 'Playwright guide must warn that traces can capture short-lived credentials');
assert.match(playwrightOtp, /videos/, 'Playwright guide must warn that videos can capture short-lived credentials');
assert.match(playwrightOtp, /screenshots/, 'Playwright guide must warn that screenshots can capture short-lived credentials');
assert.match(playwrightOtp, /reports/, 'Playwright guide must warn that reports can capture short-lived credentials');
assert.match(
  playwrightOtp,
  /distinct mailbox per worker/,
  'Playwright guide must require a distinct mailbox per parallel worker or unique correlation',
);
assert.match(
  playwrightOtp,
  /fresh|cleared/i,
  'Playwright guide must require a fresh/cleared inbox when the mailbox is reused',
);
assert.match(
  playwrightOtp,
  /unique subject|per-run unique|subject correlation/i,
  'Playwright guide must allow a per-run unique subject correlation string for stale-mail safety',
);
assert.match(
  playwrightOtp,
  /pre-existing|stale/i,
  'Playwright guide must warn that a pre-existing/stale message must not satisfy the wait',
);
assert.match(playwrightOtp, /Never put the admin key/, 'Playwright guide must forbid the admin key');
assert.match(
  astroConfig,
  /'\/alternatives\/mailslurp': '\/compare#mailslurp'/,
  'astro.config.mjs redirects must remain unchanged',
);

assert.equal(pkg.scripts['test:seo-docs'], 'node --test tests/seo-docs.test.mjs');
assert.equal(pkg.scripts['test:seo-docs-rendered'], 'node tests/seo-docs.test.mjs --check-rendered');
assert.equal(
  pkg.scripts.prebuild,
  'npm run test:compare-freshness && npm run test:hosted-checkout && npm run test:mail-security-docs && npm run test:iphone-mail-guide && npm run test:jsonld && npm run test:seo-docs && npm run test:llms-txt',
  'prebuild must preserve prior gates and add the seo-docs source leg',
);
assert.equal(
  pkg.scripts.postbuild,
  'npm run test:compare-rendered && npm run test:jsonld-rendered && npm run test:seo-docs-rendered && npm run test:llms-txt-rendered',
  'postbuild must preserve prior gates and add the seo-docs rendered leg',
);

for (const [label, markup] of [
  ['Quickstart', quickstart],
  ['Connect', connect],
  ['OTP extraction', otp],
  ['MCP hub', mcp],
  ['DNS setup', dnsSetup],
  ['Cloudflare DNS', dnsCloudflare],
  ['Namecheap DNS', dnsNamecheap],
  ['Route 53 DNS', dnsRoute53],
  ['Playwright email OTP', playwrightOtp],
]) {
  assert.equal(
    markup.includes(JSONLD_MIME),
    false,
    `Only components/JsonLd.astro may contain the reserved JSON-LD MIME substring; found it in ${label}`,
  );
}

for (const link of REQUIRED_LINKS) {
  assertHasHref(link.markup, link.href, link.source);
}
for (const link of OFFICIAL_LINKS) {
  assertHasHref(link.markup, link.href, link.source);
}

// GitHub #62: move remaining curl bearer headers off process argv
await assertNoCurlBearerOnArgvAcrossContent();
assertCurlBearerOffArgvPattern(quickstart, 'Quickstart', 1);
assertCurlBearerOffArgvPattern(otp, 'OTP extraction', 2);
assertCurlBearerOffArgvPattern(api, 'API reference', 20);

// #62 Negative mutations: restoring -H "Authorization: Bearer" or removing stdin config must fail
{
  const unsafeExample = 'curl -X POST $API/v1/identities -H "Authorization: Bearer $KEY"';
  assert.throws(
    () => assertNoCurlBearerOnArgv(unsafeExample, 'unsafe-fixture'),
    /Authorization:\s*Bearer/i,
    'assertNoCurlBearerOnArgv must reject -H "Authorization: Bearer"',
  );
}
{
  const withoutConfigStdin = api.replace(/--config\s+-/g, '');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(withoutConfigStdin, 'mutated-api', 20),
    /config/i,
    'assertCurlBearerOffArgvPattern must reject curl snippet without stdin config',
  );
}
{
  // 靶向突变 1：删掉整条 printf 行（token 引用随之而去）——计数 20→19 必须红。
  const singleBlockAuthLoss = api.replace(
    /printf 'header = "Authorization: Bearer %s"\\n' "\$[A-Z_]+"\s*\|\s*\\\n/,
    '',
  );
  assert.notEqual(singleBlockAuthLoss, api, 'mutation fixture must actually change api.md source');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(singleBlockAuthLoss, 'single-block-loss', 20),
    /found \d+/,
    'per-block guard must reject a single block silently losing its auth header',
  );
}
{
  // 靶向突变 2（闸3 r2 P2 的存在性配对盲区）：printf 改灌 cat >/dev/null、
  // curl --config - 原样保留——"两件都在"但连接已断、计数不变，存在性配对
  // 会假绿；连接性配对必须红（token 变量路径或计数路径均可）。
  const catBypass = api.replace(
    /('header = "Authorization: Bearer %s"\\n' "[^"]+")\s*\|\s*\\\n(?=curl)/,
    '$1 | cat >/dev/null \\\n',
  );
  assert.notEqual(catBypass, api, 'cat-bypass fixture must actually change api.md source');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(catBypass, 'cat-bypass', 20),
    /token variable|found \d+/,
    'connected-pipe guard must reject printf piped away from the curl that reads stdin config',
  );
}
{
  // 靶向突变 3（闸3 r3）：curl 向后接管到 cat 并把 --config - 挂它身上——
  // 运算符跨界假绿，命令段字符类必须拒。
  const onwardPipe = api.replace(
    /curl -X POST \$API\/v1\/identities \\\n/,
    'curl -X POST $API/v1/identities | cat --config - \\\n',
  );
  assert.notEqual(onwardPipe, api, 'onward-pipe fixture must actually change api.md source');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(onwardPipe, 'onward-pipe', 20),
    /token variable|found \d+/,
    'guard must reject --config - attached to a command after a pipe operator',
  );
}
{
  // 靶向突变 4（闸3 r3）：&& 后接 echo --config -——同命令边界假绿。
  const andEcho = api.replace(
    /curl -X POST \$API\/v1\/identities \\\n/,
    'curl -X POST $API/v1/identities && echo --config - \\\n',
  );
  assert.notEqual(andEcho, api, 'and-echo fixture must actually change api.md source');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(andEcho, 'and-echo', 20),
    /token variable|found \d+/,
    'guard must reject --config - appearing after a command separator',
  );
}
{
  // 靶向突变 5（闸3 r3）：注释掉真实 producer 行——注释不是命令，
  // 剥注释后连接断裂、token 引用同随注释而去，计数路径必须红。
  const commentedProducer = api.replace(
    /(\n)(printf 'header = "Authorization: Bearer %s"\\n')/,
    '$1# $2',
  );
  assert.notEqual(commentedProducer, api, 'commented-producer fixture must actually change api.md source');
  assert.throws(
    () => assertCurlBearerOffArgvPattern(commentedProducer, 'commented-producer', 20),
    /found \d+/,
    'guard must reject a block whose auth producer exists only in a comment',
  );
}

// GitHub #61: make OTP response-shape failures explicit
assertPlaywrightOtpShapeValidationSourceContract(playwrightCode);

// #61 Negative mutations: removing either shape check must fail
{
  const withoutCodesCheck = playwrightOtp.replace(
    /if\s*\(!message\?\.otp\?\.codes\?\.\[0\]\)\s*\{[\s\S]*?\}/,
    '',
  );
  assert.throws(
    () => assertPlaywrightOtpShapeValidationSourceContract(fencedCode(withoutCodesCheck)),
    /message\.otp\.codes\[0\]/,
    'removing message.otp.codes[0] shape check must fail assertPlaywrightOtpShapeValidationSourceContract',
  );
}
{
  const withoutLinksCheck = playwrightOtp.replace(
    /if\s*\(!message\?\.otp\?\.links\?\.\[0\]\)\s*\{[\s\S]*?\}/,
    '',
  );
  assert.throws(
    () => assertPlaywrightOtpShapeValidationSourceContract(fencedCode(withoutLinksCheck)),
    /message\.otp\.links\[0\]/,
    'removing message.otp.links[0] shape check must fail assertPlaywrightOtpShapeValidationSourceContract',
  );
}

// #3305: mcp-clients ChatGPT and Grok connector sections
assertMcpClientsChatGPTAndGrokSourceContract(mcpClients);

// #3305 Negative mutations: removing warning or Custom requirement must fail
{
  const withoutWarning = mcpClients.replace(/disconnect the previous connector before rebinding/i, '');
  assert.throws(
    () => assertMcpClientsChatGPTAndGrokSourceContract(withoutWarning),
    /disconnect.*previous connector/i,
    'removing disconnect previous connector warning must fail assertMcpClientsChatGPTAndGrokSourceContract',
  );
}
{
  const withoutCustom = mcpClients.replace(/Select \*\*Custom\*\*/, '');
  assert.throws(
    () => assertMcpClientsChatGPTAndGrokSourceContract(withoutCustom),
    /Custom/,
    'removing Grok Custom requirement must fail assertMcpClientsChatGPTAndGrokSourceContract',
  );
}

if (process.argv.includes('--check-rendered')) {
  const renderedByRoute = {
    quickstart: parse(await readArtifact(ARTIFACTS.quickstart)),
    connect: parse(await readArtifact(ARTIFACTS.connect)),
    mcp: parse(await readArtifact(ARTIFACTS.mcp)),
    otp: parse(await readArtifact(ARTIFACTS.otp)),
    dnsSetup: parse(await readArtifact(ARTIFACTS.dnsSetup)),
    dnsCloudflare: parse(await readArtifact(ARTIFACTS.dnsCloudflare)),
    dnsNamecheap: parse(await readArtifact(ARTIFACTS.dnsNamecheap)),
    dnsRoute53: parse(await readArtifact(ARTIFACTS.dnsRoute53)),
    playwrightOtp: parse(await readArtifact(ARTIFACTS.playwrightOtp)),
  };

  assertPinnedRenderedMetadata(renderedByRoute.quickstart, 'Quickstart', QUICKSTART_TITLE, QUICKSTART_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.connect, 'Connect', CONNECT_TITLE, CONNECT_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.otp, 'OTP extraction', OTP_TITLE, OTP_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.mcp, '/mcp/', MCP_DOCUMENT_TITLE, MCP_DESCRIPTION, { exactTitle: true });
  assertPinnedRenderedMetadata(renderedByRoute.dnsCloudflare, 'Cloudflare DNS', DNS_CLOUDFLARE_TITLE, DNS_CLOUDFLARE_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.dnsNamecheap, 'Namecheap DNS', DNS_NAMECHEAP_TITLE, DNS_NAMECHEAP_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.dnsRoute53, 'Route 53 DNS', DNS_ROUTE53_TITLE, DNS_ROUTE53_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.playwrightOtp, 'Playwright email OTP', PLAYWRIGHT_OTP_TITLE, PLAYWRIGHT_OTP_DESCRIPTION);

  const mcpCanonicalHrefs = canonicalHrefs(renderedByRoute.mcp);
  assert.equal(
    mcpCanonicalHrefs.length,
    1,
    `Built /mcp/ canonical count: expected 1, actual ${mcpCanonicalHrefs.length}`,
  );
  assert.equal(
    mcpCanonicalHrefs[0],
    MCP_CANONICAL,
    `Built /mcp/ canonical href: expected ${MCP_CANONICAL}, actual ${mcpCanonicalHrefs[0]}`,
  );

  const renderedPages = {
    '/docs/quickstart/': renderedByRoute.quickstart,
    '/docs/guides/connect-your-agent/': renderedByRoute.connect,
    '/mcp/': renderedByRoute.mcp,
    '/docs/guides/otp-extraction/': renderedByRoute.otp,
    '/docs/guides/dns-setup/': renderedByRoute.dnsSetup,
    '/docs/guides/dns-cloudflare/': renderedByRoute.dnsCloudflare,
    '/docs/guides/dns-namecheap/': renderedByRoute.dnsNamecheap,
    '/docs/guides/dns-route53/': renderedByRoute.dnsRoute53,
    '/docs/guides/playwright-email-otp/': renderedByRoute.playwrightOtp,
    '/': parse(await readArtifact('dist/index.html')),
  };

  for (const link of [
    ...REQUIRED_LINKS,
    { source: 'homepage', href: '/mcp/' },
    { source: 'homepage', href: '/docs/guides/otp-extraction/' },
  ]) {
    const document = renderedPages[sourceRoute(link.source)];
    assert.ok(document, `missing rendered route for link source ${link.source}`);
    assert.ok(
      hasRenderedHref(document, link.href),
      `missing required rendered link: ${link.source} → ${link.href}`,
    );
    await readArtifact(artifactForHref(link.href));
  }

  for (const link of OFFICIAL_LINKS) {
    const document = renderedPages[sourceRoute(link.source)];
    assert.ok(document, `missing rendered route for official link source ${link.source}`);
    assert.ok(
      hasRenderedHref(document, link.href),
      `missing required rendered official link: ${link.source} → ${link.href}`,
    );
  }

  const sitemap = await readSitemap();
  assert.match(sitemap, /https:\/\/openagent\.email\/mcp\//, 'sitemap is missing /mcp/');
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/otp-extraction\//,
    'sitemap is missing /docs/guides/otp-extraction/',
  );
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/dns-cloudflare\//,
    'sitemap is missing /docs/guides/dns-cloudflare/',
  );
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/dns-namecheap\//,
    'sitemap is missing /docs/guides/dns-namecheap/',
  );
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/dns-route53\//,
    'sitemap is missing /docs/guides/dns-route53/',
  );
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/playwright-email-otp\//,
    'sitemap is missing /docs/guides/playwright-email-otp/',
  );

  // GitHub #62: rendered curl bearer off argv
  const renderedQuickstart = await readArtifact(ARTIFACTS.quickstart);
  const renderedOtp = await readArtifact(ARTIFACTS.otp);
  const renderedApi = await readArtifact(ARTIFACTS.api);

  for (const [label, html, expectedConfigCount] of [
    ['Quickstart', renderedQuickstart, 1],
    ['OTP extraction', renderedOtp, 2],
    ['API reference', renderedApi, 20],
  ]) {
    assert.match(
      html,
      /--config\s+-/,
      `Rendered ${label} must contain the --config - pattern`,
    );
    // 渲染面数量钉：任一示例段静默丢失迁移（整页仍有他段 --config -）也会红
    const configCount = [...html.matchAll(/--config\s+-/g)].length;
    assert.ok(
      configCount === expectedConfigCount,
      `Rendered ${label} must contain exactly ${expectedConfigCount} --config - occurrence(s), found ${configCount}`,
    );
    assert.doesNotMatch(
      html,
      /-H\s+(&quot;|["'])Authorization:\s*Bearer/i,
      `Rendered ${label} must not place Authorization: Bearer on curl argv`,
    );
  }

  // Rendered negative mutation for #62
  assert.throws(
    () => {
      const mutated = renderedQuickstart + ' curl -H &quot;Authorization: Bearer $KEY&quot;';
      assert.doesNotMatch(
        mutated,
        /-H\s+(&quot;|["'])Authorization:\s*Bearer/i,
        'Rendered quickstart must not place Authorization: Bearer on curl argv',
      );
    },
    /Authorization:\s*Bearer/i,
    'Negative mutation: injecting -H "Authorization: Bearer" into rendered HTML must fail',
  );

  // GitHub #61: rendered OTP response-shape failures
  const renderedPlaywrightOtp = await readArtifact(ARTIFACTS.playwrightOtp);
  assert.match(
    renderedPlaywrightOtp,
    /OTP response missing message\.otp\.codes\[0\]/,
    'Rendered Playwright OTP page must contain message.otp.codes[0] error diagnostic',
  );
  assert.match(
    renderedPlaywrightOtp,
    /OTP response missing message\.otp\.links\[0\]/,
    'Rendered Playwright OTP page must contain message.otp.links[0] error diagnostic',
  );

  // Rendered negative mutation for #61
  assert.throws(
    () => {
      const withoutCodesError = renderedPlaywrightOtp.replaceAll('OTP response missing message.otp.codes[0]', '');
      assert.match(
        withoutCodesError,
        /OTP response missing message\.otp\.codes\[0\]/,
        'Rendered Playwright OTP page must contain message.otp.codes[0] error diagnostic',
      );
    },
    /message\.otp\.codes\[0\] error diagnostic/i,
    'Negative mutation: removing codes error from rendered HTML must fail',
  );

  // #3305: rendered mcp-clients ChatGPT & Grok sections
  const renderedMcpClients = await readArtifact(ARTIFACTS.mcpClients);
  assert.match(renderedMcpClients, /ChatGPT/, 'Rendered mcp-clients must contain ChatGPT');
  assert.match(renderedMcpClients, /Grok/, 'Rendered mcp-clients must contain Grok');
  assert.match(
    renderedMcpClients,
    /disconnect the previous connector before rebinding/i,
    'Rendered mcp-clients must contain disconnect warning callout',
  );
  assert.match(renderedMcpClients, /Custom/, 'Rendered mcp-clients must contain Grok Custom');
  assert.match(renderedMcpClients, /OAuth/, 'Rendered mcp-clients must contain Grok OAuth');

  // Rendered negative mutation for #3305
  assert.throws(
    () => {
      const withoutDisconnect = renderedMcpClients.replaceAll(/disconnect the previous connector before rebinding/gi, '');
      assert.match(
        withoutDisconnect,
        /disconnect the previous connector before rebinding/i,
        'Rendered mcp-clients must contain disconnect warning callout',
      );
    },
    /disconnect warning callout/i,
    'Negative mutation: removing disconnect warning from rendered HTML must fail',
  );
}

function frontmatter(source, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  assert.ok(match, `${label} is missing YAML frontmatter`);
  const title = yamlScalar(match[1], 'title');
  const description = yamlScalar(match[1], 'description');
  assert.ok(title != null, `${label} is missing title metadata`);
  assert.ok(description != null, `${label} is missing description metadata`);
  return { title, description };
}

function yamlScalar(block, key) {
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(block);
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function pageConst(source, name) {
  const match = new RegExp(`const ${name} =\\s*'([\\s\\S]*?)';`).exec(source);
  assert.ok(match, `MCP hub is missing ${name}`);
  return match[1];
}

function assertPinnedMetadata(label, meta, title, description) {
  assert.ok(String(meta.title).trim().length > 0, `${label} title is empty`);
  assert.ok(String(meta.description).trim().length > 0, `${label} description is empty`);
  assert.equal(meta.title, title, `${label} title must be ${JSON.stringify(title)}`);
  assert.equal(meta.description, description, `${label} description must be ${JSON.stringify(description)}`);
}

function assertHasHref(markup, href, source) {
  const linked = markup.includes(`](${href})`) || markup.includes(`href="${href}"`) || markup.includes(`href='${href}'`);
  assert.ok(linked, `missing required link: ${source} → ${href}`);
}

function assertPinnedRenderedMetadata(document, label, title, description, options = {}) {
  const renderedTitle = textOf(descendants(document).find((node) => node.nodeName === 'title')).trim();
  const renderedDescription = attribute(
    descendants(document).find((node) => node.nodeName === 'meta' && attribute(node, 'name') === 'description'),
    'content',
  ) ?? '';
  assert.ok(renderedTitle.length > 0, `Built ${label} title is empty`);
  assert.ok(renderedDescription.length > 0, `Built ${label} description is empty`);
  if (options.exactTitle) {
    assert.equal(
      renderedTitle,
      title,
      `Built ${label} title must be ${JSON.stringify(title)}; actual ${JSON.stringify(renderedTitle)}`,
    );
  } else {
    assert.ok(
      renderedTitle.includes(title),
      `Built ${label} title must include ${JSON.stringify(title)}; actual ${JSON.stringify(renderedTitle)}`,
    );
  }
  assert.equal(
    renderedDescription,
    description,
    `Built ${label} description must be ${JSON.stringify(description)}; actual ${JSON.stringify(renderedDescription)}`,
  );
}

function canonicalHrefs(document) {
  return descendants(document)
    .filter((node) => node.nodeName === 'link' && attribute(node, 'rel') === 'canonical')
    .map((node) => attribute(node, 'href'));
}

function hasRenderedHref(document, href) {
  return descendants(document).some((node) => node.nodeName === 'a' && attribute(node, 'href') === href);
}

function sourceRoute(source) {
  return {
    Quickstart: '/docs/quickstart/',
    Connect: '/docs/guides/connect-your-agent/',
    'OTP extraction': '/docs/guides/otp-extraction/',
    'MCP hub': '/mcp/',
    homepage: '/',
    'DNS setup': '/docs/guides/dns-setup/',
    'Cloudflare DNS': '/docs/guides/dns-cloudflare/',
    'Namecheap DNS': '/docs/guides/dns-namecheap/',
    'Route 53 DNS': '/docs/guides/dns-route53/',
    'Playwright email OTP': '/docs/guides/playwright-email-otp/',
  }[source];
}

function fencedCode(source) {
  return [...source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n');
}

function assertAppearsBefore(haystack, earlier, later, message) {
  const earlierAt = haystack.search(earlier);
  const laterAt = haystack.search(later);
  assert.ok(earlierAt !== -1, `${message}: missing earlier pattern ${earlier}`);
  assert.ok(laterAt !== -1, `${message}: missing later pattern ${later}`);
  assert.ok(earlierAt < laterAt, message);
}

function assertPlaywrightOaeApiUrlSourceContract(code) {
  assert.match(
    code,
    /const apiUrl = new URL\(api\);/,
    'Playwright example must parse OAE_API with const apiUrl = new URL(api)',
  );
  assertAppearsBefore(
    code,
    /const apiUrl = new URL\(api\);/,
    /request\.post/,
    'Playwright example must validate OAE_API before request.post',
  );
  assert.match(code, /apiUrl\.protocol/, 'Playwright example must inspect apiUrl.protocol');
  assert.match(code, /apiUrl\.hostname/, 'Playwright example must inspect apiUrl.hostname');
  assert.match(code, /'https:'/, 'Playwright example must permit https:');
  const allowlistMatch = code.match(
    /const allowHttpLoopback = new Set\(\[((?:[^[\]]|\[[^\]]*\])*)\]\)/,
  );
  assert.ok(allowlistMatch, 'Playwright example must define allowHttpLoopback as a Set literal');
  const allowlistHosts = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(
    allowlistHosts,
    ['localhost', '127.0.0.1', '[::1]'],
    'Playwright example must use an exact three-member allowHttpLoopback Set with no extra member',
  );
  assert.match(
    code,
    /allowHttpLoopback\.has\(apiUrl\.hostname\)/,
    'Playwright example must gate http: with allowHttpLoopback.has(apiUrl.hostname)',
  );
  assert.match(
    code,
    /apiUrl\.protocol !== 'https:'\s*&&\s*!\(apiUrl\.protocol === 'http:' && allowHttpLoopback\.has\(apiUrl\.hostname\)\)/,
    'Playwright example must use the exact fail-closed Boolean: all HTTPS; HTTP only when allowHttpLoopback.has(apiUrl.hostname)',
  );
  assert.doesNotMatch(
    code,
    /apiUrl\.hostname\.(?:endsWith|startsWith|includes|indexOf)\(|hostname\.(?:endsWith|startsWith|includes|indexOf)\(/,
    'Playwright example must not use prefix/suffix/substring host approximation',
  );
  assert.match(
    code,
    /throw new Error\('OAE_API must be https: or http: on localhost, 127\.0\.0\.1, or \[::1\]'\)/,
    'Playwright example must throw a fail-closed OAE_API error',
  );
  assert.match(
    code,
    /request\.post\(`\$\{apiUrl\.origin\}\/v1\/messages\/wait`/,
    'Playwright example must send request.post through the validated apiUrl.origin',
  );
  assert.doesNotMatch(
    code,
    /request\.post\(`\$\{api\}\/v1\/messages\/wait`/,
    'Playwright example must not post to the unvalidated api string',
  );
}

function extractAllowHttpLoopbackFromGuide(code) {
  assertPlaywrightOaeApiUrlSourceContract(code);
  const allowlistMatch = code.match(
    /const allowHttpLoopback = new Set\(\[((?:[^[\]]|\[[^\]]*\])*)\]\)/,
  );
  assert.ok(allowlistMatch, 'Playwright example is missing allowHttpLoopback Set for URL execution');
  const hosts = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  return new Set(hosts);
}

function acceptOaeApiUrlFromSourceContract(code, apiValue) {
  const allowHttpLoopback = extractAllowHttpLoopbackFromGuide(code);
  const apiUrl = new URL(apiValue);
  if (
    apiUrl.protocol !== 'https:'
    && !(apiUrl.protocol === 'http:' && allowHttpLoopback.has(apiUrl.hostname))
  ) {
    throw new Error('OAE_API must be https: or http: on localhost, 127.0.0.1, or [::1]');
  }
  return apiUrl;
}

function extractParseSingleMailboxFromGuide(code) {
  assertPlaywrightSenderSourceContract(code);
  const match = code.match(
    /function parseSingleMailbox\(fromValue: string\): string \{([\s\S]*?)\n  \}/,
  );
  assert.ok(match, 'Playwright example is missing a self-contained parseSingleMailbox function to extract');
  const body = match[1]
    .replace(/: string\b/g, '')
    .replace(/ as string\b/g, '');
  // Instantiate the guide's own parser (TypeScript annotations stripped) — no duplicate implementation.
  return new Function(`return function parseSingleMailbox(fromValue) {${body}\n}`)();
}

function assertExactNormalizedSender(code, fromValue, expectedSender) {
  const parseSingleMailbox = extractParseSingleMailboxFromGuide(code);
  const actual = parseSingleMailbox(String(fromValue));
  const expected = parseSingleMailbox(String(expectedSender));
  if (actual !== expected) {
    throw new Error('message.from does not exactly match OAE_EXPECTED_SENDER');
  }
  return actual;
}

function assertPlaywrightSenderSourceContract(code) {
  assert.doesNotMatch(
    code,
    /toContain\(expectedSender/,
    'Playwright example must not use toContain(expectedSender)',
  );
  assert.match(
    code,
    /fromContains:\s*expectedSender/,
    'Playwright example must keep fromContains: expectedSender as a coarse server-side filter',
  );
  assert.match(
    code,
    /function parseSingleMailbox\(fromValue: string\): string/,
    'Playwright example must define parseSingleMailbox for exact one-mailbox parsing',
  );
  assert.match(
    code,
    /expect\(parseSingleMailbox\(String\(message\.from\)\)\)\.toBe\(parseSingleMailbox\(expectedSender\)\)/,
    'Playwright example must compare parsed message.from to parseSingleMailbox(expectedSender) with exact equality',
  );
  assertAppearsBefore(
    code,
    /expect\(parseSingleMailbox\(String\(message\.from\)\)\)\.toBe\(parseSingleMailbox\(expectedSender\)\)/,
    /message\.otp\.codes\[0\]/,
    'Playwright example must exact-match the normalized sender before reading message.otp.codes[0]',
  );
  assert.match(
    code,
    /\.toLowerCase\(\)/,
    'Playwright example must normalize sender case',
  );
  assert.match(
    code,
    /throw new Error\('message\.from must be exactly one mailbox address'\)/,
    'Playwright example must reject malformed or multiple-address sender input',
  );
}

function assertPlaywrightSubjectSourceContract(code) {
  assert.match(
    code,
    /const expectedSubject = \(process\.env\.OAE_EXPECTED_SUBJECT \?\? ''\)\.trim\(\);/,
    'Playwright example must assign OAE_EXPECTED_SUBJECT with trim at assignment',
  );
  assertAppearsBefore(
    code,
    /const expectedSubject = \(process\.env\.OAE_EXPECTED_SUBJECT \?\? ''\)\.trim\(\);/,
    /request\.post/,
    'Playwright example must read/trim OAE_EXPECTED_SUBJECT before request.post',
  );
  assert.match(
    code,
    /!mailbox \|\| !expectedSender \|\| !expectedSubject \|\| !signupUrl/,
    'Playwright example must require non-empty OAE_EXPECTED_SUBJECT in the fail-closed environment check',
  );
  assertAppearsBefore(
    code,
    /!mailbox \|\| !expectedSender \|\| !expectedSubject \|\| !signupUrl/,
    /request\.post/,
    'Playwright example must require expectedSubject before request.post',
  );
  assert.match(
    code,
    /subjectContains:\s*expectedSubject/,
    'Playwright example must bind subjectContains to expectedSubject',
  );
  assert.doesNotMatch(
    code,
    /subjectContains:\s*'verify'/,
    "Playwright example must not hard-code subjectContains: 'verify'",
  );
}

function evaluateDocumentedSubjectGate(code, subjectValue) {
  assertPlaywrightSubjectSourceContract(code);
  const expectedSubject = String(subjectValue ?? '').trim();
  const mailbox = 'agent@example.com';
  const expectedSender = 'trusted@example.com';
  const signupUrl = 'https://signup.example.com';
  return Boolean(mailbox && expectedSender && expectedSubject && signupUrl);
}

function assertPlaywrightWaitPreparationOrder(code) {
  assertAppearsBefore(
    code,
    /page\.goto\(signupUrl(?:,\s*\{[^}]*\})?\)/,
    /getByLabel\('Email'\)\.fill\(mailbox(?:,\s*\{[^}]*\})?\)/,
    'Playwright example must prepare with page.goto(signupUrl) before email fill',
  );
  assertAppearsBefore(
    code,
    /getByLabel\('Email'\)\.fill\(mailbox(?:,\s*\{[^}]*\})?\)/,
    /request\.post/,
    'Playwright example must fill email before request.post',
  );
  assertAppearsBefore(
    code,
    /request\.post/,
    /getByRole\('button', \{ name: 'Sign up' \}\)\.click\((?:\{[^}]*\})?\)/,
    'Playwright example must start request.post immediately before the Sign up click',
  );
}

function assertPlaywrightTimeoutBudget(code) {
  const enclosing = code.match(/test\.setTimeout\((\d[\d_]*)\)/);
  assert.ok(enclosing, 'Playwright example is missing test.setTimeout(<ms>)');
  const enclosingMs = Number(enclosing[1].replaceAll('_', ''));
  assert.equal(enclosingMs, 180_000, 'Playwright enclosing test timeout must be 180_000');
  assert.doesNotMatch(
    code,
    /test\.setTimeout\(90_000\)/,
    'Playwright example must not keep test.setTimeout(90_000)',
  );

  const signupNav = code.match(/page\.goto\(signupUrl,\s*\{\s*timeout:\s*(\d[\d_]*)\s*\}\)/);
  const emailFill = code.match(/getByLabel\('Email'\)\.fill\(mailbox,\s*\{\s*timeout:\s*(\d[\d_]*)\s*\}\)/);
  const signupClick = code.match(
    /getByRole\('button', \{ name: 'Sign up' \}\)\.click\(\{\s*timeout:\s*(\d[\d_]*)\s*\}\)/,
  );
  const codeFill = code.match(
    /getByLabel\('Verification code'\)\.fill\(code,\s*\{\s*timeout:\s*(\d[\d_]*)\s*\}\)/,
  );
  const verifyClick = code.match(
    /getByRole\('button', \{ name: 'Verify' \}\)\.click\(\{\s*timeout:\s*(\d[\d_]*)\s*\}\)/,
  );
  const requestTimeout = code.match(
    /request\.post\([\s\S]*?timeoutSec:\s*60,[\s\S]*?timeout:\s*(\d[\d_]*)/,
  );
  const serverWait = code.match(/timeoutSec:\s*(\d+)/);
  assert.ok(signupNav, 'Playwright example must bound signup navigation with timeout: 30_000');
  assert.ok(emailFill, 'Playwright example must bound email fill with timeout: 10_000');
  assert.ok(signupClick, 'Playwright example must bound Sign up click with timeout: 10_000');
  assert.ok(codeFill, 'Playwright example must bound verification-code fill with timeout: 10_000');
  assert.ok(verifyClick, 'Playwright example must bound Verify click with timeout: 10_000');
  assert.ok(requestTimeout, 'Playwright example is missing request timeout: <ms>');
  assert.ok(serverWait, 'Playwright example is missing timeoutSec: <seconds>');

  const phaseMs = {
    signupNav: Number(signupNav[1].replaceAll('_', '')),
    emailFill: Number(emailFill[1].replaceAll('_', '')),
    signupClick: Number(signupClick[1].replaceAll('_', '')),
    codeFill: Number(codeFill[1].replaceAll('_', '')),
    verifyClick: Number(verifyClick[1].replaceAll('_', '')),
    request: Number(requestTimeout[1].replaceAll('_', '')),
  };
  assert.equal(phaseMs.signupNav, 30_000, 'signup navigation timeout must be 30_000');
  assert.equal(phaseMs.emailFill, 10_000, 'email fill timeout must be 10_000');
  assert.equal(phaseMs.signupClick, 10_000, 'Sign up click timeout must be 10_000');
  assert.equal(phaseMs.codeFill, 10_000, 'verification-code fill timeout must be 10_000');
  assert.equal(phaseMs.verifyClick, 10_000, 'Verify click timeout must be 10_000');
  assert.equal(phaseMs.request, 70_000, 'Playwright request timeout must be 70_000');
  assert.equal(Number(serverWait[1]), 60, 'Playwright timeoutSec must be 60');
  const serverWaitMs = Number(serverWait[1]) * 1000;
  assert.ok(
    phaseMs.request > serverWaitMs,
    `Playwright request/server ladder must keep 70_000 > 60_000; actual ${phaseMs.request} > ${serverWaitMs}`,
  );

  const cumulativeMs = Object.values(phaseMs).reduce((sum, value) => sum + value, 0);
  assert.equal(cumulativeMs, 140_000, 'explicit bounded phases must sum to 140_000 ms');
  assert.ok(
    enclosingMs > cumulativeMs,
    `Playwright enclosing timeout must exceed the cumulative bounded phases; actual ${enclosingMs} > ${cumulativeMs}`,
  );
  assert.equal(
    enclosingMs - cumulativeMs,
    40_000,
    'Playwright enclosing timeout must leave 40_000 ms of overhead beyond the 140_000 ms cumulative maximum',
  );
}

function assertPlaywrightOtpLinkSourceContract(code) {
  assert.match(
    code,
    /import \{ isIP \} from 'node:net'/,
    'Playwright example must import isIP from node:net for OTP link IP rejection',
  );
  assert.match(
    code,
    /function assertTrustedOtpUrl\(rawUrl: string, expectedHost: string\): URL/,
    'Playwright example must define one reusable assertTrustedOtpUrl validator',
  );
  assert.match(
    code,
    /const hostForIpCheck = link\.hostname\.replace\(\/\^\\\[\|\\\]\$\/g, ''\)/,
    'Playwright example must normalize bracketed IPv6 host text before isIP',
  );
  assert.match(
    code,
    /isIP\(hostForIpCheck\) !== 0/,
    'Playwright example must reject IP-literal hosts with isIP(hostForIpCheck) !== 0',
  );
  assert.doesNotMatch(
    code,
    /isIP\(hostForIpCheck\) === 4 && false/,
    'Playwright example must not weaken the IP-literal guard',
  );
  assertAppearsBefore(
    code,
    /isIP\(hostForIpCheck\) !== 0/,
    /page\.goto\(link\.toString\(\)\)/,
    'Playwright example must apply the IP-literal guard before page.goto(link.toString())',
  );
  assertAppearsBefore(
    code,
    /link\.protocol !== 'https:'/,
    /page\.goto\(link\.toString\(\)\)/,
    'Playwright example must apply the HTTPS guard before page.goto(link.toString())',
  );
  assertAppearsBefore(
    code,
    /link\.hostname !== expectedHost/,
    /page\.goto\(link\.toString\(\)\)/,
    'Playwright example must apply the exact-host guard before page.goto(link.toString())',
  );
  assert.match(
    code,
    /throw new Error\('refusing to visit OTP link: HTTPS and exact expected host are required'\)/,
    'Playwright example must throw the fail-closed OTP link error',
  );
  assert.match(
    code,
    /assertTrustedOtpUrl\(message\.otp\.links\[0\] as string, expectedHost\)/,
    'Playwright example must validate the initial OTP URL through assertTrustedOtpUrl',
  );
  assert.match(
    code,
    /assertTrustedOtpUrl\(\s*(?:(?:req|request)\.url\(\)|currentUrl|nextUrl)\s*,\s*expectedHost\)/,
    'Playwright example must reuse assertTrustedOtpUrl for redirect-chain navigation requests',
  );
  assert.match(
    code,
    /link\.protocol !== 'https:'(?!\s*&&\s*link\.protocol !== 'http:')/,
    'Playwright example must require https: and must not allow http: in assertTrustedOtpUrl',
  );
}

function extractAssertTrustedOtpUrlFromGuide(code) {
  assertPlaywrightOtpLinkSourceContract(code);
  const match = code.match(
    /function assertTrustedOtpUrl\(rawUrl: string, expectedHost: string\): URL \{([\s\S]*?)\n  \}/,
  );
  assert.ok(match, 'Playwright example is missing a self-contained assertTrustedOtpUrl function to extract');
  const body = match[1]
    .replace(/: string\b/g, '')
    .replace(/: URL\b/g, '')
    .replace(/ as string\b/g, '');
  return new Function('isIP', `return function assertTrustedOtpUrl(rawUrl, expectedHost) {${body}\n}`)(isIP);
}

function acceptOtpLinkFromSourceContract(code, rawUrl, expectedHost) {
  const assertTrustedOtpUrl = extractAssertTrustedOtpUrlFromGuide(code);
  return assertTrustedOtpUrl(rawUrl, expectedHost);
}

function assertPlaywrightOtpRedirectGuardSourceContract(code) {
  assertPlaywrightOtpLinkSourceContract(code);
  assert.match(
    code,
    /test\.use\(\{\s*serviceWorkers:\s*'block'\s*\}\)/,
    "Playwright example must set test.use({ serviceWorkers: 'block' })",
  );
  assert.match(
    code,
    /async function abortUntrustedOtpNavigation\(route: Route\)/,
    'Playwright example must install a named abortUntrustedOtpNavigation route handler annotated with Route',
  );
  assert.match(
    code,
    /page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\)/,
    'Playwright example must use page.context().route (browserContext.route), not page.route',
  );
  assert.doesNotMatch(
    code,
    /(?<!context\(\)\.)page\.route\(/,
    'Playwright example must not substitute page.route for browserContext.route',
  );
  assert.match(
    code,
    /(?:req|request)\.isNavigationRequest\(\)/,
    'Playwright example must inspect isNavigationRequest for redirect-chain guarding',
  );
  assert.match(
    code,
    /(?:req|request)\.frame\(\) === page\.mainFrame\(\)/,
    'Playwright example must limit redirect-chain guarding to the main frame',
  );
  assert.match(
    code,
    /const OTP_REDIRECT_MAX = 5/,
    'Playwright example must define OTP_REDIRECT_MAX = 5 as the redirect hop cap',
  );
  assert.match(
    code,
    /redirectsFollowed >= OTP_REDIRECT_MAX/,
    'Playwright example must enforce the hop cap before fetching another redirect target',
  );
  assert.match(
    code,
    /route\.fetch\(\{\s*url:\s*currentUrl,\s*maxRedirects:\s*0\s*\}\)/,
    'Playwright example must call route.fetch({ url: currentUrl, maxRedirects: 0 }) for every hop',
  );
  assert.match(
    code,
    /maxRedirects:\s*0/,
    'Playwright example must include the literal maxRedirects: 0',
  );
  assert.match(
    code,
    /route\.fulfill\(\{\s*response:\s*\w+\s*\}\)/,
    'Playwright example must fulfill the terminal response into the intercepted navigation',
  );
  assert.match(
    code,
    /route\.abort\(\)/,
    'Playwright example must abort disallowed top-level OTP navigations',
  );
  assert.match(
    code,
    /route\.continue\(\)/,
    'Playwright example must continue non-navigation traffic',
  );
  assert.doesNotMatch(
    code,
    /link\.protocol !== 'https:' && link\.protocol !== 'http:'/,
    'Playwright example must not allow http: in the shared OTP URL validator',
  );
  const handlerMatch = code.match(
    /async function abortUntrustedOtpNavigation\(route: Route\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(handlerMatch, 'Playwright example is missing abortUntrustedOtpNavigation body');
  const handlerBody = handlerMatch[1];
  assert.match(
    handlerBody,
    /assertTrustedOtpUrl\(/,
    'Playwright example must reuse assertTrustedOtpUrl inside the manual redirect loop',
  );
  assert.match(
    handlerBody,
    /route\.abort\(\)/,
    'Playwright example must abort when validation/fetch/overflow fails',
  );
  // Non-nav traffic may route.continue(); failing top-level OTP checks must abort.
  const validationCatches = [...handlerBody.matchAll(/assertTrustedOtpUrl\([\s\S]*?catch\s*\{([\s\S]*?)\}/g)];
  assert.ok(
    validationCatches.length >= 1,
    'Playwright example must catch assertTrustedOtpUrl failures in the route handler',
  );
  for (const catchBlock of validationCatches) {
    assert.match(
      catchBlock[1],
      /route\.abort\(\)/,
      'Playwright example must abort when assertTrustedOtpUrl rejects a top-level navigation',
    );
    assert.doesNotMatch(
      catchBlock[1],
      /route\.continue\(\)/,
      'Playwright example must not continue a disallowed top-level navigation',
    );
  }
  assert.doesNotMatch(
    handlerBody,
    /await route\.continue\(\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*catch/,
    'Playwright example must not continue on a top-level OTP validation failure path',
  );
  assertAppearsBefore(
    code,
    /page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\)/,
    /page\.goto\(link\.toString\(\)\)/,
    'Playwright example must install the context route before page.goto(link.toString())',
  );
  assert.match(
    code,
    /try \{\s*await page\.goto\(link\.toString\(\)\);\s*\} finally \{\s*await page\.context\(\)\.unroute\('\*\*\/\*', abortUntrustedOtpNavigation\);\s*\}/s,
    'Playwright example must unroute the named handler in finally after page.goto',
  );
}

function assertPlaywrightOtpManualRedirectProse(markup) {
  assert.match(
    markup,
    /maxRedirects:\s*0/,
    'Playwright guide must document maxRedirects: 0 for manual redirect following',
  );
  assert.match(
    markup,
    /initial URL/i,
    'Playwright guide must explain that fulfillment keeps the page at the initial URL',
  );
  assert.match(
    markup,
    /<base>|base URL|relative/i,
    'Playwright guide must explain relative URL resolution against the displayed/original URL unless a base URL exists',
  );
  assert.match(
    markup,
    /stub(?:bed)?|not a real-browser redirect/i,
    'Playwright guide must state that CI exercises a stubbed route.fetch chain, not a real-browser redirect server',
  );
}

function verificationLinkTypescriptFence(markup) {
  const fences = [...markup.matchAll(/```typescript\n([\s\S]*?)```/g)].map((match) => match[1]);
  const linkFence = fences.find((fence) => (
    fence.includes('abortUntrustedOtpNavigation')
    && fence.includes('assertTrustedOtpUrl')
    && fence.includes('page.goto(link.toString())')
  ));
  assert.ok(linkFence, 'Playwright guide is missing a verification-link TypeScript fence with the redirect handler');
  return linkFence;
}

function assertPlaywrightVerificationLinkSelfContained(markup) {
  const fence = verificationLinkTypescriptFence(markup);
  assert.match(
    fence,
    /test\(/,
    'verification-link example must be a complete test(...) callback/example',
  );
  assert.match(
    fence,
    /async \(\{\s*page\s*,\s*request\s*\}\)/,
    'verification-link example must declare page and request in its own callback parameters',
  );
  assert.match(
    fence,
    /const message = await response\.json\(\)/,
    'verification-link example must assign message inside the callback',
  );
  assert.match(
    fence,
    /import \{\s*expect,\s*test,\s*type Route\s*\} from '@playwright\/test'/,
    'verification-link example must import expect, test, and type Route for a copyable strict TypeScript test',
  );
  const messageDeclAt = fence.search(/const message = await response\.json\(\)/);
  const otpUseAt = fence.search(/message\.otp\./);
  assert.ok(
    messageDeclAt !== -1 && otpUseAt !== -1 && otpUseAt > messageDeclAt,
    'verification-link example must not use out-of-scope message.otp before declaring message in-callback',
  );
  assert.match(
    fence,
    /async \(\{\s*page\s*,\s*request\s*\}\) =>/,
    'verification-link example must bind page in its own callback scope',
  );
}

function playwrightOtpWaitClickFences(markup) {
  const fences = [...markup.matchAll(/```typescript\n([\s\S]*?)```/g)].map((match) => match[1]);
  const waitClickFences = fences.filter((fence) => (
    /const wait = request\.post\(/.test(fence)
    && /getByRole\('button', \{ name: 'Sign up' \}\)\.click\(/.test(fence)
    && /const response = await wait;/.test(fence)
  ));
  assert.equal(
    waitClickFences.length,
    2,
    `Playwright guide must contain exactly two TypeScript fences with wait/click blocks; actual ${waitClickFences.length}`,
  );
  return waitClickFences;
}

function extractWaitClickBlockFromFence(fence) {
  const blockMatch = fence.match(
    /const wait = request\.post\([\s\S]*?\n  \}\);[\s\S]*?const response = await wait;/,
  );
  assert.ok(
    blockMatch,
    'Playwright example is missing an extractable const wait = request.post(...) … const response = await wait; block',
  );
  return blockMatch[0];
}

function assertPlaywrightImmediateWaitObserver(markup) {
  const fences = playwrightOtpWaitClickFences(markup);
  for (const [index, fence] of fences.entries()) {
    const block = extractWaitClickBlockFromFence(fence);
    const waitDecl = block.match(/const wait = request\.post\([\s\S]*?\n  \}\);/);
    assert.ok(waitDecl, `fence ${index + 1}: missing const wait = request.post(...) declaration`);
    const afterWait = block.slice(waitDecl[0].length);
    assert.match(
      afterWait,
      /^\s*void wait\.catch\(\(\)\s*=>\s*\{\}\);/,
      `fence ${index + 1}: wait rejection must be observed with void wait.catch(() => {}) immediately after creation, in the same synchronous turn`,
    );
    const observerAt = afterWait.search(/void wait\.catch\(\(\)\s*=>\s*\{\}\);/);
    const clickAt = afterWait.search(/getByRole\('button', \{ name: 'Sign up' \}\)\.click\(/);
    assert.ok(
      observerAt !== -1 && clickAt !== -1 && observerAt < clickAt,
      `fence ${index + 1}: immediate wait observer must appear before the Sign up click`,
    );
    assert.doesNotMatch(
      block,
      /wait\s*=\s*wait\.catch/,
      `fence ${index + 1}: observer must not replace or transform the original wait promise`,
    );
    assert.match(
      block,
      /const response = await wait;/,
      `fence ${index + 1}: successful click path must still await the original wait promise`,
    );
    assert.doesNotMatch(
      afterWait,
      /catch\s*\(\s*clickError\s*\)\s*\{[\s\S]*?await wait\.catch/,
      `fence ${index + 1}: must not rely only on a late wait.catch inside the click-error path`,
    );
  }
}

function runWaitClickBlockFromGuide(block, { request, page, apiUrl, token, mailbox, expectedSender, expectedSubject }) {
  // Execute the guide's own wait/click text — not a parallel hand-written model.
  return new Function(
    'request',
    'page',
    'apiUrl',
    'token',
    'mailbox',
    'expectedSender',
    'expectedSubject',
    `return (async () => {\n${block}\nreturn response;\n})();`,
  )(request, page, apiUrl, token, mailbox, expectedSender, expectedSubject);
}

async function assertPlaywrightWaitClickSemanticsFromGuide(markup) {
  const fences = playwrightOtpWaitClickFences(markup);
  const apiUrl = new URL('http://localhost:3100');
  const token = 'oa_test-token';
  const mailbox = 'agent@example.com';
  const expectedSender = 'noreply@example.com';
  const expectedSubject = 'Verify your account';

  for (const [index, fence] of fences.entries()) {
    const block = extractWaitClickBlockFromFence(fence);
    const label = `fence ${index + 1}`;

    {
      const unhandled = [];
      const onUnhandled = (reason) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);
      const restError = new Error(`${label} REST failed while click pending`);
      try {
        const request = {
          post() {
            return new Promise((_, reject) => {
              setTimeout(() => reject(restError), 20);
            });
          },
        };
        const page = {
          getByRole() {
            return {
              async click() {
                await new Promise((resolve) => setTimeout(resolve, 80));
              },
            };
          },
        };
        await assert.rejects(
          () => runWaitClickBlockFromGuide(block, {
            request,
            page,
            apiUrl,
            token,
            mailbox,
            expectedSender,
            expectedSubject,
          }),
          (error) => error === restError,
          `${label}: after a successful click, awaiting the original wait must propagate the REST rejection`,
        );
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
      assert.equal(
        unhandled.length,
        0,
        `${label}: request rejection while click is pending must not produce unhandledRejection (immediate observer required); got ${unhandled.map((reason) => String(reason && reason.message ? reason.message : reason)).join(' | ')}`,
      );
    }

    {
      const restError = new Error(`${label} REST failed after click success`);
      const request = {
        post() {
          return Promise.reject(restError);
        },
      };
      const page = {
        getByRole() {
          return {
            async click() {},
          };
        },
      };
      await assert.rejects(
        () => runWaitClickBlockFromGuide(block, {
          request,
          page,
          apiUrl,
          token,
          mailbox,
          expectedSender,
          expectedSubject,
        }),
        (error) => error === restError,
        `${label}: successful click must still await the original wait so REST errors propagate`,
      );
    }

    {
      const clickError = new Error(`${label} Sign up click failed`);
      const request = {
        post() {
          // Pending/slow REST wait: awaiting it on the click-failure path would hang.
          return new Promise(() => {});
        },
      };
      const page = {
        getByRole() {
          return {
            async click() {
              throw clickError;
            },
          };
        },
      };
      const startedAt = Date.now();
      await assert.rejects(
        () => runWaitClickBlockFromGuide(block, {
          request,
          page,
          apiUrl,
          token,
          mailbox,
          expectedSender,
          expectedSubject,
        }),
        (error) => error === clickError,
        `${label}: click failure must surface as the primary error`,
      );
      const elapsedMs = Date.now() - startedAt;
      assert.ok(
        elapsedMs < 1_000,
        `${label}: click-failure path must return promptly without awaiting the pending/slow REST wait; elapsed ${elapsedMs}ms`,
      );
    }
  }
}

function assertPlaywrightOtpRouteTypeAnnotation(code) {
  assert.match(
    code,
    /import \{\s*expect,\s*test,\s*type Route\s*\} from '@playwright\/test'/,
    'Playwright example must import type Route from @playwright/test',
  );
  assert.match(
    code,
    /async function abortUntrustedOtpNavigation\(route: Route\)/,
    'Playwright example must annotate the named route handler parameter as route: Route',
  );
}

function createStubApiResponse({ status, headers = {}, url }) {
  let disposed = false;
  return {
    status: () => status,
    headers: () => headers,
    url: () => url,
    async dispose() {
      disposed = true;
    },
    get disposed() {
      return disposed;
    },
  };
}

function extractOtpRedirectHandlerFromGuide(code, { page, expectedHost }) {
  assertPlaywrightOtpRedirectGuardSourceContract(code);
  const assertTrustedOtpUrl = extractAssertTrustedOtpUrlFromGuide(code);
  const maxMatch = code.match(/const OTP_REDIRECT_MAX = (\d+)/);
  assert.ok(maxMatch, 'Playwright example is missing OTP_REDIRECT_MAX for handler extraction');
  const OTP_REDIRECT_MAX = Number(maxMatch[1]);
  assert.ok(OTP_REDIRECT_MAX <= 5, 'OTP_REDIRECT_MAX must be no greater than 5');
  const handlerMatch = code.match(
    /async function abortUntrustedOtpNavigation\(route: Route\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(handlerMatch, 'Playwright example is missing abortUntrustedOtpNavigation body to extract');
  const body = handlerMatch[1]
    .replace(/: string\b/g, '')
    .replace(/: Route\b/g, '')
    .replace(/ as string\b/g, '')
    .replace(/ as const\b/g, '');
  return new Function(
    'page',
    'expectedHost',
    'assertTrustedOtpUrl',
    'OTP_REDIRECT_MAX',
    `return async function abortUntrustedOtpNavigation(route) {${body}\n}`,
  )(page, expectedHost, assertTrustedOtpUrl, OTP_REDIRECT_MAX);
}

function extractOtpRouteInstallGotoUnrouteFromGuide(code) {
  assertPlaywrightOtpRedirectGuardSourceContract(code);
  const blockMatch = code.match(
    /await page\.context\(\)\.route\('\*\*\/\*', abortUntrustedOtpNavigation\);\n\s*try \{\n\s*await page\.goto\(link\.toString\(\)\);\n\s*\} finally \{\n\s*await page\.context\(\)\.unroute\('\*\*\/\*', abortUntrustedOtpNavigation\);\n\s*\}/,
  );
  assert.ok(
    blockMatch,
    'Playwright example is missing the route-install/try-page.goto/finally-unroute block to extract',
  );
  // Execute the guide's own install/try/finally text — not a parallel cleanup model.
  return new Function(
    'page',
    'link',
    'abortUntrustedOtpNavigation',
    `return (async () => {\n${blockMatch[0]}\n})();`,
  );
}

async function runOtpRedirectManualLoopFromGuide(code, {
  initialUrl,
  expectedHost,
  chain,
  isNavigation = true,
  isMainFrame = true,
}) {
  const fetchedUrls = [];
  const mainFrame = { id: 'main' };
  const otherFrame = { id: 'child' };
  const page = {
    mainFrame() {
      return mainFrame;
    },
  };
  let outcome = 'pending';
  let fulfilledStatus = null;
  let continued = false;
  let aborted = false;
  const route = {
    request() {
      return {
        url: () => initialUrl,
        isNavigationRequest: () => isNavigation,
        frame: () => (isMainFrame ? mainFrame : otherFrame),
      };
    },
    async fetch(options) {
      assert.equal(
        options?.maxRedirects,
        0,
        'extracted guide handler must pass maxRedirects: 0 to every route.fetch',
      );
      const url = options.url;
      fetchedUrls.push(url);
      const entry = chain[url];
      if (!entry) {
        throw new Error(`stub chain missing response for ${url}`);
      }
      if (entry.throws) {
        throw new Error(entry.message || 'stub route.fetch failure');
      }
      return createStubApiResponse({ ...entry, url });
    },
    async fulfill({ response }) {
      outcome = 'fulfill';
      fulfilledStatus = response.status();
    },
    async abort() {
      aborted = true;
      outcome = 'abort';
    },
    async continue() {
      continued = true;
      outcome = 'continue';
    },
  };
  const handler = extractOtpRedirectHandlerFromGuide(code, { page, expectedHost });
  await handler(route);
  return {
    outcome,
    fetchedUrls,
    fulfilledStatus,
    continued,
    aborted,
  };
}

function assertExactResolverIpv4Allowlist(markup, label) {
  const ipv4Literal = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const matches = [...markup.matchAll(ipv4Literal)].map((match) => match[0]);
  assert.ok(
    matches.length > 0,
    `${label} must include at least one IPv4 literal (expected exact 1.1.1.1)`,
  );
  for (const ip of matches) {
    assert.equal(
      ip,
      '1.1.1.1',
      `${label} must allow only exact 1.1.1.1 IPv4 literals; found ${ip}`,
    );
  }
}

function assertCloudflareCurlBearerOffArgv(markup) {
  assert.match(markup, /\$CF_TOKEN/, 'Cloudflare API example must keep the CF_TOKEN environment variable');
  assert.match(markup, /\$CF_ZONE/, 'Cloudflare API example must keep the CF_ZONE environment variable');
  assert.match(
    markup,
    /https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/\$CF_ZONE\/dns_records/,
    'Cloudflare API example must POST to the Cloudflare DNS records endpoint',
  );
  assert.match(markup, /-X POST/, 'Cloudflare API example must preserve POST semantics');
  assert.match(
    markup,
    /--data '\{"type":"A","name":"mail\.example\.com","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
    'Cloudflare API example must preserve the JSON payload with FQDN name and "proxied":false',
  );
  assert.doesNotMatch(
    markup,
    /-H ["']Authorization: Bearer \$CF_TOKEN["']/,
    'Cloudflare API example must not place Authorization: Bearer $CF_TOKEN on curl argv',
  );
  assert.doesNotMatch(
    markup,
    /--oauth2-bearer\s+["']?\$CF_TOKEN/,
    'Cloudflare API example must not place the bearer token on curl argv via --oauth2-bearer',
  );
  assert.match(
    markup,
    /printf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN"\s*\|\s*\\?\s*\n?\s*curl/,
    'Cloudflare API example must feed the Authorization header to curl through a printf|curl stdin/config channel',
  );
  assert.match(
    markup,
    /(?:-K|--config)\s+-/,
    'Cloudflare API example must read curl config/header material from stdin with -K - or --config -',
  );
}

function assertCloudflareDnsApiARecordFqdn(markup) {
  assert.match(
    markup,
    /--data '\{"type":"A","name":"mail\.example\.com","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
    'Cloudflare raw DNS API A-record body must use complete record FQDN "name":"mail.example.com"',
  );
  assert.doesNotMatch(
    markup,
    /--data '\{"type":"A","name":"mail","content":/,
    'Cloudflare raw DNS API A-record body must not use relative "name":"mail"',
  );
}

function assertDnsSetupCloudflareHelperRecordFqdns(markup) {
  const helperFence = [...markup.matchAll(/```bash\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .find((fence) => /cf_add\(\)/.test(fence) && /cf_add '\{"type":"A"/.test(fence));
  assert.ok(
    helperFence,
    'DNS setup must include the linked full Cloudflare cf_add helper bash fence',
  );

  assert.match(
    helperFence,
    /cf_add '\{"type":"A","name":"mail\.example\.com","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
    'dns-setup Cloudflare helper A-record must use complete FQDN "name":"mail.example.com"',
  );
  assert.match(
    helperFence,
    /cf_add '\{"type":"MX","name":"example\.com","content":"mail\.example\.com","priority":10,"ttl":300\}'/,
    'dns-setup Cloudflare helper MX-record must use complete FQDN "name":"example.com"',
  );
  assert.match(
    helperFence,
    /cf_add '\{"type":"TXT","name":"example\.com","content":"v=spf1 mx ~all","ttl":300\}'/,
    'dns-setup Cloudflare helper root SPF TXT must use complete FQDN "name":"example.com"',
  );
  assert.match(
    helperFence,
    /cf_add '\{"type":"TXT","name":"mail\._domainkey\.example\.com","content":"<v=DKIM1; k=rsa; p=\.\.\.>","ttl":300\}'/,
    'dns-setup Cloudflare helper DKIM TXT must use complete FQDN "name":"mail._domainkey.example.com"',
  );
  assert.match(
    helperFence,
    /cf_add '\{"type":"TXT","name":"_dmarc\.example\.com","content":"v=DMARC1; p=quarantine; rua=mailto:postmaster@example\.com","ttl":300\}'/,
    'dns-setup Cloudflare helper DMARC TXT must use complete FQDN "name":"_dmarc.example.com"',
  );

  assert.doesNotMatch(
    helperFence,
    /cf_add '\{"type":"A","name":"mail","/,
    'dns-setup Cloudflare helper A-record must not use relative "name":"mail"',
  );
  assert.doesNotMatch(
    helperFence,
    /cf_add '\{"type":"MX","name":"@",/,
    'dns-setup Cloudflare helper MX-record must not use relative "name":"@"',
  );
  assert.doesNotMatch(
    helperFence,
    /cf_add '\{"type":"TXT","name":"@","content":"v=spf1 mx ~all"/,
    'dns-setup Cloudflare helper root SPF TXT must not use relative "name":"@"',
  );
  assert.doesNotMatch(
    helperFence,
    /cf_add '\{"type":"TXT","name":"mail\._domainkey","/,
    'dns-setup Cloudflare helper DKIM TXT must not use relative "name":"mail._domainkey"',
  );
  assert.doesNotMatch(
    helperFence,
    /cf_add '\{"type":"TXT","name":"_dmarc","/,
    'dns-setup Cloudflare helper DMARC TXT must not use relative "name":"_dmarc"',
  );
}

function assertPlaywrightBearerWaitMaxRedirects(markup) {
  const fences = playwrightOtpWaitClickFences(markup);
  for (const [index, fence] of fences.entries()) {
    const waitDecl = fence.match(
      /const wait = request\.post\(`\$\{apiUrl\.origin\}\/v1\/messages\/wait`,\s*\{[\s\S]*?\n  \}\);/,
    );
    assert.ok(
      waitDecl,
      `fence ${index + 1}: missing bearer-authenticated request.post(\`\${apiUrl.origin}/v1/messages/wait\`, ...)`,
    );
    assert.match(
      waitDecl[0],
      /Authorization:\s*`Bearer \$\{token\}`/,
      `fence ${index + 1}: wait request.post must remain bearer-authenticated`,
    );
    assert.match(
      waitDecl[0],
      /maxRedirects:\s*0/,
      `fence ${index + 1}: bearer wait request.post options must explicitly set maxRedirects: 0`,
    );
    assert.doesNotMatch(
      waitDecl[0],
      /route\.fetch/,
      `fence ${index + 1}: bearer wait maxRedirects lock must be on request.post options, not route.fetch`,
    );
  }
}

function assertDnsSetupCloudflareHelperBearerOffArgv(markup) {
  assert.match(
    markup,
    /cf_add\(\)/,
    'DNS setup Cloudflare helper must keep the cf_add helper',
  );
  assert.match(
    markup,
    /https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/\$CF_ZONE\/dns_records/,
    'DNS setup Cloudflare helper must POST to the Cloudflare DNS records endpoint',
  );
  assert.match(
    markup,
    /-H "Content-Type: application\/json"/,
    'DNS setup Cloudflare helper must preserve Content-Type: application/json',
  );
  assert.match(
    markup,
    /--data "\$1"/,
    'DNS setup Cloudflare helper must preserve --data "$1" payload behavior',
  );
  assert.doesNotMatch(
    markup,
    /-H ["']Authorization: Bearer \$CF_TOKEN["']/,
    'DNS setup Cloudflare helper must not place Authorization: Bearer $CF_TOKEN on curl argv',
  );
  assert.doesNotMatch(
    markup,
    /--oauth2-bearer\s+["']?\$CF_TOKEN/,
    'DNS setup Cloudflare helper must not place the bearer token on curl argv via --oauth2-bearer',
  );
  assert.match(
    markup,
    /printf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN"\s*\|\s*\\?\s*\n?\s*curl/,
    'DNS setup Cloudflare helper must feed Authorization through printf|curl stdin/config',
  );
  assert.match(
    markup,
    /(?:-K|--config)\s+-/,
    'DNS setup Cloudflare helper must read curl config from stdin with -K - or --config -',
  );
}

function assertCloudflareEmailRoutingPrerequisite(markup) {
  assert.match(
    markup,
    /Email Routing/,
    'Cloudflare guide must name Email Routing as a self-hosted mail prerequisite',
  );
  assert.match(
    markup,
    /https:\/\/developers\.cloudflare\.com\/dns\/troubleshooting\/email-issues\/#is-email-routing-turned-on/,
    'Cloudflare guide must link official Email Routing conflict troubleshooting',
  );
  assert.match(
    markup,
    /https:\/\/developers\.cloudflare\.com\/email-service\/configuration\/domains\/#remove-a-domain-from-email-routing/,
    'Cloudflare guide must link official Email Routing disable/removal/cutover guidance',
  );
  assert.match(
    markup,
    /managed|remove|disabled|disable/i,
    'Cloudflare guide must tell readers to remove/disable managed Email Routing records before continuing',
  );
  assertAppearsBefore(
    markup,
    /Email Routing/,
    /\| Script record \| Type \| Name \| Content \|/,
    'Cloudflare Email Routing prerequisite must appear before the self-hosted record table',
  );
  assert.doesNotMatch(
    markup,
    /Email Routing (?:delivers|forwards) to (?:your |the )?self-hosted/i,
    'Cloudflare guide must not imply Email Routing delivers to the self-hosted SMTP host',
  );
}

async function assertNoCurlBearerOnArgvAcrossContent() {
  const docsDir = new URL('../src/content/docs/', import.meta.url);
  const entries = await readdir(docsDir, { withFileTypes: true, recursive: true });
  let checkedCount = 0;
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      const filePath = new URL(entry.name, new URL(entry.path + '/', 'file://'));
      const text = await readFile(filePath, 'utf8');
      assertNoCurlBearerOnArgv(text, entry.name);
      checkedCount++;
    }
  }
  assert.ok(checkedCount >= 15, `expected to scan at least 15 doc files; scanned ${checkedCount}`);
}

function assertNoCurlBearerOnArgv(markup, label) {
  assert.doesNotMatch(
    markup,
    /-H\s+["']Authorization:\s*Bearer/i,
    `${label} must not place Authorization: Bearer on curl argv`,
  );
}

// #62（闸3 r1-r3 P2 修复）：守卫必须逐 bash 块、按「连接」配对，且匹配前先剥掉
// shell 注释——注释不是命令。连接定义：printf 经 "| \" 续行直接喂一条 curl 命令，
// 该 curl 命令段内（不跨 ;、|、&、#、裸换行——运算符之后是另一条命令）自带
// --config -/-K -。含 curl 的块不满足连接形态则不得引用任何 bearer token 变量
// （含 ${VAR} 形态）；按文件钉数量 1/2/20。假绿反例（各轮闸面实证）：printf 灌
// cat、curl 后接 | cat --config -、&& echo --config -、注释掉关键行——全部必须红。
function stripShellComments(block) {
  // 语料中引号内不含 '#'（响应注释行本就是 shell 注释），保守逐行剥离。
  return block.replace(/(^|\s)#[^\n]*/g, '$1');
}

function assertCurlBearerOffArgvPattern(markup, label, expectedMigratedBlocks) {
  // 命令段以 ;、|、#、裸换行为界；& 不入类（URL query 的 &limit=10 合法），
  // 空格包围的 & / &&（shell 运算符）由后置检查拒。
  const connectedPipe =
    /printf 'header = "Authorization: Bearer %s"\\n'[^|\n]*\|\s*\\?\s*\n?\s*curl(?:[^;|\n#]|\\\n)*?(?:--config|-K)\s+-/g;
  const shellAmpersand = /\s&{1,2}\s/;
  const curlBearerTokenVar = /(?:\$\{|\$)(?:ADMIN_KEY|API_KEYS|IDENTITY_TOKEN|KEY|WORKER_TOKEN)\}?(?![A-Za-z0-9_])/g;
  const blocks = [...markup.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  let migratedBlocks = 0;
  blocks.forEach((block, index) => {
    if (!/\bcurl\b/.test(block)) return;
    const stripped = stripShellComments(block);
    const connected = [...stripped.matchAll(connectedPipe)].some((m) => !shellAmpersand.test(m[0]));
    if (connected) {
      migratedBlocks += 1;
      return;
    }
    const tokenVars = [...stripped.matchAll(curlBearerTokenVar)].map((m) => m[0]);
    assert.deepEqual(
      tokenVars,
      [],
      `${label} bash block ${index + 1} references bearer token variable(s) ${tokenVars.join(', ')} but does not feed the Authorization header through a connected printf-to-curl stdin config pipe`,
    );
  });
  assert.ok(
    migratedBlocks === expectedMigratedBlocks,
    `${label} must keep exactly ${expectedMigratedBlocks} migrated bearer-off-argv curl block(s), found ${migratedBlocks}`,
  );
}

function assertPlaywrightOtpShapeValidationSourceContract(code) {
  assert.match(
    code,
    /if\s*\(!message\?\.otp\?\.codes\?\.\[0\]\)\s*\{\s*throw new Error\(`OTP response missing message\.otp\.codes\[0\] — got: \${JSON\.stringify\(message\)\.slice\(0,\s*200\)}`\);\s*\}/,
    'Playwright example must validate message.otp.codes[0] shape with an actionable diagnostic before consumption',
  );
  assert.match(
    code,
    /if\s*\(!message\?\.otp\?\.links\?\.\[0\]\)\s*\{\s*throw new Error\(`OTP response missing message\.otp\.links\[0\] — got: \${JSON\.stringify\(message\)\.slice\(0,\s*200\)}`\);\s*\}/,
    'Playwright example must validate message.otp.links[0] shape with an actionable diagnostic before consumption',
  );
  assertAppearsBefore(
    code,
    /!message\?\.otp\?\.codes\?\.\[0\]/,
    /const code = message\.otp\.codes\[0\]/,
    'Playwright example must validate message.otp.codes[0] shape before reading code',
  );
  assertAppearsBefore(
    code,
    /!message\?\.otp\?\.links\?\.\[0\]/,
    /const link = assertTrustedOtpUrl/,
    'Playwright example must validate message.otp.links[0] shape before calling assertTrustedOtpUrl',
  );
}

function assertMcpClientsChatGPTAndGrokSourceContract(markup) {
  assert.match(markup, /## ChatGPT/, 'mcp-clients must include ## ChatGPT');
  assert.match(markup, /## Grok/, 'mcp-clients must include ## Grok');
  assertAppearsBefore(
    markup,
    /## Kimi Code/,
    /## ChatGPT/,
    '## ChatGPT must appear after ## Kimi Code',
  );
  assertAppearsBefore(
    markup,
    /## ChatGPT/,
    /## Grok/,
    '## Grok must appear after ## ChatGPT',
  );
  assertAppearsBefore(
    markup,
    /## Grok/,
    /## Generic MCP clients/,
    '## Generic MCP clients must appear after ## Grok',
  );

  // ChatGPT requirements
  assert.match(markup, /Developer mode/, 'ChatGPT section must require Developer mode in Settings');
  assert.match(markup, /https:\/\/inbox\.openagent\.email\/mcp/, 'ChatGPT section must specify https://inbox.openagent.email/mcp');
  assert.match(markup, /OAuth/, 'ChatGPT section must specify OAuth authentication');
  assert.match(markup, /Client ID Metadata Document \(CIMD\)/, 'ChatGPT section must specify CIMD registration method');
  assert.match(markup, /admin session/, 'ChatGPT section must specify admin session is required for identity approval');
  assert.match(markup, /disconnect the previous connector before rebinding/i, 'ChatGPT section must warn to disconnect previous connector before rebinding');

  // Grok requirements
  assert.match(markup, /grok\.com\/connectors/, 'Grok section must direct to grok.com/connectors');
  assert.match(markup, /Custom/, 'Grok section must specify Custom connector');
  assert.match(markup, /https:\/\/inbox\.openagent\.email\/mcp/, 'Grok section must specify https://inbox.openagent.email/mcp for Grok');
  assert.match(markup, /OAuth/, 'Grok section must mention OAuth authorization');
  assert.match(markup, /mention\s+`@<connector-name>`/, 'Grok section must specify @ mention syntax');
}


function artifactForHref(href) {
  const path = href.split('#')[0].replace(/\/$/, '');
  return path === '' ? 'dist/index.html' : `dist${path}/index.html`;
}

async function readArtifact(relativePath) {
  try {
    return await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`missing rendered artifact: ${relativePath}`);
    }
    throw error;
  }
}

async function readSitemap() {
  const dist = new URL('../dist/', import.meta.url);
  const names = await readdir(dist);
  const sitemapFiles = names.filter((name) => name.startsWith('sitemap') && name.endsWith('.xml'));
  assert.ok(sitemapFiles.length > 0, 'missing rendered artifact: dist/sitemap*.xml');
  const parts = [];
  for (const name of sitemapFiles) {
    parts.push(await readFile(new URL(name, dist), 'utf8'));
  }
  return parts.join('\n');
}

function descendants(node, found = []) {
  found.push(node);
  for (const child of node.childNodes ?? []) descendants(child, found);
  if (node.content) descendants(node.content, found);
  return found;
}

function attribute(node, name) {
  return node?.attrs?.find((entry) => entry.name === name)?.value;
}

function textOf(node) {
  if (!node) return '';
  return (node.childNodes ?? [])
    .map((child) => (child.nodeName === '#text' ? child.value : textOf(child)))
    .join('');
}
