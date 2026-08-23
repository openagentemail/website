import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { agentmailSources } from '../src/data/agentmailSources.js';

const compare = await readFile(new URL('../src/pages/compare.astro', import.meta.url), 'utf8');

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

const lastChecked = compare.match(/<p class="last-checked">Last checked: (?<date>\d{4}-\d{2}-\d{2})(?<sources>[\s\S]*?)<\/p>/);
assert.ok(lastChecked?.groups, 'Last checked date and sources must be present');

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

const fixedNow = new Date('2026-08-22T00:00:00.000Z');
const freshnessMaintenanceMessage = 'Last checked is stale: refresh the comparison facts and Last checked date. This guard intentionally fails closed after the 90-day freshness window.';
assert.equal(isFreshLastChecked('2026-08-22', fixedNow), true, 'Current Last checked date must pass with a fixed clock');
assert.equal(isFreshLastChecked('2026-08-23', fixedNow), false, 'Tomorrow must fail freshness with the UTC build clock');
assert.equal(isFreshLastChecked('2026-05-24', new Date('2026-08-22T12:00:00.000Z')), true, 'A date 90 calendar days old must remain fresh throughout that day');
assert.equal(isFreshLastChecked('2026-05-23', fixedNow), false, 'A date 91 days old must fail freshness');
assert.equal(isFreshLastChecked('2026-08-24', fixedNow), false, 'A future date must fail freshness');
assert.equal(isFreshLastChecked('2026-02-30', fixedNow), false, 'An impossible calendar date must fail freshness');

if (process.argv.includes('--check-freshness')) {
  assert.equal(isFreshLastChecked(lastChecked.groups.date), true, freshnessMaintenanceMessage);
}

assert.match(compare, /import\s+\{\s*agentmailSources\s*\}\s+from\s+['"]\.\.\/data\/agentmailSources\.js['"]/, 'Compare page must import the shared AgentMail sources');
assert.match(compare, /agentmailSources\.map\(/, 'Compare page must render the shared AgentMail sources');

for (const source of agentmailSources) {
  const url = new URL(source.href);
  assert.equal(url.protocol, 'https:', `Official AgentMail source must use HTTPS: ${source.href}`);
  assert.ok(['www.agentmail.to', 'docs.agentmail.to'].includes(url.hostname), `Official AgentMail source must stay on an AgentMail domain: ${source.href}`);
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

  const sourceLinks = descendants(renderedLastChecked).filter((node) => node.nodeName === 'a');
  for (const source of agentmailSources) {
    const link = sourceLinks.find((node) => attribute(node, 'href') === source.href);
    assert.ok(link, `Built compare page is missing primary AgentMail source: ${source.href}`);
    assert.equal(attribute(link, 'rel'), 'noopener noreferrer', `Built compare page is missing rel protection: ${source.href}`);
    assert.equal(text(link), source.label, `Built compare page has the wrong source label: ${source.href}`);
  }
}
