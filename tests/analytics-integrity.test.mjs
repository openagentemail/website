// 同源统计脚本验收：文件名哈希、12 个调用点、构建后的 HTML。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHA = '1ad1145d19d4558c20f5469ca4a5fc50a1a46f860858c9c91bfcd56fd29a522a';
const SRC = `/vendor/umami-${SHA}.js`;
const ID = '86e6eaf7-473c-4c8d-a9bf-ea48c13742c5';
const HOST = 'https://stats.openagent.email';
const REMOTE = `${HOST}/script.js`;
const SOURCES = [
  'src/pages/index.astro',
  'src/layouts/IndexPage.astro',
  'src/layouts/AgentmailPage.astro',
  'src/layouts/ComparePage.astro',
  'src/layouts/ContactPage.astro',
  'src/layouts/Legal.astro',
  'src/layouts/McpPage.astro',
  'src/layouts/PricingPage.astro',
  'src/layouts/PrivacyPolicyPage.astro',
  'src/layouts/RefundPolicyPage.astro',
  'src/layouts/TermsOfServicePage.astro',
  'astro.config.mjs',
];
const PAGES = [
  'dist/index.html',
  'dist/docs/quickstart/index.html',
  'dist/privacy-policy/index.html',
  'dist/terms-of-service/index.html',
  'dist/pricing/index.html',
  'dist/compare/index.html',
  'dist/contact/index.html',
  'dist/zh/index.html',
];

const asset = await readFile(join(root, 'public', SRC.slice(1)));
assert.equal(asset.length, 4655, 'asset byte length');
assert.equal(createHash('sha256').update(asset).digest('hex'), SHA, 'asset sha256 must match filename');
const notice = await readFile(join(root, 'public/vendor/UMAMI-TRACKER.txt'), 'utf8');
assert.match(notice, /MIT License/);
assert.match(notice, /Copyright \(c\) 2022 Umami Software, Inc\. <hello@umami\.is>/);
assert.ok(notice.includes(SHA) && notice.includes('umami 3.2.0') && notice.includes(REMOTE));

for (const rel of SOURCES) {
  const text = await readFile(join(root, rel), 'utf8');
  assert.equal(text.includes(REMOTE), false, `remote script.js src must be absent: ${rel}`);
  const hostOk = text.includes(`data-host-url="${HOST}"`) || text.includes(`'data-host-url': '${HOST}'`);
  assert.equal(hostOk, true, `data-host-url must be ${HOST}: ${rel}`);
  assert.ok(text.includes(SRC) && text.includes(ID) && text.includes('defer'), rel);
}

if (process.argv.includes('--check-rendered')) {
  const walk = async (dir) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, ent.name);
      if (ent.isDirectory()) await walk(path);
      else if (ent.name.endsWith('.html')) await checkHtml(path);
    }
  };
  const checkHtml = async (path) => {
    const html = await readFile(path, 'utf8');
    const tags = html.match(/<script\b[^>]*>/gi) ?? [];
    for (const tag of tags) {
      assert.equal(/src\s*=\s*['"]https?:\/\/[^'"]*\/script\.js['"]/.test(tag), false, `remote script.js src must be absent: ${path}`);
    }
    for (const tag of tags.filter((tag) => tag.includes('data-website-id'))) {
      assert.ok(tag.includes(SRC), path);
      assert.ok(tag.includes(`data-host-url="${HOST}"`), `data-host-url must be ${HOST}: ${path}`);
      assert.ok(tag.includes(ID) && /\bdefer\b/.test(tag), path);
    }
  };
  await walk(join(root, 'dist'));
  for (const page of PAGES) {
    const html = await readFile(join(root, page), 'utf8');
    const n = (html.match(/<script\b[^>]*>/gi) ?? []).filter((tag) => tag.includes('data-website-id')).length;
    assert.equal(n, 1, page);
  }
}
