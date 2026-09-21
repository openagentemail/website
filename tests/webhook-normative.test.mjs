// Normative machine-check for the webhook reference section (B3 slice:
// signature verification + machine-check hardening).
//
// Modes (direct node run — same convention as tests/mcp-tools.test.mjs; note that
// `node --test <file> --flag` does NOT forward the flag to the child process):
//   node tests/webhook-normative.test.mjs                 # doc-side goldens (no source needed)
//   node tests/webhook-normative.test.mjs --check-source  # cross-check the doc against the implementation
//
// Source pin:
//   Pinned to commit fd4135935c5308e6af4b6a531f529db4b39149e0 (immutable SHA; product main at the
//   #280 redeliver-404 merge; supersedes the v0.8.0 = eab80f92 pin on webhook source files).
//   Upgrade procedure: update SOURCE_REF constant -> run both test modes -> update comments with PR.
//
// Source resolution for --check-source: OAE_SRC (path to a checkout of the product
// repo whose working files are the revision under check) → otherwise fetch from
// raw.githubusercontent.com/openagentemail/openagentemail/${SOURCE_REF}/.
//
// Fail-loud classes: NETWORK (cannot fetch), PARSE (source layout changed),
// MISMATCH (doc and implementation disagree) — "cannot verify" never counts as pass.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_URL = new URL('../src/content/docs/docs/reference/api.md', import.meta.url);
const isSourceMode = process.argv.includes('--check-source');

const SOURCE_REF = process.env.OAE_REF ?? 'fd4135935c5308e6af4b6a531f529db4b39149e0';
const REMOTE_BASE = `https://raw.githubusercontent.com/openagentemail/openagentemail/${SOURCE_REF}/`;
const SOURCE_FILES = {
  app: 'packages/api/src/app.ts',
  scopePolicy: 'packages/api/src/lib/scope-policy.ts',
  config: 'packages/api/src/lib/config.ts',
  webhookRoutes: 'packages/api/src/routes/webhooks.ts',
  delivery: 'packages/api/src/lib/webhook-delivery.ts',
  store: 'packages/api/src/lib/webhook-store.ts',
  sink: 'packages/api/src/lib/webhook-sink.ts',
  signing: 'packages/api/src/lib/webhook-signing.ts',
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
  'task_not_found',
  'missing_task_id',
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

const DOC_EVENTS = ['mail.received', 'approval.requested', 'webhook.ping'];
const PING_ATTEMPTS_DOC = '`MAX_PING_ATTEMPTS` attempts (default 3, scheduled at base offsets: immediate, +5s, +5m). Retry times are jittered by up to ±10% of the gap between consecutive offsets, and a valid `Retry-After` on a `429` response can delay the next attempt further.';

// B2 delivery-semantics goldens (six subsections of `## Webhook delivery semantics`).
const SEMANTICS_HEADINGS = [
  '### Outbound envelope',
  '### Event types',
  '### Retry schedule and backoff',
  '### Circuit breaker and automatic disablement',
  '### SSRF protection and network constraints',
  '### Bounded payloads and timeouts',
];

const SEMANTICS_GOLDENS = [
  '| `id` | string |',
  '| `type` | string |',
  '| `payloadVersion` | string |',
  '| `createdAt` | string |',
  '| `domain` | string |',
  '`from` (`{ address }`, or `{ address, name }` when the sender display name is present)',
  '`uidValidity` (nullable)',
  '`expiresInSec` (nullable)',
  'are included when present',
  'Attempt 1: Immediate (`0s`)',
  'Attempt 2: `+5s`',
  'Attempt 3: `+5m` (`300s`)',
  'Attempt 4: `+30m` (`1,800s`)',
  'Attempt 5: `+2h` (`7,200s`)',
  'Attempt 6: `+5h` (`18,000s`)',
  'Attempt 7: `+10h` (`36,000s`)',
  'Attempt 8: `+20h` (`72,000s`)',
  'Attempt 9: `+34h` (`122,400s`)',
  'Attempt 10: `+48h` (`172,800s`)',
  'Attempt 11: `+72h` (`259,200s`, pinned at the horizon boundary; normally not delivered — see the retry-horizon note above)',
  '`webhook.ping` deliveries are capped at `MAX_PING_ATTEMPTS` attempts (default `3`: immediate, +5s, +5m)',
  '`WEBHOOK_DISABLE_THRESHOLD` (default **10**)',
  '`WEBHOOK_PAYLOAD_MAX_BYTES` (default **16,384 bytes** / 16 KiB)',
  '`WEBHOOK_APPROVAL_ARGS_MAX_BYTES` (default **4,096 bytes**)',
  '`WEBHOOK_APPROVAL_ARGS_MAX_DEPTH` (default **4**)',
  '`WEBHOOK_RESPONSE_MAX_BYTES` (default **4,096 bytes**)',
  '`WEBHOOK_DELIVERY_TIMEOUT_MS` (default **10,000 ms** / 10 seconds)',
  '`WEBHOOK_MAX_CONCURRENT` (default 8)',
  'Immediate disablement on `refused` attempts',
  '(`ssrf_refused`)',
  'does not increment the counter, regardless of subscription state',
  'one in-flight attempt per subscription',
];

const SEMANTICS_ENV_DEFAULTS = {
  WEBHOOK_MAX_ATTEMPTS: '11',
  WEBHOOK_DISABLE_THRESHOLD: '10',
  WEBHOOK_PAYLOAD_MAX_BYTES: '16384',
  WEBHOOK_APPROVAL_ARGS_MAX_BYTES: '4096',
  WEBHOOK_APPROVAL_ARGS_MAX_DEPTH: '4',
  WEBHOOK_RESPONSE_MAX_BYTES: '4096',
  WEBHOOK_DELIVERY_TIMEOUT_MS: '10000',
  WEBHOOK_MAX_CONCURRENT: '8',
  WEBHOOK_TIMESTAMP_TOLERANCE_SEC: '300',
};

const RETRY_OFFSETS_FULL = ['0', '5', '300', '1800', '7200', '18000', '36000', '72000', '122400', '172800', '259200'];

const SIGNATURE_GOLDENS = [
  'X-OAE-Signature: t=<unix-timestamp>,v1=<signature-hex>[,v1=<additional-signature-hex>[,v1=<additional-signature-hex>]]',
  '`t`: Integer Unix timestamp in seconds (`Math.floor(Date.now() / 1000)`)',
  '`v1`: Lower-case hexadecimal HMAC-SHA256 signature',
  '`WEBHOOK_TIMESTAMP_TOLERANCE_SEC` (default **300 seconds** / 5 minutes)',
  'signedPayload = `${t}.${rawRequestBody}`',
  'The signing key is the exact 68-character ASCII string of the displayed secret (`whs_<64-hex>`)',
  'constant-time comparison',
  'reject the request as expired (`timestamp_out_of_range`)',
];

function signatureSectionOf(doc) {
  const start = doc.indexOf('\n## Webhook signature verification\n');
  assert.ok(start >= 0, 'api.md must contain the `## Webhook signature verification` section');
  const end = doc.indexOf('\n## Webhook delivery semantics', start);
  assert.ok(end > start, 'the signature section must precede `## Webhook delivery semantics`');
  return doc.slice(start, end);
}

function assertSignatureGoldens(sig) {
  for (const g of SIGNATURE_GOLDENS) {
    assert.ok(sig.includes(g), `signature golden missing: ${g}`);
  }
}

function semanticsSectionOf(doc) {
  const start = doc.indexOf('\n## Webhook delivery semantics\n');
  assert.ok(start >= 0, 'api.md must contain the `## Webhook delivery semantics` section');
  const end = doc.indexOf('\n## Status codes', start);
  assert.ok(end > start, 'the delivery-semantics section must precede `## Status codes`');
  return doc.slice(start, end);
}

function assertSemanticsGoldens(sem) {
  for (const h of SEMANTICS_HEADINGS) {
    assert.ok(sem.includes(h), `delivery-semantics heading missing: ${h}`);
  }
  for (const g of SEMANTICS_GOLDENS) {
    assert.ok(sem.includes(g), `delivery-semantics golden missing: ${g}`);
  }
}

function sectionOf(doc) {
  const start = doc.indexOf('\n## Webhooks\n');
  assert.ok(start >= 0, 'api.md must contain the `## Webhooks` section');
  const end = doc.indexOf('\n## Webhook signature verification', start);
  assert.ok(end > start, 'the endpoint sections must precede `## Webhook signature verification`');
  return doc.slice(start, end);
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
    const doc = await readFile(API_URL, 'utf8');
    const sec = sectionOf(doc);
    assertDocLiterals(sec);
    assertDocFragments(sec);
    assertSemanticsGoldens(semanticsSectionOf(doc));
    assertSignatureGoldens(signatureSectionOf(doc));
  });
} else {
  test('webhook section normative claims match the implementation (--check-source)', async () => {
    const [doc, src] = await Promise.all([
      readFile(API_URL, 'utf8'),
      loadSources(),
    ]);
    const sec = sectionOf(doc);
    const allSource = Object.values(src).join('\n');

    // 1. doc-side goldens first (same as default mode), then doc → source byte check
    assertDocLiterals(sec);
    assertDocFragments(sec);
    assertSemanticsGoldens(semanticsSectionOf(doc));
    assertSignatureGoldens(signatureSectionOf(doc));
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
    const offsetsBody = offsets[1].replace(/\/\/[^\n]*/g, '');
    const nums = [...offsetsBody.matchAll(/(\d+)/g)].map((m) => m[1]);
    assert.deepEqual(
      nums.slice(0, 3),
      ['0', '5', '300'],
      `MISMATCH: ping offsets — doc=[0,5,300] source=[${nums.slice(0, 3).join(',')}]`,
    );

    // 5. the scope-policy table must still define no webhook operation (premise depends on it)
    const policies = src.scopePolicy.match(/export const OPERATION_POLICIES[^=]*= \[([\s\S]*?)\];/);
    if (!policies) assert.fail('WEBHOOK-NORMATIVE/PARSE: OPERATION_POLICIES not found');
    const matcherBodies = [...policies[1].matchAll(/matches:\s*\([^)]*\)\s*=>\s*([^\n]+)/g)].map((m) => m[1]);
    const policyIds = [...policies[1].matchAll(/\bid:/g)].length;
    if (matcherBodies.length === 0) assert.fail('WEBHOOK-NORMATIVE/PARSE: no matcher bodies found in OPERATION_POLICIES');
    assert.equal(matcherBodies.length, policyIds, 'WEBHOOK-NORMATIVE/PARSE: some OPERATION_POLICIES entries have an unparsed matcher form');
    // Text-level gate: a matcher that targets /v1/webhooks without naming it cannot be detected here.
    for (const body of matcherBodies) {
      assert.ok(!/webhook/i.test(body), `MISMATCH: OPERATION_POLICIES matcher references webhooks: ${body.trim()}`);
      for (const lit of [...body.matchAll(/'([^']*)'/g)].map((m) => m[1])) {
        assert.ok(!lit.startsWith('/v1/webhooks'), `MISMATCH: OPERATION_POLICIES matcher path ${lit} — the section premise is stale`);
      }
    }

    // 6. delivery-semantics env defaults ↔ config schema (B2)
    for (const [env, value] of Object.entries(SEMANTICS_ENV_DEFAULTS)) {
      const m = src.config.match(new RegExp(`${env}\\s*:[^\\n]*?default\\(\\s*(?:'([^']+)'|(\\d+))\\s*\\)`));
      if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: config default not found for ${env}`);
      const actual = m[1] ?? m[2];
      assert.equal(actual, value, `MISMATCH: ${env} default — doc=${value} source=${actual}`);
    }

    // 7. full retry ladder + horizon + attempt cap (B2)
    assert.deepEqual(
      nums.slice(0, 11),
      RETRY_OFFSETS_FULL,
      `MISMATCH: retry ladder — doc=[${RETRY_OFFSETS_FULL.join(',')}] source=[${nums.slice(0, 11).join(',')}]`,
    );
    const maxAttemptsAll = src.delivery.match(/export const MAX_RETRY_SCHEDULE_ATTEMPTS = (\d+);/);
    if (!maxAttemptsAll) assert.fail('WEBHOOK-NORMATIVE/PARSE: MAX_RETRY_SCHEDULE_ATTEMPTS not found');
    assert.equal(maxAttemptsAll[1], '11', `MISMATCH: MAX_RETRY_SCHEDULE_ATTEMPTS — doc=11 source=${maxAttemptsAll[1]}`);
    const horizon = src.delivery.match(/export const RETRY_HORIZON_SEC = (\d+);/);
    if (!horizon) assert.fail('WEBHOOK-NORMATIVE/PARSE: RETRY_HORIZON_SEC not found');
    assert.equal(horizon[1], '259200', `MISMATCH: RETRY_HORIZON_SEC — doc=259200 source=${horizon[1]}`);

    // 8. envelope base fields + ping payload keys + refused reason (B2)
    const envelope = src.delivery.match(/export type WebhookEnvelopeBase = \{([\s\S]*?)\};/);
    if (!envelope) assert.fail('WEBHOOK-NORMATIVE/PARSE: WebhookEnvelopeBase not found');
    for (const f of ['id', 'type', 'payloadVersion', 'createdAt', 'domain']) {
      assert.ok(new RegExp(`\\b${f}\\s*:`).test(envelope[1]), `MISMATCH: WebhookEnvelopeBase field missing: ${f}`);
    }
    const pingFn = src.delivery.match(/export function formatPingPayload\([\s\S]*?\n\}/);
    if (!pingFn) assert.fail('WEBHOOK-NORMATIVE/PARSE: formatPingPayload not found');
    for (const k of ["object: 'webhook'", 'webhookId', 'trigger']) {
      assert.ok(pingFn[0].includes(k), `MISMATCH: formatPingPayload missing ${k}`);
    }
    assert.ok(src.delivery.includes("reason: 'ssrf_refused'"), 'MISMATCH: ssrf_refused reason literal not in delivery source');

    // 9. rate limiter bucket mapping (§6-9)
    const limiterChecks = {
      checkCreateRate: 'rateCreatePerMin',
      checkReadRate: 'rateCreatePerMin',
      checkRotateRate: 'rateTestPerMin',
      checkTestProbeRate: 'rateTestPerMin',
    };
    for (const [fn, key] of Object.entries(limiterChecks)) {
      const m = src.delivery.match(new RegExp(`${fn}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
      if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: ${fn} not found`);
      assert.ok(m[0].includes(`config.webhooks.${key}`), `MISMATCH: ${fn} does not use config.webhooks.${key}`);
    }

    // 10. signature verification implementation assertions (scoped to function bodies)
    const signingFn = (name) => {
      const m = src.signing.match(new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`));
      if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: ${name} body not found in webhook-signing`);
      return m[0];
    };
    const deriveFn = signingFn('deriveWebhookKey');
    const buildFn = signingFn('buildWebhookSignatureHeader');
    const verifyFn = signingFn('verifyWebhookSignature');
    assert.ok(deriveFn.includes("Buffer.from(displayedSecret, 'utf8')"), 'MISMATCH: displayed-secret key derivation missing in deriveWebhookKey');
    assert.ok(buildFn.includes('Math.floor(nowMs / 1000)'), 'MISMATCH: nowMs timestamp rounding missing in buildWebhookSignatureHeader');
    assert.ok(buildFn.includes("createHmac('sha256'"), 'MISMATCH: HMAC-SHA256 algorithm missing in buildWebhookSignatureHeader');
    assert.ok(buildFn.includes('${t}.${rawBodyStr}'), 'MISMATCH: signed-payload construction missing in buildWebhookSignatureHeader');
    assert.ok(buildFn.includes('v1=${s}'), 'MISMATCH: v1 signature formatting missing in buildWebhookSignatureHeader');
    assert.ok(verifyFn.includes("createHmac('sha256'"), 'MISMATCH: HMAC-SHA256 algorithm missing in verifyWebhookSignature');
    assert.ok(verifyFn.includes('${t}.${rawBodyStr}'), 'MISMATCH: signed-payload construction missing in verifyWebhookSignature');
    assert.ok(verifyFn.includes('timingSafeEqual'), 'MISMATCH: timingSafeEqual constant-time check missing in verifyWebhookSignature');

    // 11. dispatch-filter assertions (D3 statements)
    const sinkMethod = (name) => {
      const m = src.sink.match(new RegExp(`async ${name}\\([\\s\\S]*?\\n    \\}`));
      if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: ${name} body not found in webhook-sink`);
      return m[0];
    };
    const handleMailFn = sinkMethod('handleMail');
    const handleApprovalFn = sinkMethod('handleApproval');
    assert.ok(
      /s\.state !== 'disabled' && s\.events\.includes\('mail\.received'\)/.test(handleMailFn),
      'MISMATCH: mail.received dispatch filter (state + events) not found in handleMail',
    );
    assert.ok(
      /sub\.state !== 'disabled'\s*&&\s*sub\.events\.includes\('approval\.requested'\)/.test(handleApprovalFn),
      'MISMATCH: approval.requested dispatch filter (state + events) not found in handleApproval',
    );
    assert.ok(
      /sub\.address === reviewer/.test(handleApprovalFn),
      'MISMATCH: approval reviewer-targeting predicate not found in handleApproval',
    );
    assert.ok(
      /s\.state === 'unverified'[\s\S]{0,60}?s\.state = 'enabled'/.test(src.delivery),
      'MISMATCH: unverified -> enabled transition missing in delivery success handling',
    );
    const creationPingFn = src.delivery.match(/export function fireCreationPing\([\s\S]*?\n\}/);
    if (!creationPingFn) assert.fail('WEBHOOK-NORMATIVE/PARSE: fireCreationPing not found');
    assert.ok(!creationPingFn[0].includes('events.includes'), 'MISMATCH: fireCreationPing now filters by events — the ping exception claim is stale');

    // 12. report-only: source error literals the section does not document
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
