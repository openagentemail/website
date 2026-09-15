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
{
  const unsafeArgvExample = `curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records" \\
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \\
  --data '{"type":"A","name":"mail","content":"<VPS IP>","proxied":false,"ttl":300}'`;
  const withBearerOnArgv = dnsCloudflare.includes('-H "Authorization: Bearer $CF_TOKEN"')
    ? dnsCloudflare
    : dnsCloudflare.replace(
      /printf 'header = "Authorization: Bearer %s"\\n' "\$CF_TOKEN" \| \\\ncurl -sS -X POST "https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/\$CF_ZONE\/dns_records" \\\n  -H "Content-Type: application\/json" \\\n  -K - \\\n  --data '\{"type":"A","name":"mail","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
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
assert.equal(
  decideOtpNavigationFromSourceContract(playwrightCode, 'https://verify.example.com/step2', 'verify.example.com', true),
  'continue',
  'same-host HTTPS top-level navigation must continue under the redirect-chain guard',
);
assert.equal(
  decideOtpNavigationFromSourceContract(playwrightCode, 'http://verify.example.com/otp', 'verify.example.com', true),
  'abort',
  'trusted initial OTP URL redirecting to HTTP must be aborted',
);
assert.equal(
  decideOtpNavigationFromSourceContract(playwrightCode, 'https://192.0.2.1/otp', 'verify.example.com', true),
  'abort',
  'trusted initial OTP URL redirecting to an IP literal must be aborted',
);
assert.equal(
  decideOtpNavigationFromSourceContract(playwrightCode, 'https://evil.example.com/otp', 'verify.example.com', true),
  'abort',
  'trusted initial OTP URL redirecting to a different host must be aborted',
);
assert.equal(
  decideOtpNavigationFromSourceContract(playwrightCode, 'https://evil.example.com/otp', 'verify.example.com', false),
  'continue',
  'non-navigation requests must continue even when the URL would fail OTP validation',
);
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
    /test\.use\(\{\s*serviceWorkers:\s*'block'\s*\}\);\n?/,
    '',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(withoutServiceWorkers),
    /serviceWorkers:\s*'block'/,
    "removing test.use({ serviceWorkers: 'block' }) must fail the OTP redirect-guard validator",
  );
}
{
  const continuesDisallowed = playwrightCode.replace(
    /await route\.abort\(\);\n\s*return;/,
    'await route.continue();\n      return;',
  );
  assert.throws(
    () => assertPlaywrightOtpRedirectGuardSourceContract(continuesDisallowed),
    /abort|disallowed|continue/,
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
    /assertTrustedOtpUrl\((?:req|request)\.url\(\), expectedHost\)/,
    'Playwright example must reuse assertTrustedOtpUrl for redirect-chain navigation requests',
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
    /async function abortUntrustedOtpNavigation\(/,
    'Playwright example must install a named abortUntrustedOtpNavigation route handler',
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
    /route\.abort\(\)/,
    'Playwright example must abort disallowed top-level OTP navigations',
  );
  assert.match(
    code,
    /route\.continue\(\)/,
    'Playwright example must continue allowed traffic',
  );
  const handlerMatch = code.match(
    /async function abortUntrustedOtpNavigation\([\s\S]*?\n  \}/,
  );
  assert.ok(handlerMatch, 'Playwright example is missing abortUntrustedOtpNavigation body');
  const catchBlock = handlerMatch[0].match(/catch\s*\{([\s\S]*?)\}/);
  assert.ok(catchBlock, 'Playwright example must catch assertTrustedOtpUrl failures in the route handler');
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

function decideOtpNavigationFromSourceContract(code, rawUrl, expectedHost, isMainFrameNavigation) {
  const assertTrustedOtpUrl = extractAssertTrustedOtpUrlFromGuide(code);
  assertPlaywrightOtpRedirectGuardSourceContract(code);
  if (isMainFrameNavigation) {
    try {
      assertTrustedOtpUrl(rawUrl, expectedHost);
    } catch {
      return 'abort';
    }
  }
  return 'continue';
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
    /--data '\{"type":"A","name":"mail","content":"<VPS IP>","proxied":false,"ttl":300\}'/,
    'Cloudflare API example must preserve the JSON payload with "proxied":false',
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
