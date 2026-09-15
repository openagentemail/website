import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'parse5';

const quickstart = await readFile(new URL('../src/content/docs/docs/quickstart.md', import.meta.url), 'utf8');
const connect = await readFile(new URL('../src/content/docs/docs/guides/connect-your-agent.md', import.meta.url), 'utf8');
const otp = await readFile(new URL('../src/content/docs/docs/guides/otp-extraction.md', import.meta.url), 'utf8');
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

const ARTIFACTS = {
  quickstart: 'dist/docs/quickstart/index.html',
  connect: 'dist/docs/guides/connect-your-agent/index.html',
  mcp: 'dist/mcp/index.html',
  otp: 'dist/docs/guides/otp-extraction/index.html',
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
  { source: 'OTP extraction', markup: otp, href: '/docs/reference/mcp-clients/#external-mail-fence-expected-not-a-bug' },
  { source: 'MCP hub', markup: mcp, href: '/docs/quickstart/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/connect-your-agent/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/reference/mcp-clients/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/public-mcp/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/reference/api/' },
  { source: 'MCP hub', markup: mcp, href: '/docs/guides/otp-extraction/' },
  { source: 'MCP hub', markup: mcp, href: '/compare#mailslurp' },
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

if (process.argv.includes('--check-rendered')) {
  const renderedByRoute = {
    quickstart: parse(await readArtifact(ARTIFACTS.quickstart)),
    connect: parse(await readArtifact(ARTIFACTS.connect)),
    mcp: parse(await readArtifact(ARTIFACTS.mcp)),
    otp: parse(await readArtifact(ARTIFACTS.otp)),
  };

  assertPinnedRenderedMetadata(renderedByRoute.quickstart, 'Quickstart', QUICKSTART_TITLE, QUICKSTART_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.connect, 'Connect', CONNECT_TITLE, CONNECT_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.otp, 'OTP extraction', OTP_TITLE, OTP_DESCRIPTION);
  assertPinnedRenderedMetadata(renderedByRoute.mcp, '/mcp/', MCP_DOCUMENT_TITLE, MCP_DESCRIPTION, { exactTitle: true });

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

  const sitemap = await readSitemap();
  assert.match(sitemap, /https:\/\/openagent\.email\/mcp\//, 'sitemap is missing /mcp/');
  assert.match(
    sitemap,
    /https:\/\/openagent\.email\/docs\/guides\/otp-extraction\//,
    'sitemap is missing /docs/guides/otp-extraction/',
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
  }[source];
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
