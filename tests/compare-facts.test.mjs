import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { agentmailLastChecked, agentmailSources, assertOfficialAgentmailSources } from '../src/data/agentmailSources.js';
import { mailslurpLastChecked, mailslurpSources, assertOfficialMailslurpSources } from '../src/data/mailslurpSources.js';

const compare = await readFile(new URL('../src/pages/compare.astro', import.meta.url), 'utf8');
const homepage = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

assert.doesNotThrow(() => assertOfficialAgentmailSources(agentmailSources), 'Shared AgentMail sources must satisfy the module validation');
assert.throws(() => assertOfficialAgentmailSources([{ href: 'http://www.agentmail.to/pricing', label: 'pricing' }]), /must use HTTPS on an approved AgentMail host/, 'Module validation must reject a non-HTTPS source');
assert.throws(() => assertOfficialAgentmailSources([{ href: 'https://example.invalid/pricing', label: 'pricing' }]), /must use HTTPS on an approved AgentMail host/, 'Module validation must reject a third-party host');
assert.throws(() => assertOfficialAgentmailSources([{ href: 'not a URL', label: 'pricing' }]), /must use HTTPS on an approved AgentMail host/, 'Module validation must reject a malformed source URL with its semantic error');

assert.doesNotThrow(() => assertOfficialMailslurpSources(mailslurpSources), 'Shared MailSlurp sources must satisfy the module validation');
assert.throws(() => assertOfficialMailslurpSources([{ href: 'http://app.mailslurp.com/pricing/', label: 'pricing' }]), /must use HTTPS on an approved MailSlurp host/, 'MailSlurp module validation must reject a non-HTTPS source');
assert.throws(() => assertOfficialMailslurpSources([{ href: 'https://example.invalid/pricing', label: 'pricing' }]), /must use HTTPS on an approved MailSlurp host/, 'MailSlurp module validation must reject a third-party host');
assert.throws(() => assertOfficialMailslurpSources([{ href: 'not a URL', label: 'pricing' }]), /must use HTTPS on an approved MailSlurp host/, 'MailSlurp module validation must reject a malformed source URL with its semantic error');

const requiredAgentmailSourcesDigest = 'd15e8535f3afcc624399104447ef679abacdabdb39e47c426bd0c1e18b25c414';
const requiredMailslurpSourcesDigest = '8562194fb55e7187bd4b13c21d8924dd5fc45cdad73db13722df5fe6f655076d';

function sourceDigest(sources) {
  const canonicalSources = sources.map(({ href, label }) => `${href}\t${label}`).sort().join('\n');
  return createHash('sha256').update(canonicalSources).digest('hex');
}

assert.equal(sourceDigest(agentmailSources), requiredAgentmailSourcesDigest, 'Shared AgentMail sources must retain the required official source set. After rechecking official sources, intentionally update requiredAgentmailSourcesDigest with the approved source change.');
assert.equal(sourceDigest(mailslurpSources), requiredMailslurpSourcesDigest, 'Shared MailSlurp sources must retain the required official source set. After rechecking official sources, intentionally update requiredMailslurpSourcesDigest with the approved source change.');

for (const fact of [
  'Official MCP and plugin ecosystem',
  'The deployment and control-plane distinction is that openagent.email is Apache-2.0 software you self-host on any VPS or cloud, with no vendor control plane and unlimited identities on your own domains',
  'Developer/Startup: PAYG +$2 per inbox, domain, or 1k sends; annual plans save 20%',
  'no per-inbox fee',
  'Official OpenClaw plugin + Grok Bot Cursor plugin + official Codex plugin',
  'Universal MCP: connect directly from Claude, ChatGPT, Grok, or Cursor; official connection guide',
  'outbound sending was disrupted for about eight hours after AWS paused sending on shared email infrastructure',
]) {
  assert.match(compare, new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing comparison fact: ${fact}`);
}

assert.doesNotMatch(compare, /Not independently verified<\/td><td>REST\/SDKs/, 'AgentMail MCP must not be described as unverified');
assert.doesNotMatch(compare, /Per-inbox subscription/, 'Price must not imply a subscription cliff');
assert.doesNotMatch(compare, /The openagent\.email difference is clear/, 'Comparison copy must remain neutral');
assert.doesNotMatch(compare, /7 MCP tools/, 'Compare page must not keep the outdated 7 MCP tools count');
assert.doesNotMatch(compare, /shut down|gone out of business|已倒闭/i, 'Incident footnote must not extrapolate beyond the official account');

// The MailSlurp cells are a single approved fact set shared by two surfaces, so they are pinned together:
// drifting them apart again is the defect this block exists to catch.
for (const [surface, source] of [['/compare', compare], ['homepage', homepage]]) {
  assert.match(source, /Capped plans \+ metered overages/, `${surface} must state MailSlurp's sourced pricing model: capped plans with metered overages`);
  assert.match(source, /Paid-tier limits/, `${surface} must use the shared paid-tier inbox-limit wording`);
  assert.doesNotMatch(source, /often disposable/i, `${surface} must not carry the unsourced MailSlurp disposability claim`);
  assert.doesNotMatch(source, /Metered usage|Usage-based subscription|>Paid tiers</, `${surface} must not restore a retired MailSlurp wording`);
}

function comparisonTableCell(table, rowLabel, columnIndex, surface) {
  assert.ok(table, `Built ${surface} must retain its comparison table`);

  const row = descendants(table).find((node) =>
    node.nodeName === 'tr'
      && node.childNodes?.find((child) => child.nodeName === 'td')
      && text(node.childNodes.find((child) => child.nodeName === 'td')).trim() === rowLabel,
  );
  assert.ok(row, `${surface} comparison table must retain the ${rowLabel} row`);

  const cells = row.childNodes.filter((child) => child.nodeName === 'td');
  assert.equal(cells.length, 4, `${surface} comparison table ${rowLabel} row must retain its four columns`);
  return text(cells[columnIndex]).trim();
}

// Both comparison tables are label / openagent.email / AgentMail / MailSlurp, so column 2 is AgentMail and 3 is MailSlurp.
function homepageSummaryCell(document, rowLabel, columnIndex = 2) {
  const homepageSummary = descendants(document).find((node) =>
    node.nodeName === 'div'
      && attribute(node, 'class')?.split(/\s+/).includes('cmp')
      && attribute(node, 'class')?.split(/\s+/).includes('reveal'),
  );
  assert.ok(homepageSummary, 'Built homepage must retain its comparison summary table');

  const table = descendants(homepageSummary).find((node) => node.nodeName === 'table');
  return comparisonTableCell(table, rowLabel, columnIndex, 'Homepage');
}

function comparePageCell(document, rowLabel, columnIndex = 2) {
  const table = descendants(document).find((node) =>
    node.nodeName === 'table' && attribute(node, 'class')?.split(/\s+/).includes('compare'),
  );
  return comparisonTableCell(table, rowLabel, columnIndex, '/compare');
}

assert.match(homepage, /How is it different from AgentMail\?[\s\S]*?usage-based pricing/, 'Homepage FAQ must retain its internally consistent usage-based pricing wording');
assert.equal(agentmailLastChecked, '2026-08-30', 'Shared AgentMail Last checked date must use the 2026-08-30 Codex/incident recheck date. When refreshing agentmailLastChecked, update this exact assertion too.');
assert.equal(mailslurpLastChecked, '2026-09-03', 'Shared MailSlurp Last checked date must use the 2026-09-03 (UTC) pricing-page recheck date. When refreshing mailslurpLastChecked, update this exact assertion too.');

function isFreshLastChecked(date, now = new Date()) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return false;

  const [, year, month, day] = parts.map(Number);
  const checkedAt = new Date(Date.UTC(year, month - 1, day));
  const nowAtStartOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const isExactDate = checkedAt.getUTCFullYear() === year
    && checkedAt.getUTCMonth() === month - 1
    && checkedAt.getUTCDate() === day;

  return isExactDate
    && checkedAt.valueOf() <= nowAtStartOfDay
    && nowAtStartOfDay - checkedAt.valueOf() <= 90 * 24 * 60 * 60 * 1000;
}

function freshnessWarning(date, now = new Date()) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return undefined;

  const [, year, month, day] = parts.map(Number);
  const checkedAt = new Date(Date.UTC(year, month - 1, day));
  const nowAtStartOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysOld = (nowAtStartOfDay - checkedAt.valueOf()) / (24 * 60 * 60 * 1000);

  return isFreshLastChecked(date, now) && daysOld >= 76
    ? `Last checked expires in ${90 - daysOld} day(s): recheck the comparison facts and refresh Last checked before the 90-day fail-closed gate.`
    : undefined;
}

function freshnessDiagnostics(date, now = new Date()) {
  const buildUtc = now.toISOString().slice(0, 10);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return `buildUtc=${buildUtc} checked=${date} ageDays=invalid`;

  const [, year, month, day] = parts.map(Number);
  const checkedAt = new Date(Date.UTC(year, month - 1, day));
  const nowAtStartOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return `buildUtc=${buildUtc} checked=${date} ageDays=${(nowAtStartOfDay - checkedAt.valueOf()) / (24 * 60 * 60 * 1000)}`;
}

const fixedNow = new Date('2026-08-22T00:00:00.000Z');
const freshnessMaintenanceMessage = 'Last checked is stale: refresh the comparison facts and Last checked date. This guard intentionally fails closed after the 90-day freshness window.';
assert.equal(isFreshLastChecked('2026-08-22', fixedNow), true, 'Current Last checked date must pass with a fixed clock');
assert.equal(isFreshLastChecked('2026-08-23', fixedNow), false, 'Tomorrow must fail freshness with the UTC build clock');
assert.equal(isFreshLastChecked('2026-05-24', new Date('2026-08-22T12:00:00.000Z')), true, 'A date 90 calendar days old must remain fresh throughout that day');
assert.equal(isFreshLastChecked('2026-05-23', fixedNow), false, 'A date 91 days old must fail freshness');
assert.equal(isFreshLastChecked('2026-08-24', fixedNow), false, 'A future date must fail freshness');
assert.equal(isFreshLastChecked('2026-02-30', fixedNow), false, 'An impossible calendar date must fail freshness');
assert.equal(freshnessWarning('2026-08-22', new Date('2026-11-05T00:00:00.000Z')), undefined, 'A date 15 days from expiry must not warn yet');
assert.match(freshnessWarning('2026-08-22', new Date('2026-11-06T00:00:00.000Z')), /expires in 14 day\(s\)/, 'A date 14 days from expiry must warn proactively');
assert.equal(isFreshLastChecked('2026-08-22', new Date('2026-11-21T00:00:00.000Z')), false, 'A date 91 days old must block freshness');
assert.equal(freshnessDiagnostics('2026-08-22', fixedNow), 'buildUtc=2026-08-22 checked=2026-08-22 ageDays=0', 'Freshness diagnostics must report the UTC build date, checked date, and age');

if (process.argv.includes('--check-freshness')) {
  for (const [vendor, lastChecked] of [['AgentMail', agentmailLastChecked], ['MailSlurp', mailslurpLastChecked]]) {
    const diagnostics = freshnessDiagnostics(lastChecked);
    console.warn(`Compare freshness (${vendor}): ${diagnostics}`);
    const warning = freshnessWarning(lastChecked);
    if (warning) console.warn(`${vendor}: ${warning}`);
    assert.equal(isFreshLastChecked(lastChecked), true, `${vendor}: ${freshnessMaintenanceMessage} Check the synchronized UTC build clock. ${diagnostics}`);
  }
}

function descendants(node) {
  return (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function attribute(node, name) {
  return node.attrs?.find((entry) => entry.name === name)?.value;
}

function text(node) {
  return (node.childNodes ?? []).map((child) => child.nodeName === '#text' ? child.value : text(child)).join('');
}

async function readRenderedCompare() {
  try {
    return await readFile(new URL('../dist/compare/index.html', import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Built compare page is missing: run npm run build first.');
    }
    throw error;
  }
}

async function readRenderedHomepage() {
  try {
    return await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Built homepage is missing: run npm run build first.');
    }
    throw error;
  }
}

if (process.argv.includes('--check-rendered')) {
  const renderedCompare = await readRenderedCompare();
  const document = parse(renderedCompare);
  const renderedLastChecked = descendants(document).find((node) =>
    node.nodeName === 'p' && attribute(node, 'class')?.split(/\s+/).includes('last-checked'),
  );
  assert.ok(renderedLastChecked, 'Built compare page must include Last checked sources');
  assert.ok(
    text(renderedLastChecked).startsWith(`Last checked: AgentMail ${agentmailLastChecked} · MailSlurp ${mailslurpLastChecked}.`),
    'Built compare page must render both shared Last checked dates',
  );

  for (const vendor of [
    { key: 'agentmail', name: 'AgentMail', sources: agentmailSources, digest: requiredAgentmailSourcesDigest },
    { key: 'mailslurp', name: 'MailSlurp', sources: mailslurpSources, digest: requiredMailslurpSourcesDigest },
  ]) {
    const group = descendants(renderedLastChecked).find((node) =>
      node.nodeName === 'span' && attribute(node, 'data-vendor') === vendor.key,
    );
    assert.ok(group, `Built compare page must render a ${vendor.name} source group`);
    assert.ok(text(group).startsWith(`${vendor.name} sources:`), `Built compare page must label the ${vendor.name} source group`);

    const sourceLinks = descendants(group).filter((node) => node.nodeName === 'a');
    assert.equal(sourceLinks.length, vendor.sources.length, `Built compare page must render exactly the shared ${vendor.name} sources`);
    assert.equal(sourceDigest(sourceLinks.map((link) => ({ href: attribute(link, 'href'), label: text(link) }))), vendor.digest, `Built compare page must render the required official ${vendor.name} source set`);
    for (const source of vendor.sources) {
      const link = sourceLinks.find((node) => attribute(node, 'href') === source.href);
      assert.ok(link, `Built compare page is missing primary ${vendor.name} source: ${source.href}`);
      assert.equal(attribute(link, 'rel'), 'noopener noreferrer', `Built compare page is missing rel protection: ${source.href}`);
      assert.equal(text(link), source.label, `Built compare page has the wrong ${vendor.name} source label: ${source.href}`);
    }
  }

  assert.equal(comparePageCell(document, 'Price', 3), 'Capped plans + metered overages', 'Built /compare MailSlurp Price cell must state the sourced pricing model');
  assert.equal(comparePageCell(document, 'Unlimited inboxes', 3), 'Paid-tier limits', 'Built /compare MailSlurp inbox cell must use the shared approved wording');
  assert.equal(comparePageCell(document, 'Price', 1), 'Free software + your server; no per-inbox fee', 'Built /compare openagent.email Price cell must stay as approved');
  assert.equal(comparePageCell(document, 'Unlimited inboxes', 1), 'Yes, on your domain', 'Built /compare openagent.email inbox cell must stay as approved');

  const renderedHomepage = parse(await readRenderedHomepage());
  assert.equal(homepageSummaryCell(renderedHomepage, 'Price'), 'Developer/Startup: PAYG +$2 per inbox, domain, or 1k sends; annual plans save 20%', 'Built homepage AgentMail Price cell must exactly match the approved /compare PAYG fact');
  assert.equal(homepageSummaryCell(renderedHomepage, 'OTP / link extraction'), 'Not independently verified', 'Built homepage AgentMail OTP/link-extraction cell must exactly match the approved /compare wording');
  assert.equal(homepageSummaryCell(renderedHomepage, 'Price', 3), 'Capped plans + metered overages', 'Built homepage MailSlurp Price cell must exactly match the approved /compare wording');
  assert.equal(homepageSummaryCell(renderedHomepage, 'Unlimited inboxes', 3), 'Paid-tier limits', 'Built homepage MailSlurp inbox cell must exactly match the approved /compare wording');
  assert.equal(homepageSummaryCell(renderedHomepage, 'Price', 1), 'Flat VPS cost (~$5/mo)', 'Built homepage openagent.email Price cell must keep its approved short form');
  assert.equal(homepageSummaryCell(renderedHomepage, 'Unlimited inboxes', 1), '✓ catch-all', 'Built homepage openagent.email inbox cell must keep its approved short form');
}
