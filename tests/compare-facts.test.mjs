import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compare = await readFile(new URL('../src/pages/compare.astro', import.meta.url), 'utf8');

for (const fact of [
  'Official MCP and plugin ecosystem',
  'The deployment and control-plane distinction is that openagent.email is Apache-2.0 software you self-host on any VPS or cloud, with no vendor control plane and unlimited identities on your own domains',
  'Developer/Startup: PAYG +$2 per inbox, domain, or 1k sends; annual plans save 20%',
  'no per-inbox fee',
  'Official OpenClaw plugin + Grok Bot Cursor plugin',
  'Universal MCP: connect directly from Claude, ChatGPT, Grok, or Cursor; official connection guide',
]) {
  assert.ok(compare.includes(fact), `Missing comparison fact: ${fact}`);
}

assert.ok(!compare.includes('Not independently verified</td><td>REST/SDKs'), 'AgentMail MCP must not be described as unverified');
assert.ok(!compare.includes('Per-inbox subscription'), 'Price must not imply a subscription cliff');
assert.ok(!compare.includes('The openagent.email difference is clear'), 'Comparison copy must remain neutral');

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
    && checkedAt.valueOf() <= nowAtStartOfDay + 24 * 60 * 60 * 1000
    && nowAtStartOfDay - checkedAt.valueOf() <= 90 * 24 * 60 * 60 * 1000;
}

const fixedNow = new Date('2026-08-22T00:00:00.000Z');
const freshnessMaintenanceMessage = 'Last checked is stale: refresh the comparison facts and Last checked date. This guard intentionally fails closed after the 90-day freshness window.';
assert.equal(isFreshLastChecked('2026-08-22', fixedNow), true, 'Current Last checked date must pass with a fixed clock');
assert.equal(isFreshLastChecked('2026-05-24', new Date('2026-08-22T12:00:00.000Z')), true, 'A date 90 calendar days old must remain fresh throughout that day');
assert.equal(isFreshLastChecked('2026-05-23', fixedNow), false, 'A date 91 days old must fail freshness');
assert.equal(isFreshLastChecked('2026-08-24', fixedNow), false, 'A future date beyond the one-day timezone allowance must fail freshness');
assert.equal(isFreshLastChecked('2026-02-30', fixedNow), false, 'An impossible calendar date must fail freshness');

if (process.env.CHECK_COMPARE_FRESHNESS === '1') {
  assert.equal(isFreshLastChecked(lastChecked.groups.date), true, freshnessMaintenanceMessage);
}

const sourceLinks = [...lastChecked.groups.sources.matchAll(/<a\b(?<attributes>[^>]*)>/g)].map(({ groups }) =>
  Object.fromEntries([...groups.attributes.matchAll(/(?<name>[^\s=]+)="(?<value>[^"]*)"/g)].map(({ groups: attribute }) => [attribute.name, attribute.value])),
);

for (const source of [
  'https://www.agentmail.to/pricing',
  'https://docs.agentmail.to/integrations/mcp',
  'https://www.agentmail.to/blog/agentmail-official-openclaw-plugin',
  'https://www.agentmail.to/blog/give-grok-bot-email-address',
]) {
  const link = sourceLinks.find(({ href }) => href === source);
  assert.ok(link, `Missing primary AgentMail source: ${source}`);
  assert.equal(link.rel, 'noopener noreferrer', `Missing rel protection for primary AgentMail source: ${source}`);
}
