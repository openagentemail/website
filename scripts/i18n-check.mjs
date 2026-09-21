#!/usr/bin/env node
/**
 * scripts/i18n-check.mjs — i18n synchronization and drift gate.
 * Zero third-party dependencies. Can be imported by tests or executed directly via CLI.
 *
 * Hard checks:
 * 1. File parity: 5 dictionary files exist; translationSet deep-equals config.js TRANSLATED_PAGES;
 *    every translated page has a corresponding dynamic route file.
 * 2. Structure parity:
 *    a) en.js key set equals all 4 locale dictionaries (missing/extra keys fail).
 *    b) Heading outline (h1..h6) and <pre> count between src/pages/index.astro and src/layouts/IndexPage.astro match.
 * 3. sourceSha256: Current SHA-256 of source files matches i18n-sync.json (fails with 'en 源已变更，译文需同步').
 * 4. Value validation: All values are non-empty strings, no bare '<', no event attributes,
 *    and HTML tags strictly conform to the repository-scanned whitelist.
 *
 * HTML Whitelist scanning notes:
 * Scanned on canonical src/i18n/en.js:
 * Command: node -e "import('./src/i18n/en.js').then(m => { const counts = {}; for (const v of Object.values(m.texts)) { for (const match of v.matchAll(/<([a-z0-9]+)(\s+[^>]*)?>|<\/([a-z0-9]+)>/gi)) { const t = (match[1]||match[3]).toLowerCase(); counts[t] = (counts[t]||0)+1; } } console.log(counts); })"
 * Counts: { code: 20, em: 2 } (code: 10 open, 10 close; em: 1 open, 1 close)
 * Whitelist: ['code', 'em']
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

export const ALLOWED_HTML_TAGS = Object.freeze(['code', 'em']);
const ALLOWED_TAGS_REGEX = /<\/?(code|em)>/gi;

export async function readJson(relativePath) {
  const fullPath = resolve(ROOT, relativePath);
  const raw = await readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

export function computeSha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function extractTagsOutline(astroSource) {
  const stripped = astroSource.replace(/^---[\s\S]*?---/, '');
  const matches = [...stripped.matchAll(/<(h[1-6]|pre)\b[^>]*>/gi)];
  return matches.map((m) => m[1].toLowerCase());
}

/**
 * Check 1: File set parity
 */
export async function checkFileParity(syncConfig, configModule) {
  const sync = syncConfig ?? (await readJson('i18n-sync.json'));
  const config = configModule ?? (await import('../src/i18n/config.js'));

  // 1.1 Dict files all exist on disk
  for (const [locale, relPath] of Object.entries(sync.dicts)) {
    const absPath = resolve(ROOT, relPath);
    try {
      await access(absPath);
    } catch {
      assert.fail(`FILE_PARITY: Dictionary file for '${locale}' missing at ${relPath}`);
    }
  }

  // 1.2 translationSet deep-equals config.js TRANSLATED_PAGES
  assert.deepEqual(
    [...sync.translationSet].sort(),
    [...config.TRANSLATED_PAGES].sort(),
    'FILE_PARITY: translationSet in i18n-sync.json must match TRANSLATED_PAGES in src/i18n/config.js',
  );

  // 1.3 Each translated page has a corresponding route file
  for (const page of sync.translationSet) {
    const routeRelPath = page === 'index'
      ? 'src/pages/[lang]/index.astro'
      : `src/pages/[lang]/${page}.astro`;
    const routeAbsPath = resolve(ROOT, routeRelPath);
    try {
      await access(routeAbsPath);
    } catch {
      assert.fail(`FILE_PARITY: Route file missing for page '${page}' at ${routeRelPath}`);
    }
  }

  return true;
}

/**
 * Check 2: Structure parity
 */
export async function checkStructureParity(dicts, sourceFiles) {
  let loadedDicts = dicts;
  if (!loadedDicts) {
    const [en, es, ja, ko, zh] = await Promise.all([
      import('../src/i18n/en.js'),
      import('../src/i18n/es.js'),
      import('../src/i18n/ja.js'),
      import('../src/i18n/ko.js'),
      import('../src/i18n/zh.js'),
    ]);
    loadedDicts = {
      en: en.texts,
      es: es.texts,
      ja: ja.texts,
      ko: ko.texts,
      zh: zh.texts,
    };
  }

  const enKeys = Object.keys(loadedDicts.en).sort();

  for (const loc of ['es', 'ja', 'ko', 'zh']) {
    const locKeys = Object.keys(loadedDicts[loc] || {}).sort();
    assert.deepEqual(
      locKeys,
      enKeys,
      `STRUCTURE_PARITY: Key set mismatch between en.js and ${loc}.js`,
    );
  }

  // Check layout vs source index.astro
  let enSrc = sourceFiles?.en;
  let layoutSrc = sourceFiles?.layout;
  if (!enSrc) {
    enSrc = await readFile(resolve(ROOT, 'src/pages/index.astro'), 'utf8');
  }
  if (!layoutSrc) {
    layoutSrc = await readFile(resolve(ROOT, 'src/layouts/IndexPage.astro'), 'utf8');
  }

  const enOutline = extractTagsOutline(enSrc);
  const layoutOutline = extractTagsOutline(layoutSrc);

  assert.deepEqual(
    layoutOutline,
    enOutline,
    'STRUCTURE_PARITY: Heading outline and <pre> count mismatch between index.astro and IndexPage.astro',
  );

  return true;
}

/**
 * Check 3: sourceSha256
 */
export async function checkSourceSha(syncConfig, overrideSources) {
  const sync = syncConfig ?? (await readJson('i18n-sync.json'));
  for (const entry of sync.sources) {
    let content;
    if (overrideSources && overrideSources[entry.file] !== undefined) {
      content = overrideSources[entry.file];
    } else {
      content = await readFile(resolve(ROOT, entry.file), 'utf8');
    }
    const currentSha = computeSha256(content);
    if (currentSha !== entry.sha256) {
      assert.fail(
        `SOURCE_SHA_MISMATCH [${entry.file}]: en 源已变更，译文需同步 (expected ${entry.sha256}, got ${currentSha})`,
      );
    }
  }
  return true;
}

/**
 * Check 4: Value validation
 */
export function validateTextValue(key, val, lang = 'unknown') {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new Error(`[${lang}.${key}] Value must be a non-empty string`);
  }
  if (/on[a-z]+\s*=/i.test(val)) {
    throw new Error(`[${lang}.${key}] Event handler attributes forbidden: ${val}`);
  }
  const stripped = val.replace(ALLOWED_TAGS_REGEX, '');
  if (stripped.includes('<')) {
    throw new Error(
      `[${lang}.${key}] Bare '<' or unapproved tag detected. Allowed tags are <code|em>: ${val}`,
    );
  }
  return true;
}

export async function checkValues(dicts) {
  let loadedDicts = dicts;
  if (!loadedDicts) {
    const [en, es, ja, ko, zh] = await Promise.all([
      import('../src/i18n/en.js'),
      import('../src/i18n/es.js'),
      import('../src/i18n/ja.js'),
      import('../src/i18n/ko.js'),
      import('../src/i18n/zh.js'),
    ]);
    loadedDicts = {
      en: en.texts,
      es: es.texts,
      ja: ja.texts,
      ko: ko.texts,
      zh: zh.texts,
    };
  }

  for (const [lang, dict] of Object.entries(loadedDicts)) {
    for (const [key, val] of Object.entries(dict)) {
      validateTextValue(key, val, lang);
    }
  }
  return true;
}

/**
 * ── Element 1 ~ 5: en-baseline normalization and invariant verification ──
 */

export function extractBody(html) {
  const m = html.match(/<body\b[\s\S]*?<\/body>/i);
  return m ? m[0] : '';
}

export function normalizeHead(html) {
  const headMatch = html.match(/<head\b[\s\S]*?<\/head>/i);
  let head = headMatch ? headMatch[0] : '';
  if (!head) {
    const bodyIdx = html.indexOf('<body');
    head = bodyIdx !== -1 ? html.slice(0, bodyIdx) : '';
  }
  head = head.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  head = head.replace(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi, '');
  return head;
}

export function extractCssRules(html) {
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const allCss = styles.join('\n');
  const rules = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < allCss.length; i++) {
    const char = allCss[i];
    current += char;
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        const trimmed = current.trim();
        if (trimmed) rules.push(trimmed);
        current = '';
      }
    }
  }
  if (current.trim()) rules.push(current.trim());
  return rules;
}

export function extractStylesheetHrefs(html) {
  const matches = [...html.matchAll(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi)];
  const hrefs = [];
  for (const m of matches) {
    const hrefMatch = m[0].match(/\bhref=["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1].split('?')[0].split('#')[0];
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        hrefs.push(href);
      }
    }
  }
  return hrefs;
}

export async function extractStylesheetShas(html, distDir) {
  const hrefs = extractStylesheetHrefs(html);
  const shas = [];
  for (const href of hrefs) {
    const filePath = join(distDir, href.replace(/^\//, ''));
    const content = await readFile(filePath);
    shas.push(computeSha256(content));
  }
  return shas.sort();
}

export async function getEnHtmlFiles(dir) {
  const files = [];
  async function walk(d) {
    for (const ent of await readdir(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      if (ent.isDirectory()) {
        const rel = relative(dir, full);
        if (/^(es|ja|ko|zh)(\/|$)/.test(rel)) continue;
        await walk(full);
      } else if (ent.name.endsWith('.html')) {
        const rel = relative(dir, full);
        if (!/^(es|ja|ko|zh)(\/|$)/.test(rel)) {
          files.push(rel);
        }
      }
    }
  }
  await walk(dir);
  return files.sort();
}

export async function computeEnBaseline(distDir = resolve(ROOT, 'dist')) {
  const relFiles = await getEnHtmlFiles(distDir);
  const entries = [];
  for (const rel of relFiles) {
    const html = await readFile(join(distDir, rel), 'utf8');
    const body = extractBody(html);
    const headNorm = normalizeHead(html);
    const rules = extractCssRules(html).sort();
    const stylesheets = await extractStylesheetShas(html, distDir);

    entries.push({
      page: rel,
      bodySha256: computeSha256(body),
      headNormSha256: computeSha256(headNorm),
      rulesSha256: computeSha256(rules.join('\n')),
      stylesheets,
    });
  }
  return entries;
}

export async function writeEnBaseline(
  outPath = resolve(ROOT, 'i18n-en-baseline.json'),
  distDir = resolve(ROOT, 'dist'),
) {
  const entries = await computeEnBaseline(distDir);
  const json = JSON.stringify(entries, null, 2) + '\n';
  await writeFile(outPath, json, 'utf8');
  return entries;
}

export async function checkEnBaseline(baselineData, distDir = resolve(ROOT, 'dist'), options = {}) {
  const pages = Array.isArray(baselineData) ? baselineData : baselineData.pages;
  assert.ok(Array.isArray(pages) && pages.length > 0, 'Baseline data must contain a non-empty list of pages');

  const expectedMap = new Map(pages.map((p) => [p.page, p]));

  const actualPages = await getEnHtmlFiles(distDir);
  const actualSet = new Set(actualPages);

  const isPartial = Boolean(options.allowPartial || (options.pages && options.pages.length > 0));
  if (!isPartial) {
    for (const expectedPage of expectedMap.keys()) {
      assert.ok(
        actualSet.has(expectedPage),
        `EN_BASELINE: Expected page '${expectedPage}' not found in dist`,
      );
    }
    for (const actualPage of actualSet) {
      assert.ok(
        expectedMap.has(actualPage),
        `EN_BASELINE: Unexpected page '${actualPage}' found in dist`,
      );
    }
  }

  const pagesToCheck = options.pages || (isPartial ? [...actualSet].filter((p) => expectedMap.has(p)) : actualPages);

  for (const pageName of pagesToCheck) {
    const expected = expectedMap.get(pageName);
    if (!expected) continue;

    const pageFilePath = join(distDir, pageName);
    const html = await readFile(pageFilePath, 'utf8');

    // Element 1: <body> byte-for-byte identical (bodySha256)
    const body = extractBody(html);
    const bodySha = computeSha256(body);
    assert.equal(
      bodySha,
      expected.bodySha256,
      `EN_BASELINE [${pageName}]: Element 1 (bodySha256) mismatch`,
    );

    // Element 2: head stripped of <style> and stylesheets byte-for-byte identical (headNormSha256)
    const headNorm = normalizeHead(html);
    const headNormSha = computeSha256(headNorm);
    assert.equal(
      headNormSha,
      expected.headNormSha256,
      `EN_BASELINE [${pageName}]: Element 2 (headNormSha256) mismatch`,
    );

    // Element 3: inline style rules multiset (sorted list) identical (rulesSha256)
    const rules = extractCssRules(html).sort();
    const rulesSha = computeSha256(rules.join('\n'));
    assert.equal(
      rulesSha,
      expected.rulesSha256,
      `EN_BASELINE [${pageName}]: Element 3 (rulesSha256) mismatch`,
    );

    // Elements 4 & 5: referenced stylesheet set count and 1-to-1 content hash identical
    const currStylesheets = (await extractStylesheetShas(html, distDir)).sort();
    assert.equal(
      currStylesheets.length,
      expected.stylesheets.length,
      `EN_BASELINE [${pageName}]: Element 5 (stylesheets count) mismatch: expected ${expected.stylesheets.length}, got ${currStylesheets.length}`,
    );
    assert.deepEqual(
      currStylesheets,
      expected.stylesheets,
      `EN_BASELINE [${pageName}]: Element 4/5 (stylesheets content sha) mismatch`,
    );
  }

  return true;
}

export async function runAllChecks() {
  console.log('[i18n-check] Running i18n sync gate checks...');
  await checkFileParity();
  console.log('  ✔ 1. File set parity verified');
  await checkStructureParity();
  console.log('  ✔ 2. Structure parity verified (keys & heading/pre outline)');
  await checkSourceSha();
  console.log('  ✔ 3. sourceSha256 verified');
  await checkValues();
  console.log('  ✔ 4. Text values & HTML tag whitelist verified');
  console.log('[i18n-check] All 4 gates PASSED.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  try {
    const distArgIdx = process.argv.indexOf('--dist');
    const distDir = distArgIdx !== -1 && process.argv[distArgIdx + 1]
      ? resolve(process.argv[distArgIdx + 1])
      : resolve(ROOT, 'dist');

    if (process.argv.includes('--write-en-baseline')) {
      const outPath = resolve(ROOT, 'i18n-en-baseline.json');
      await writeEnBaseline(outPath, distDir);
      console.log(`[i18n-check] Wrote en-baseline (${distDir}) -> ${outPath}`);
    } else if (process.argv.includes('--en-baseline')) {
      console.log('[i18n-check] Running en-baseline 5-part invariant check...');
      const baselineData = await readJson('i18n-en-baseline.json');
      await checkEnBaseline(baselineData, distDir);
      console.log('[i18n-check] en-baseline 5-part invariant check PASSED.');
    } else {
      await runAllChecks();
    }
  } catch (err) {
    console.error(`\n[i18n-check] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}
