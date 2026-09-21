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
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
    await runAllChecks();
  } catch (err) {
    console.error(`\n[i18n-check] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}
