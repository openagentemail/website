import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compare = await readFile(new URL('../src/pages/compare.astro', import.meta.url), 'utf8');

for (const fact of [
  'Last checked: 2026-08-22',
  'Official MCP and plugin ecosystem',
  'Apache-2.0 software you self-host on any VPS or cloud, no vendor control plane, and unlimited identities on your own domains',
  'Developer/Startup: PAYG +$2 per inbox, domain, or 1k sends; annual plans save 20%',
  'no per-inbox fee',
  'Official OpenClaw plugin + Grok Bot Cursor plugin',
  'Universal MCP: connect directly from Claude, ChatGPT, Grok, or Cursor; official connection guide',
]) {
  assert.ok(compare.includes(fact), `Missing comparison fact: ${fact}`);
}

assert.ok(!compare.includes('Not independently verified</td><td>REST/SDKs'), 'AgentMail MCP must not be described as unverified');
assert.ok(!compare.includes('Per-inbox subscription'), 'Price must not imply a subscription cliff');
