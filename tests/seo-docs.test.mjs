import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
  assert.doesNotMatch(
    markup,
    /\b(?!1\.1\.1\.1)(?:\d{1,3}\.){3}\d{1,3}\b/,
    `${label} must not hardcode VPS IPv4 addresses`,
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
assert.match(
  playwrightCode,
  /test\.setTimeout\(90_000\)/,
  'Playwright example must set enclosing test timeout with test.setTimeout(90_000)',
);
assertAppearsBefore(
  playwrightCode,
  /test\.setTimeout\(90_000\)/,
  /request\.post/,
  'Playwright example must call test.setTimeout before request.post',
);
{
  const enclosing = playwrightCode.match(/test\.setTimeout\((\d[\d_]*)\)/);
  const requestTimeout = playwrightCode.match(/timeout:\s*(\d[\d_]*)/);
  const serverWait = playwrightCode.match(/timeoutSec:\s*(\d+)/);
  assert.ok(enclosing, 'Playwright example is missing test.setTimeout(<ms>)');
  assert.ok(requestTimeout, 'Playwright example is missing request timeout: <ms>');
  assert.ok(serverWait, 'Playwright example is missing timeoutSec: <seconds>');
  const enclosingMs = Number(enclosing[1].replaceAll('_', ''));
  const requestMs = Number(requestTimeout[1].replaceAll('_', ''));
  const serverWaitMs = Number(serverWait[1]) * 1000;
  assert.equal(enclosingMs, 90_000, 'Playwright enclosing test timeout must be 90_000');
  assert.equal(requestMs, 70_000, 'Playwright request timeout must be 70_000');
  assert.equal(Number(serverWait[1]), 60, 'Playwright timeoutSec must be 60');
  assert.ok(
    enclosingMs > requestMs && requestMs > serverWaitMs,
    `Playwright example timeout ladder must be 90_000 > 70_000 > timeoutSec: 60; actual ${enclosingMs} > ${requestMs} > ${serverWaitMs}`,
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
const failClosedAt = playwrightCode.search(/!mailbox \|\| !expectedSender \|\| !signupUrl/);
assert.ok(failClosedAt !== -1, 'Playwright example must fail closed when mailbox, expected sender, or signup URL is empty');
assert.ok(
  waitCallAt !== -1 && failClosedAt < waitCallAt,
  'Playwright example must fail closed before starting the wait',
);
assert.match(
  playwrightCode,
  /toContain\(expectedSender/,
  'Playwright example must validate expected sender before consuming otp.codes',
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
  /link\.protocol !== 'https:'/,
  'Playwright example must require HTTPS before opening otp.links',
);
assert.match(
  playwrightCode,
  /link\.hostname !== expectedHost/,
  'Playwright example must require the exact expected host before opening otp.links',
);
assertAppearsBefore(
  playwrightCode,
  /request\.post\([\s\S]*?\/v1\/messages\/wait/,
  /getByRole\('button', \{ name: 'Sign up' \}\)\.click\(\)/,
  'Playwright example must start request.post(/v1/messages/wait) before the Sign up click',
);
assertAppearsBefore(
  playwrightCode,
  /toContain\(expectedSender/,
  /message\.otp\.codes\[0\]/,
  'Playwright example must call toContain(expectedSender) before message.otp.codes[0]',
);
assertAppearsBefore(
  playwrightCode,
  /link\.protocol !== 'https:' \|\| link\.hostname !== expectedHost/,
  /page\.goto\(link\.toString\(\)\)/,
  'Playwright example must apply the HTTPS+exact-host guard before page.goto(link.toString())',
);
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
