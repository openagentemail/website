// Normative machine-check for the webhook reference section (predecessor of the
// B3 machine-check slice).
//
// Modes (direct node run — same convention as tests/mcp-tools.test.mjs; note that
// `node --test <file> --flag` does NOT forward the flag to the child process):
//   node tests/webhook-normative.test.mjs                 # doc-side goldens (no source needed)
//   node tests/webhook-normative.test.mjs --check-source  # cross-check the doc against the implementation
//
// Source resolution for --check-source: OAE_SRC (path to a checkout of the product
// repo whose working files are the revision under check) → otherwise fetch from
// raw.githubusercontent.com/openagentemail/openagentemail/main.
//
// Fail-loud classes: NETWORK (cannot fetch), PARSE (source layout changed),
// MISMATCH (doc and implementation disagree) — "cannot verify" never counts as pass.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_URL = new URL('../src/content/docs/docs/reference/api.md', import.meta.url);
const isSourceMode = process.argv.includes('--check-source');

const REMOTE_BASE = 'https://raw.githubusercontent.com/openagentemail/openagentemail/main/';
const SOURCE_FILES = {
  app: 'packages/api/src/app.ts',
  scopePolicy: 'packages/api/src/lib/scope-policy.ts',
  config: 'packages/api/src/lib/config.ts',
  webhookRoutes: 'packages/api/src/routes/webhooks.ts',
  delivery: 'packages/api/src/lib/webhook-delivery.ts',
  store: 'packages/api/src/lib/webhook-store.ts',
};

// Wire error literals the section must document verbatim (golden set, byte-exact).
const DOC_LITERALS = [
  'webhooks_disabled',
  'invalid_request',
  'invalid_webhook_url',
  'webhook_target_forbidden',
  'webhook_limit_reached',
  'rate_limited',
  'not_found',
  'content_scope_requires_admin',
  'webhook_not_disabled',
  'webhook_disabled',
  'rotation_window_open',
  'forbidden: insufficient_scope',
  'delivery_not_found',
  'delivery_not_replayable',
  'webhook_not_found',
  'message_not_found',
  'stale_message_generation',
  'uidvalidity_required',
  'internal_error',
  'invalid_cursor',
];

// env → { value, doc } : default claimed by the section, matched against the config schema.
const CONFIG_DEFAULTS = {
  WEBHOOK_ALLOWED_PORTS: { value: '443', doc: '`WEBHOOK_ALLOWED_PORTS` (default `443` only)' },
  WEBHOOK_MAX_SUBSCRIPTIONS: { value: '16', doc: '(default 16 server-wide)' },
  WEBHOOK_MAX_PER_ADDRESS: { value: '4', doc: '(default 4 per address)' },
  WEBHOOK_POOL_RETRY_MS: { value: '5000', doc: '`WEBHOOK_POOL_RETRY_MS`, default 5000 ms' },
  WEBHOOK_ROTATION_OVERLAP_MS: { value: '86400000', doc: '(default `86400000` ms = 24 hours)' },
  WEBHOOK_LOG_MAX_ROWS: { value: '100000', doc: '`WEBHOOK_LOG_MAX_ROWS`, default **100,000**' },
  WEBHOOK_RATE_CREATE_PER_MIN: { value: '10', doc: 'default 10 requests per minute per caller' },
  WEBHOOK_RATE_TEST_PER_MIN: { value: '3', doc: 'default 3 requests per minute per caller' },
};

const DOC_EVENTS = ['mail.received', 'approval.requested'];
const PING_ATTEMPTS_DOC = '`MAX_PING_ATTEMPTS` attempts (default 3: immediate, +5s, +5m)';

function sectionOf(doc) {
  const start = doc.indexOf('\n## Webhooks\n');
  assert.ok(start >= 0, 'api.md must contain the `## Webhooks` section');
  return doc.slice(start);
}

async function loadSources() {
  const srcDir = process.env.OAE_SRC;
  const out = {};
  for (const [key, path] of Object.entries(SOURCE_FILES)) {
    if (srcDir) {
      out[key] = await readFile(join(srcDir, path), 'utf8');
      continue;
    }
    let res;
    try {
      res = await fetch(REMOTE_BASE + path, { signal: AbortSignal.timeout(20000) });
    } catch (err) {
      assert.fail(`WEBHOOK-NORMATIVE/NETWORK: 拉取源文件失败（${path}）：${err?.message ?? err} —— 无法核验≠通过`);
    }
    if (!res.ok) {
      assert.fail(`WEBHOOK-NORMATIVE/NETWORK: 拉取源文件失败（${path}）：HTTP ${res.status} —— 无法核验≠通过`);
    }
    out[key] = await res.text();
  }
  return out;
}

function assertDocLiterals(sec) {
  for (const lit of DOC_LITERALS) {
    assert.ok(
      sec.includes(`{"error":"${lit}"`),
      `documented error literal missing from the section: ${lit}`,
    );
  }
  assert.ok(
    sec.includes('{"error":"forbidden: insufficient_scope"}'),
    'the scoped-denial literal must be `forbidden: insufficient_scope` (with the space after the colon)',
  );
  assert.ok(
    !sec.includes('{"error":"forbidden:insufficient_scope"}'),
    'the unspaced `forbidden:insufficient_scope` form must not appear anywhere in the section',
  );
}

function assertDocFragments(sec) {
  for (const [env, spec] of Object.entries(CONFIG_DEFAULTS)) {
    assert.ok(sec.includes(spec.doc), `default claim missing for ${env}: ${spec.doc}`);
  }
  assert.ok(sec.includes(PING_ATTEMPTS_DOC), 'ping attempt claim missing');
  for (const ev of DOC_EVENTS) assert.ok(sec.includes(ev), `event missing from the section: ${ev}`);
  assert.ok(sec.includes('X-OAE-Signature'), 'X-OAE-Signature header missing');
  assert.ok(
    sec.includes('**Authorization premise (applies to all endpoints below).**'),
    'authorization premise block missing',
  );
  assert.ok(sec.includes('including read-only requests'), 'premise must state reads are denied for scoped tokens');
}

if (!isSourceMode) {
  test('webhook section normative goldens (doc-side)', async () => {
    const sec = sectionOf(await readFile(API_URL, 'utf8'));
    assertDocLiterals(sec);
    assertDocFragments(sec);
  });
} else {
  test('webhook section normative claims match the implementation (--check-source)', async () => {
    const [sec, src] = await Promise.all([
      readFile(API_URL, 'utf8').then(sectionOf),
      loadSources(),
    ]);
    const allSource = Object.values(src).join('\n');

    // 1. doc-side goldens first (same as default mode), then doc → source byte check
    assertDocLiterals(sec);
    assertDocFragments(sec);
    for (const lit of DOC_LITERALS) {
      assert.ok(
        allSource.includes(`'${lit}'`),
        `MISMATCH: doc literal not found in source, byte-for-byte: ${lit}`,
      );
    }

    // 2. config defaults: documented value ↔ schema default
    for (const [env, spec] of Object.entries(CONFIG_DEFAULTS)) {
      const m = src.config.match(new RegExp(`${env}\\s*:[^\\n]*?default\\(\\s*(?:'([^']+)'|(\\d+))\\s*\\)`));
      if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: config default not found for ${env}`);
      const actual = m[1] ?? m[2];
      assert.equal(actual, spec.value, `MISMATCH: ${env} default — doc=${spec.value} source=${actual}`);
    }

    // 3. event enum
    const enumMatch = src.delivery.match(/export type WebhookEventType =([^;]+);/);
    if (!enumMatch) assert.fail('WEBHOOK-NORMATIVE/PARSE: WebhookEventType not found');
    const sourceEvents = [...enumMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const ev of DOC_EVENTS) {
      assert.ok(sourceEvents.includes(ev), `MISMATCH: documented event not in WebhookEventType: ${ev}`);
    }

    // 4. ping attempts and backoff offsets (immediate, +5s, +5m)
    const attempts = src.delivery.match(/export const MAX_PING_ATTEMPTS = (\d+);/);
    if (!attempts) assert.fail('WEBHOOK-NORMATIVE/PARSE: MAX_PING_ATTEMPTS not found');
    assert.equal(attempts[1], '3', `MISMATCH: MAX_PING_ATTEMPTS — doc=3 source=${attempts[1]}`);
    const offsets = src.delivery.match(/export const RETRY_SCHEDULE_OFFSETS_SEC = \[([\s\S]*?)\]/);
    if (!offsets) assert.fail('WEBHOOK-NORMATIVE/PARSE: RETRY_SCHEDULE_OFFSETS_SEC not found');
    const nums = [...offsets[1].matchAll(/(\d+)\s*,/g)].map((m) => m[1]);
    assert.deepEqual(
      nums.slice(0, 3),
      ['0', '5', '300'],
      `MISMATCH: ping offsets — doc=[0,5,300] source=[${nums.slice(0, 3).join(',')}]`,
    );

    // 5. the scope-policy table must still define no webhook operation (premise depends on it)
    const policies = src.scopePolicy.match(/export const OPERATION_POLICIES[^=]*= \[([\s\S]*?)\];/);
    if (!policies) assert.fail('WEBHOOK-NORMATIVE/PARSE: OPERATION_POLICIES not found');
    assert.ok(
      !/webhooks/i.test(policies[1]),
      'MISMATCH: OPERATION_POLICIES now contains a webhook entry — the section premise is stale',
    );

    // 6. report-only: source error literals the section does not document
    //    (direction rule: doc-claims-absent-in-source = hard fail; source-lacks-in-doc = report)
    const sourceLiterals = new Set([...allSource.matchAll(/[{,]\s*error:\s*'([^'\n]+)'/g)].map((m) => m[1]));
    const documented = new Set(DOC_LITERALS);
    const undocumented = [...sourceLiterals].filter((l) => !documented.has(l)).sort();
    if (undocumented.length > 0) {
      console.log(`# report-only: ${undocumented.length} source error literals not documented in the section:`);
      for (const l of undocumented) console.log(`#   ${l}`);
    }
  });
}
