// Normative machine-check for the webhook reference section (B3 slice:
// signature verification + machine-check hardening).
//
// Modes (direct node run — same convention as tests/mcp-tools.test.mjs; note that
// `node --test <file> --flag` does NOT forward the flag to the child process):
//   node tests/webhook-normative.test.mjs                 # doc-side goldens (no source needed)
//   node tests/webhook-normative.test.mjs --check-source  # cross-check the doc against the implementation
//
// 源钉（不可用 app 工作树 HEAD 代替）：
//   e6bf507e79eb0811c2d67161edf6e1638be17b5b
//   自 fd4135935c5308e6af4b6a531f529db4b39149e0 升钉。升钉前已对过路由/校验/投递差异，
//   不是只换 SHA：URL 拒绝 details 白名单、72h 用排期时刻判界、启动重建的 firstAttemptAt、
//   mail 载荷 autoSubmitted。可导出字面量在 --check-source 里从源码抽出，再与文档列表对账。
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

const SOURCE_REF = process.env.OAE_REF ?? 'e6bf507e79eb0811c2d67161edf6e1638be17b5b';
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
  autoSubmitted: 'packages/api/src/lib/auto-submitted.ts',
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
  'Attempt 11: `+72h` (`259,200s`, pinned at the horizon boundary; a time exactly on that boundary is not rejected by the first horizon check)',
  'A scheduled time exactly on the 72-hour boundary, including attempt 11, is not rejected by the first horizon check, even if the worker wakes later. Passing that check does not promise an HTTP delivery. A disabled subscription, the concurrency limit, or the delivery rate limit can still block the request.',
  'A manual redelivery starts a new delivery run. Its 72-hour clock starts when that replay is accepted, and the event `id` stays the same.',
  'A pending delivery restored after a restart keeps the run\'s first-attempt time from the earliest attempt-1 log row, not the event `createdAt`.',
  'An overdue stored schedule that is queued keeps its stored time and waits zero time, so it becomes eligible immediately.',
  'Becoming eligible does not promise an HTTP delivery.',
  'including a disabled subscription and the concurrency limit.',
  'deduplicate deliveries idempotently by this `id`',
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
  'exact raw wire body bytes must be used',
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

// 从文档小标题下抽出 `- \`reason\`` 列表。原因名不在本文件手写第二份表。
function reasonBulletsUnder(sec, heading) {
  const idx = sec.indexOf(heading);
  assert.ok(idx >= 0, `URL rejection heading missing: ${heading}`);
  const rest = sec.slice(idx + heading.length);
  const next = rest.search(/\n#{2,4} /);
  const block = next < 0 ? rest : rest.slice(0, next);
  const reasons = [...block.matchAll(/^- `([a-z0-9_]+)`$/gm)].map((m) => m[1]);
  assert.ok(reasons.length > 0, `no reason bullets under ${heading}`);
  return reasons;
}

function urlRejectionLists(sec) {
  return {
    details: reasonBulletsUnder(sec, '#### `invalid_webhook_url` with `details`'),
    logInvalid: reasonBulletsUnder(sec, '#### `invalid_webhook_url` without `details`'),
    logForbidden: reasonBulletsUnder(sec, '#### `webhook_target_forbidden` without `details`'),
  };
}

// 十二个内部原因不得写成响应 error。details 只是白名单原因字符串。
function webhookContractOf(doc) {
  const start = doc.indexOf('\n## Webhooks\n');
  assert.ok(start >= 0, 'api.md must contain the Webhooks section');
  const end = doc.indexOf('\n## Status codes', start);
  assert.ok(end > start, 'webhook contract must precede Status codes');
  return doc.slice(start, end);
}

function assertUrlRejectionShape(contract) {
  const lists = urlRejectionLists(contract);
  const all = [...lists.details, ...lists.logInvalid, ...lists.logForbidden];
  assert.equal(new Set(all).size, all.length, 'internal causes must be unique');
  assert.ok(
    contract.includes('They are not `error` values.'),
    'the section must say internal causes are not error values',
  );
  assert.ok(
    contract.includes('An identity token whose destination resolves to a private address also receives `400 {"error":"webhook_target_forbidden"}` with no `details`.'),
    'admin-key private-target response must stay details-free',
  );
  assert.ok(
    contract.includes('`WEBHOOK_ALLOW_PRIVATE_TARGETS=true` **and** `OAE_PUBLIC_EDGE=false`'),
    'private targets require both server flags',
  );
  assert.ok(
    contract.includes('must be created or updated with an **admin key**'),
    'private targets require an admin key',
  );
  assert.ok(
    contract.includes('requires **every** resolved IP address of the target hostname to be private or loopback'),
    'http targets require every resolved address to be private',
  );
  for (const reason of all) {
    assert.ok(
      !contract.includes(`{"error":"${reason}"}`),
      `internal cause must not appear as an error value: ${reason}`,
    );
  }
  assert.ok(contract.includes('`autoSubmitted` is always present'), 'mail.received must document autoSubmitted');
  assert.ok(
    !contract.includes('normally not delivered'),
    'a boundary schedule is not described as normally not delivered',
  );
  assert.ok(
    !contract.includes('still sent'),
    'a boundary schedule must not be described as still sent',
  );
  assert.ok(
    !contract.includes("original event's generation time"),
    'restarted pending deliveries do not use event generation time as the horizon clock',
  );
  assert.ok(
    !contract.includes('malformed URL syntax'),
    'malformed destinations are not schema invalid_request',
  );
  assert.ok(
    !contract.includes('An overdue stored schedule is sent immediately'),
    'an overdue restored schedule is eligible, not a guaranteed HTTP send',
  );
  return lists;
}

// 去掉行注释后再取函数体，避免注释里的禁词被当成实现。
function functionBody(source, name) {
  const m = source.match(new RegExp(`export (?:async )?function ${name}\\([\\s\\S]*?\\n\\}`));
  if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: ${name} body not found`);
  return m[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function assertUrlRejectionMatchesSource(contract, deliverySrc, routesSrc) {
  const lists = assertUrlRejectionShape(contract);
  const whitelist = deliverySrc.match(/export const WEBHOOK_URL_REJECT_DETAILS_WHITELIST = \[([\s\S]*?)\] as const;/);
  if (!whitelist) assert.fail('WEBHOOK-NORMATIVE/PARSE: WEBHOOK_URL_REJECT_DETAILS_WHITELIST not found');
  const sourceDetails = [...whitelist[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(lists.details, sourceDetails, 'details list drifted from WEBHOOK_URL_REJECT_DETAILS_WHITELIST');

  const staticBody = functionBody(deliverySrc, 'validateWebhookUrlStatic');
  const resolutionBody = functionBody(deliverySrc, 'validateWebhookUrlResolution');
  const paired = [...`${staticBody}\n${resolutionBody}`.matchAll(/code:\s*'(invalid_webhook_url|webhook_target_forbidden)'\s*,\s*error:\s*'([^']+)'/g)]
    .map((m) => ({ code: m[1], reason: m[2] }));
  if (paired.length === 0) assert.fail('WEBHOOK-NORMATIVE/PARSE: URL rejection returns not found');
  const byCode = { invalid_webhook_url: [], webhook_target_forbidden: [] };
  const seen = new Set();
  for (const row of paired) {
    if (seen.has(row.reason)) continue;
    seen.add(row.reason);
    byCode[row.code].push(row.reason);
  }
  assert.equal(seen.size, 12, `MISMATCH: expected 12 URL rejection reasons, source has ${seen.size}`);
  const logInvalid = byCode.invalid_webhook_url.filter((reason) => !sourceDetails.includes(reason));
  const logForbidden = byCode.webhook_target_forbidden.filter((reason) => !sourceDetails.includes(reason));
  assert.deepEqual(lists.logInvalid, logInvalid, 'log-only invalid_webhook_url list drifted from source');
  assert.deepEqual(lists.logForbidden, logForbidden, 'log-only webhook_target_forbidden list drifted from source');
  for (const reason of sourceDetails) {
    assert.equal(byCode.invalid_webhook_url.includes(reason), true, `details reason is not an invalid_webhook_url cause: ${reason}`);
  }
  // create/update 都走拒绝响应 helper；白名单原因才带 details 字符串。
  const rejectionBody = functionBody(deliverySrc, 'webhookUrlRejectionResponseBody');
  assert.ok(
    rejectionBody.includes('if (isWebhookUrlRejectDetailsWhitelisted(reason))') && rejectionBody.includes('return { error, details: reason };'),
    'whitelisted URL reasons are copied into details',
  );
  assert.ok(rejectionBody.includes('return { error };'), 'a reason outside the whitelist omits details');
  assert.equal(
    (routesSrc.match(/webhookUrlRejectionResponseBody\(resolution\.code, resolution\.error\)/g) || []).length,
    2,
    'create and update both return the URL rejection helper',
  );
}

function assertAutoSubmittedMatchesSource(doc, autoSrc, deliverySrc) {
  const typeMatch = autoSrc.match(/export type AutoSubmitted = ([^;]+);/);
  if (!typeMatch) assert.fail('WEBHOOK-NORMATIVE/PARSE: AutoSubmitted type not found');
  assert.ok(typeMatch[1].includes('null'), 'AutoSubmitted must include null');
  const members = [...typeMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const mailItem = doc.slice(doc.indexOf('1. `mail.received`'), doc.indexOf('2. `approval.requested`'));
  const oneOf = mailItem.match(/otherwise one of ([^.]+)\./);
  if (!oneOf) assert.fail('WEBHOOK-NORMATIVE/PARSE: autoSubmitted value list missing from mail.received');
  const documented = [...oneOf[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(documented, members, 'mail.received autoSubmitted values drifted from AutoSubmitted');
  assert.ok(mailItem.includes('It is `null`'), 'autoSubmitted null must be documented on mail.received');
  const formatBody = functionBody(deliverySrc, 'formatMailPayload');
  assert.ok(formatBody.includes('autoSubmitted: input.autoSubmitted ?? null'), 'formatMailPayload must always emit autoSubmitted');
  assert.ok(!formatBody.includes('delete data.autoSubmitted'), 'size shedding must not drop autoSubmitted');
}

// 类方法体：缩进 2 格的结尾括号。过期排期的零延迟在 schedule()，不在重启分支里直接发 HTTP。
function methodBody(source, name) {
  // 签名与左花括号必须在同一行，避免把 schedule() 调用当成方法体。
  const m = source.match(new RegExp(`\\n  (?:private )?(?:async )?${name}\\([^\\n]*\\)[^\\n]*\\{[\\s\\S]*?\\n  \\}`));
  if (!m) assert.fail(`WEBHOOK-NORMATIVE/PARSE: method ${name} not found`);
  return m[0];
}

function assertHorizonMatchesSource(deliverySrc) {
  const horizon = functionBody(deliverySrc, 'isScheduledAttemptBeyondRetryHorizon');
  assert.ok(
    horizon.includes('return nextAttemptAt > firstAttemptAt + RETRY_HORIZON_SEC * 1000'),
    'horizon must compare the scheduled time, strictly after the boundary',
  );
  const derived = functionBody(deliverySrc, 'deriveFirstAttemptAtMsFromGroup');
  assert.ok(derived.includes('row.attempt !== 1'), 'restart first-attempt time must come from attempt 1');
  assert.ok(!derived.includes('eventCreatedAt'), 'restart first-attempt time must not read eventCreatedAt');
  assert.ok(deliverySrc.includes('firstAttemptAt: now'), 'a new run, including manual replay, starts its clock at acceptance');

  const schedule = methodBody(deliverySrc, 'schedule');
  assert.ok(
    schedule.includes('const delay = Math.max(0, job.nextAttemptAt - now)'),
    'queue delay is zero when the stored schedule is already due',
  );
  assert.ok(schedule.includes('void this.executeJob(key)'), 'zero delay only starts executeJob');
  assert.ok(
    deliverySrc.includes('nextAttemptAt: persistedScheduleMs'),
    'a restored schedule keeps the stored time instead of being clamped to boot',
  );

  const run = methodBody(deliverySrc, 'runExecuteJob');
  const disabledAt = run.indexOf("sub.state === 'disabled'");
  const slotAt = run.indexOf('deliveryLimiter.acquireSlot(job.webhookId)');
  const payloadAt = run.indexOf('job.payloadBuilder(sub)');
  assert.ok(disabledAt >= 0 && slotAt > disabledAt && payloadAt > slotAt, 'disabled and concurrency checks run before the payload is built');
  assert.ok(!run.slice(0, payloadAt).includes('pinnedFetch'), 'HTTP is not reached before the pre-send checks');
  // 第一次判界必须吃存储的 nextAttemptAt。过界的并发或限速改期在发 HTTP 前结束。
  const horizonCall = run.indexOf('isScheduledAttemptBeyondRetryHorizon(job.nextAttemptAt, job.firstAttemptAt)');
  const rateAt = run.indexOf('deliveryLimiter.checkDeliverRate(job.webhookId, now)');
  const slotStop = run.indexOf("reason: 'retry_horizon_exceeded'", slotAt);
  const rateStop = run.indexOf("reason: 'retry_horizon_exceeded'", rateAt);
  assert.ok(
    horizonCall >= 0 && horizonCall < slotAt && slotStop > slotAt && rateAt > slotStop && rateStop > rateAt && payloadAt > rateStop,
    'first horizon check uses the stored schedule; later concurrency and rate deferrals can still stop HTTP',
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
    assertUrlRejectionShape(webhookContractOf(doc));
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
    const contract = webhookContractOf(doc);
    assertUrlRejectionMatchesSource(contract, src.delivery, src.webhookRoutes);
    assertAutoSubmittedMatchesSource(doc, src.autoSubmitted, src.delivery);
    assertHorizonMatchesSource(src.delivery);
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
    // 十二个 URL 内部原因的字段也叫 error，但它们不是响应子码，不能算「未写入错误码表」。
    const internalUrlReasons = new Set(Object.values(urlRejectionLists(contract)).flat());
    const undocumented = [...sourceLiterals].filter((l) => !documented.has(l) && !internalUrlReasons.has(l)).sort();
    if (undocumented.length > 0) {
      console.log(`# report-only: ${undocumented.length} source error literals not documented in the section:`);
      for (const l of undocumented) console.log(`#   ${l}`);
    }
  });
}
