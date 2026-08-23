import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { agentmailLastChecked, agentmailSources, assertOfficialAgentmailSources } from '../src/data/agentmailSources.js';

const compare = await readFile(new URL('../src/pages/compare.astro', import.meta.url), 'utf8');

assert.doesNotThrow(() => assertOfficialAgentmailSources(agentmailSources), 'Shared AgentMail sources must satisfy the module validation');
assert.throws(() => assertOfficialAgentmailSources([{ href: 'http://www.agentmail.to/pricing', label: 'pricing' }]), /must use HTTPS on an approved AgentMail host/, 'Module validation must reject a non-HTTPS source');
assert.throws(() => assertOfficialAgentmailSources([{ href: 'https://example.invalid/pricing', label: 'pricing' }]), /must use HTTPS on an approved AgentMail host/, 'Module validation must reject a third-party host');

for (const fact of [
  'Official MCP and plugin ecosystem',
  'The deployment and control-plane distinction is that openagent.email is Apache-2.0 software you self-host on any VPS or cloud, with no vendor control plane and unlimited identities on your own domains',
  'Developer/Startup: PAYG +$2 per inbox, domain, or 1k sends; annual plans save 20%',
  'no per-inbox fee',
  'Official OpenClaw plugin + Grok Bot Cursor plugin',
  'Universal MCP: connect directly from Claude, ChatGPT, Grok, or Cursor; official connection guide',
]) {
  assert.match(compare, new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing comparison fact: ${fact}`);
}

assert.doesNotMatch(compare, /Not independently verified<\/td><td>REST\/SDKs/, 'AgentMail MCP must not be described as unverified');
assert.doesNotMatch(compare, /Per-inbox subscription/, 'Price must not imply a subscription cliff');
assert.doesNotMatch(compare, /The openagent\.email difference is clear/, 'Comparison copy must remain neutral');

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

if (process.argv.includes('--check-freshness')) {
  const warning = freshnessWarning(agentmailLastChecked);
  if (warning) console.warn(warning);
  assert.equal(isFreshLastChecked(agentmailLastChecked), true, freshnessMaintenanceMessage);
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

if (process.argv.includes('--check-rendered')) {
  const renderedCompare = await readFile(new URL('../dist/compare/index.html', import.meta.url), 'utf8');
  const document = parse(renderedCompare);
  const renderedLastChecked = descendants(document).find((node) =>
    node.nodeName === 'p' && attribute(node, 'class')?.split(/\s+/).includes('last-checked'),
  );
  assert.ok(renderedLastChecked, 'Built compare page must include Last checked sources');
  assert.ok(text(renderedLastChecked).startsWith(`Last checked: ${agentmailLastChecked} · AgentMail sources:`), 'Built compare page must render the shared Last checked date');

  const sourceLinks = descendants(renderedLastChecked).filter((node) => node.nodeName === 'a');
  assert.equal(sourceLinks.length, agentmailSources.length, 'Built compare page must render exactly the shared AgentMail sources');
  for (const source of agentmailSources) {
    const link = sourceLinks.find((node) => attribute(node, 'href') === source.href);
    assert.ok(link, `Built compare page is missing primary AgentMail source: ${source.href}`);
    assert.equal(attribute(link, 'rel'), 'noopener noreferrer', `Built compare page is missing rel protection: ${source.href}`);
    assert.equal(text(link), source.label, `Built compare page has the wrong source label: ${source.href}`);
  }
}
