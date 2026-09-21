import assert from 'node:assert/strict';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

import {
  checkFileParity,
  checkStructureParity,
  checkSourceSha,
  checkValues,
  validateTextValue,
  computeSha256,
  extractTagsOutline,
  checkEnBaseline,
  readJson,
} from '../scripts/i18n-check.mjs';

import { LOCALES, DEFAULT_LOCALE, HTML_LANG, TRANSLATED_PAGES, pageUrl } from '../src/i18n/config.js';
import { texts as en } from '../src/i18n/en.js';
import { texts as es } from '../src/i18n/es.js';
import { texts as ja } from '../src/i18n/ja.js';
import { texts as ko } from '../src/i18n/ko.js';
import { texts as zh } from '../src/i18n/zh.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const isRenderedMode = process.argv.includes('--check-rendered');

if (!isRenderedMode) {
  // ── Source-level tests (G1 ~ G6, prebuild chain) ─────────────────────────

  test('G0: File set parity (+ negative control)', async () => {
    await checkFileParity();

    // Negative control: config declares an unregistered locale ('fr')
    await assert.rejects(
      async () => await checkFileParity(undefined, {
        LOCALES: [...LOCALES, 'fr'],
        TRANSLATED_PAGES: [...TRANSLATED_PAGES],
      }),
      /FILE_PARITY: sync\.locales/,
      'Must fail when config LOCALES adds an unregistered locale',
    );
  });

  test('G1: Dictionary key set equality across all languages (+ negative control)', async () => {
    const dicts = { en, es, ja, ko, zh };
    await checkStructureParity(dicts);

    // Negative control: missing key in es
    const esMissing = { ...es };
    delete esMissing.meta_title;
    await assert.rejects(
      async () => await checkStructureParity({ ...dicts, es: esMissing }),
      /STRUCTURE_PARITY: Key set mismatch/,
      'Must fail when a key is missing in a dictionary',
    );

    // Negative control: extra key in zh
    const zhExtra = { ...zh, extra_unknown_key: 'foo' };
    await assert.rejects(
      async () => await checkStructureParity({ ...dicts, zh: zhExtra }),
      /STRUCTURE_PARITY: Key set mismatch/,
      'Must fail when an extra key is present in a dictionary',
    );
  });

  test('G2: Heading outline and pre count parity across all 9 pages (+ negative control)', async () => {
    await checkStructureParity({ en, es, ja, ko, zh });

    // Negative control: tampering with heading in one layout
    const layoutPath = 'src/layouts/IndexPage.astro';
    const layoutSrc = await readFile(resolve(ROOT, layoutPath), 'utf8');
    const tamperedLayout = layoutSrc + '\n<h2>Extra Heading</h2>';
    await assert.rejects(
      async () => await checkStructureParity({ en, es, ja, ko, zh }, { [layoutPath]: tamperedLayout }),
      /STRUCTURE_PARITY: Heading outline and <pre> count mismatch/,
      'Must fail when a layout heading outline differs from its en source',
    );
  });

  test('G3: sourceSha256 matches i18n-sync.json (+ negative control)', async () => {
    await assert.doesNotReject(async () => await checkSourceSha());

    // Negative control 1: tamper with index.astro
    await assert.rejects(
      async () => await checkSourceSha(undefined, { 'src/pages/index.astro': 'tampered source' }),
      /en 源已变更，译文需同步/,
      'Must fail with exact message when page source sha256 drifts',
    );

    // Negative control 2: tamper with StampWall.astro
    await assert.rejects(
      async () => await checkSourceSha(undefined, { 'src/components/StampWall.astro': 'tampered component' }),
      /en 源已变更，译文需同步/,
      'Must fail with exact message when StampWall component sha256 drifts',
    );

    // Negative control 3: tamper with FeatureViz.astro
    await assert.rejects(
      async () => await checkSourceSha(undefined, { 'src/components/FeatureViz.astro': 'tampered component' }),
      /en 源已变更，译文需同步/,
      'Must fail with exact message when FeatureViz component sha256 drifts',
    );

    // Negative control 4: tamper with IndexPage.astro (layout)
    await assert.rejects(
      async () => await checkSourceSha(undefined, { 'src/layouts/IndexPage.astro': 'tampered layout' }),
      /en 源已变更，译文需同步/,
      'Must fail with exact message when IndexPage layout sha256 drifts',
    );

    // Negative control 5: tamper with Legal.astro (shared en-page shell layout)
    await assert.rejects(
      async () => await checkSourceSha(undefined, { 'src/layouts/Legal.astro': 'tampered layout' }),
      /en 源已变更，译文需同步/,
      'Must fail with exact message when Legal layout sha256 drifts',
    );
  });

  test('G4: Value validation and HTML tag whitelist (+ negative control)', async () => {
    await assert.doesNotReject(() => checkValues({ en, es, ja, ko, zh }));

    // Negative control: empty value
    assert.throws(() => validateTextValue('k', '', 'test'), /Value must be a non-empty string/);
    assert.throws(() => validateTextValue('k', '   ', 'test'), /Value must be a non-empty string/);

    // Negative control: dangerous tags
    assert.throws(() => validateTextValue('k', 'hello <script>alert(1)</script>', 'test'), /Bare '<' or unapproved tag/);
    assert.throws(() => validateTextValue('k', 'hello <iframe src="x"></iframe>', 'test'), /Bare '<' or unapproved tag/);

    // Negative control: unknown unapproved tag
    assert.throws(() => validateTextValue('k', 'hello <custom>world</custom>', 'test'), /Bare '<' or unapproved tag/);

    // Negative control: bare <
    assert.throws(() => validateTextValue('k', 'price < 5', 'test'), /Bare '<' or unapproved tag/);

    // Negative control: event attributes
    assert.throws(() => validateTextValue('k', '<code onclick="evil()">val</code>', 'test'), /Event handler attributes forbidden/);
  });

  test('G5: FAQ link invariant (a.includes(text+strong)) across all 5 languages', () => {
    const dicts = { en, es, ja, ko, zh };
    for (const [lang, d] of Object.entries(dicts)) {
      assert.ok(d.faq_link_1_text && d.faq_link_1_text.length > 0, `[${lang}] faq_link_1_text must be non-empty`);
      assert.ok(d.faq_link_1_strong && d.faq_link_1_strong.length > 0, `[${lang}] faq_link_1_strong must be non-empty`);
      const linkSlice = d.faq_link_1_text + d.faq_link_1_strong;
      assert.ok(
        d.faq_a_1.includes(linkSlice),
        `[${lang}] faq_a_1 must continuously include '${linkSlice}' for indexOf slicing`,
      );
    }
  });

  test('G6: pageUrl fallback and routing semantics (9 translated pages)', () => {
    // English (default) has no prefix
    assert.equal(pageUrl('en', 'index'), '/');
    assert.equal(pageUrl('en', '/'), '/');
    assert.equal(pageUrl('en', 'pricing'), '/pricing');
    assert.equal(pageUrl('en', '/compare'), '/compare');
    assert.equal(pageUrl('en', 'alternatives/agentmail'), '/alternatives/agentmail');

    // All 9 pages are translated → locale prefix
    assert.equal(pageUrl('zh', 'index'), '/zh/');
    assert.equal(pageUrl('es', 'index'), '/es/');
    assert.equal(pageUrl('ja', 'compare'), '/ja/compare');
    assert.equal(pageUrl('ko', 'pricing'), '/ko/pricing');
    assert.equal(pageUrl('zh', 'mcp'), '/zh/mcp');
    assert.equal(pageUrl('es', 'contact'), '/es/contact');
    assert.equal(pageUrl('ja', 'alternatives/agentmail'), '/ja/alternatives/agentmail');
    assert.equal(pageUrl('ko', 'privacy-policy'), '/ko/privacy-policy');
    assert.equal(pageUrl('zh', 'terms-of-service'), '/zh/terms-of-service');
    assert.equal(pageUrl('es', 'refund-policy'), '/es/refund-policy');

    // Docs remain untranslated → en fallback
    assert.equal(pageUrl('zh', '/docs/quickstart/'), '/docs/quickstart/');
    assert.equal(pageUrl('ja', '/docs/'), '/docs/');
  });

} else {
  // ── Rendered tests (G7 ~ G11, postbuild chain) ───────────────────────────

  function getHtmlNodes(html) {
    const doc = parse(html);
    const nodes = [];
    function walk(node) {
      nodes.push(node);
      if (node.childNodes) {
        for (const c of node.childNodes) walk(c);
      }
      if (node.content && node.content.childNodes) {
        for (const c of node.content.childNodes) walk(c);
      }
    }
    walk(doc);
    return nodes;
  }

  function getAttr(node, attrName) {
    return (node.attrs ?? []).find((a) => a.name === attrName)?.value;
  }

  function getNodeDirectText(node) {
    return (node.childNodes ?? [])
      .filter((c) => c.nodeName === '#text')
      .map((c) => c.value)
      .join('');
  }

  function distPathFor(loc, page) {
    return page === 'index'
      ? resolve(ROOT, `dist/${loc}/index.html`)
      : resolve(ROOT, `dist/${loc}/${page}/index.html`);
  }

  function enDistPathFor(page) {
    return page === 'index'
      ? resolve(ROOT, 'dist/index.html')
      : resolve(ROOT, `dist/${page}/index.html`);
  }

  function pageGroupUrls(page) {
    const enUrl = page === 'index' ? 'https://openagent.email/' : `https://openagent.email/${page}/`;
    const locUrls = LOCALES.map((loc) =>
      page === 'index' ? `https://openagent.email/${loc}/` : `https://openagent.email/${loc}/${page}/`,
    );
    return [enUrl, ...locUrls];
  }

  test('G7: All 9 translated pages exist and have correct <html lang> attributes', async () => {
    for (const loc of LOCALES) {
      for (const page of TRANSLATED_PAGES) {
        const filePath = distPathFor(loc, page);
        const html = await readFile(filePath, 'utf8');
        const expectedLang = HTML_LANG[loc] || loc;
        const nodes = getHtmlNodes(html);
        const htmlNode = nodes.find((n) => n.nodeName === 'html');
        assert.ok(htmlNode, `<html> element must exist for ${loc}/${page}`);
        const lang = getAttr(htmlNode, 'lang');
        assert.equal(lang, expectedLang, `[${loc}/${page}] <html lang> must be '${expectedLang}'`);
      }
    }

    for (const page of TRANSLATED_PAGES) {
      const enHtml = await readFile(enDistPathFor(page), 'utf8');
      const enNodes = getHtmlNodes(enHtml);
      const enHtmlNode = enNodes.find((n) => n.nodeName === 'html');
      assert.equal(getAttr(enHtmlNode, 'lang'), 'en', `en page '${page}' <html lang> must be "en"`);
    }
  });

  test('G8: Rendered structure parity (heading outline and pre count) across all 9 pages', async () => {
    for (const page of TRANSLATED_PAGES) {
      const enHtml = await readFile(enDistPathFor(page), 'utf8');
      const enNodes = getHtmlNodes(enHtml);
      const enOutline = enNodes
        .filter((n) => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'].includes(n.nodeName))
        .map((n) => n.nodeName);

      for (const loc of LOCALES) {
        const locHtml = await readFile(distPathFor(loc, page), 'utf8');
        const locNodes = getHtmlNodes(locHtml);
        const locOutline = locNodes
          .filter((n) => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'].includes(n.nodeName))
          .map((n) => n.nodeName);

        assert.deepEqual(
          locOutline,
          enOutline,
          `Rendered heading outline & pre count for [${loc}/${page}] must match en [${page}]`,
        );
      }
    }
  });

  test('G9: No dead internal links on any translated page', async () => {
    for (const loc of LOCALES) {
      for (const page of TRANSLATED_PAGES) {
        const locHtml = await readFile(distPathFor(loc, page), 'utf8');
        const nodes = getHtmlNodes(locHtml);
        const aNodes = nodes.filter((n) => n.nodeName === 'a');

        for (const a of aNodes) {
          const href = getAttr(a, 'href');
          if (!href || !href.startsWith('/') || href.startsWith('//')) continue;
          const cleanPath = href.split('#')[0].split('?')[0];
          if (!cleanPath) continue;

          let targetFile;
          if (cleanPath === '/' || cleanPath.endsWith('/')) {
            targetFile = resolve(ROOT, 'dist', cleanPath.replace(/^\//, ''), 'index.html');
          } else {
            const direct = resolve(ROOT, 'dist', cleanPath.replace(/^\//, ''));
            const asDirIndex = resolve(ROOT, 'dist', cleanPath.replace(/^\//, ''), 'index.html');
            const asHtml = resolve(ROOT, 'dist', `${cleanPath.replace(/^\//, '')}.html`);
            try {
              await access(direct);
              targetFile = direct;
            } catch {
              try {
                await access(asDirIndex);
                targetFile = asDirIndex;
              } catch {
                targetFile = asHtml;
              }
            }
          }

          try {
            await access(targetFile);
          } catch {
            assert.fail(`DEAD_LINK [${loc}/${page}]: Link '${href}' points to non-existent file '${targetFile}'`);
          }
        }
      }
    }
  });

  test('G10: Language switcher has 5 links on every translated page and 0 on every en page', async () => {
    // 1. Translated pages have 5 switcher links each (9 pages × 4 locales)
    for (const loc of LOCALES) {
      for (const page of TRANSLATED_PAGES) {
        const locHtml = await readFile(distPathFor(loc, page), 'utf8');
        const nodes = getHtmlNodes(locHtml);
        const switcher = nodes.find((n) => getAttr(n, 'class')?.includes('lang-switcher'));
        assert.ok(switcher, `[${loc}/${page}] must contain a .lang-switcher element`);

        const links = (switcher.childNodes ?? []).filter((n) => n.nodeName === 'a');
        assert.equal(links.length, 5, `[${loc}/${page}] must contain exactly 5 language links`);

        const hreflangs = links.map((l) => getAttr(l, 'hreflang')).sort();
        const expectedHreflangs = ['en', 'es', 'ja', 'ko', 'zh-CN'].sort();
        assert.deepEqual(hreflangs, expectedHreflangs, `[${loc}/${page}] links must have correct hreflang attributes`);
      }
    }

    // 2. Every English page has 0 switcher links (zero leakage)
    for (const page of TRANSLATED_PAGES) {
      const enHtml = await readFile(enDistPathFor(page), 'utf8');
      const enNodes = getHtmlNodes(enHtml);
      const enSwitcher = enNodes.find((n) => getAttr(n, 'class')?.includes('lang-switcher'));
      assert.equal(enSwitcher, undefined, `en page '${page}' must NOT contain a .lang-switcher element (zero leakage)`);
    }
  });

  test('G11: Sitemap alternates: 9 page groups × 5×5, 0 on all other URLs', async () => {
    const sitemapPath = resolve(ROOT, 'dist/sitemap-0.xml');
    const sitemapContent = await readFile(sitemapPath, 'utf8');

    const urlMatches = [...sitemapContent.matchAll(/<url>([\s\S]*?)<\/url>/g)];
    assert.ok(urlMatches.length > 0, 'Sitemap must contain <url> entries');

    const translatedUrls = new Set();
    for (const page of TRANSLATED_PAGES) {
      for (const url of pageGroupUrls(page)) translatedUrls.add(url);
    }

    const seen = new Set();

    for (const match of urlMatches) {
      const block = match[1];
      const locMatch = block.match(/<loc>(.*?)<\/loc>/);
      assert.ok(locMatch, 'Every <url> entry must have a <loc>');
      const loc = locMatch[1];

      const linkMatches = [...block.matchAll(/<xhtml:link\b([^>]*)\/>/g)];

      if (translatedUrls.has(loc)) {
        seen.add(loc);
        assert.equal(
          linkMatches.length,
          5,
          `Translated URL '${loc}' must have exactly 5 alternate links in sitemap (got ${linkMatches.length})`,
        );

        const hreflangs = linkMatches
          .map((m) => m[1].match(/hreflang="([^"]*)"/)?.[1])
          .sort();
        assert.deepEqual(
          hreflangs,
          ['en', 'es', 'ja', 'ko', 'zh-CN'].sort(),
          `Translated URL '${loc}' must contain alternates for en, es, ja, ko, and zh-CN`,
        );
      } else {
        assert.equal(
          linkMatches.length,
          0,
          `Non-translated URL '${loc}' must have 0 alternate links in sitemap (got ${linkMatches.length})`,
        );
      }
    }

    assert.equal(
      seen.size,
      translatedUrls.size,
      `All ${translatedUrls.size} translated URLs must be present in the sitemap (found ${seen.size})`,
    );
  });

  test('G12: REST API caplist code-span scope parity across all 5 languages', async () => {
    const pagesToCheck = [
      { loc: 'en', path: resolve(ROOT, 'dist/index.html') },
      ...LOCALES.map((loc) => ({ loc, path: resolve(ROOT, `dist/${loc}/index.html`) })),
    ];

    for (const { loc, path } of pagesToCheck) {
      const html = await readFile(path, 'utf8');
      const nodes = getHtmlNodes(html);
      const liNodes = nodes.filter((n) => n.nodeName === 'li');
      const restLis = liNodes.filter((li) => {
        const code = (li.childNodes ?? []).find((c) => c.nodeName === 'code');
        return code && /^(POST|GET|DELETE|PUT) \/v1\//.test(getNodeDirectText(code).trim());
      });

      assert.equal(
        restLis.length,
        19,
        `Page [${loc}] must render exactly 19 REST API items in caplist (got ${restLis.length})`,
      );

      for (let i = 0; i < restLis.length; i++) {
        const li = restLis[i];
        const code = (li.childNodes ?? []).find((c) => c.nodeName === 'code');
        assert.ok(code, `[${loc}] REST item ${i + 1} must contain a <code> tag`);

        const codeText = getNodeDirectText(code).trim();
        assert.ok(
          /^(POST|GET|DELETE|PUT) \/v1\//.test(codeText),
          `[${loc}] REST item ${i + 1} code text must match REST endpoint pattern, got '${codeText}'`,
        );
        assert.equal(
          codeText.includes('—'),
          false,
          `[${loc}] REST item ${i + 1} <code> must NOT contain '—', got '${codeText}'`,
        );

        const outsideText = getNodeDirectText(li).trim();
        assert.ok(
          outsideText.startsWith('—'),
          `[${loc}] REST item ${i + 1} description outside code must start with '—', got '${outsideText}'`,
        );
        assert.ok(
          outsideText.length > 2,
          `[${loc}] REST item ${i + 1} description outside code must not be empty`,
        );
      }
    }
  });

  test('G13: Five-part en-baseline invariant check (+ 3 negative controls)', async () => {
    const baselineData = await readJson('i18n-en-baseline.json');

    // 1. Positive control on actual dist
    await checkEnBaseline(baselineData, resolve(ROOT, 'dist'));

    // 2. Three negative controls on synthetic/isolated fixture
    const tempDist = await mkdtemp(join(tmpdir(), 'oae-g13-nc-'));
    try {
      const origHtml = await readFile(resolve(ROOT, 'dist/index.html'), 'utf8');
      await cp(resolve(ROOT, 'dist/_astro'), join(tempDist, '_astro'), { recursive: true });

      // Negative control ①: 改一段 CSS 规则 → fail
      const tamperedCss = origHtml.replace('opacity: 1;', 'opacity: 0.999;');
      await writeFile(join(tempDist, 'index.html'), tamperedCss, 'utf8');
      await assert.rejects(
        async () => await checkEnBaseline(baselineData, tempDist, { pages: ['index.html'] }),
        /Element 3 \(rulesSha256\) mismatch/,
        'Negative control ① must fail when CSS rule is modified',
      );

      // Negative control ②: 增/删一个样式表引用 → fail
      const tamperedCssLink = origHtml.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/, '');
      await writeFile(join(tempDist, 'index.html'), tamperedCssLink, 'utf8');
      await assert.rejects(
        async () => await checkEnBaseline(baselineData, tempDist, { pages: ['index.html'] }),
        /Element 5 \(stylesheets count\) mismatch/,
        'Negative control ② must fail when stylesheet link is removed',
      );

      // Negative control ③: 改 <body> 一个字节 → fail
      const tamperedBody = origHtml.replace('<body', '<body data-tampered="1"');
      await writeFile(join(tempDist, 'index.html'), tamperedBody, 'utf8');
      await assert.rejects(
        async () => await checkEnBaseline(baselineData, tempDist, { pages: ['index.html'] }),
        /Element 1 \(bodySha256\) mismatch/,
        'Negative control ③ must fail when body is modified by 1 byte',
      );
    } finally {
      await rm(tempDist, { recursive: true, force: true });
    }
  });
}
