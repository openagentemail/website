import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { constants as fsConstants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = new URL('../public/llms.txt', import.meta.url);
const DIST_URL = new URL('../dist/llms.txt', import.meta.url);
const FULL_URL = new URL('../public/llms-full.txt', import.meta.url);
const PACKAGE_URL = new URL('../package.json', import.meta.url);
const MAX_BYTES = 4 * 1024;
const REQUIRED_H1 = '# openagent.email';
const REQUIRED_H2 = Object.freeze([
  '## Start here',
  '## Safety and operations',
  '## Reference',
]);
const REQUIRED_URLS = Object.freeze([
  'https://openagent.email/',
  'https://openagent.email/docs/quickstart/',
  'https://openagent.email/docs/guides/connect-your-agent/',
  'https://openagent.email/mcp/',
  'https://openagent.email/docs/guides/security/',
  'https://openagent.email/docs/guides/deliverability/',
  'https://openagent.email/docs/reference/api/',
  'https://openagent.email/docs/reference/mcp-clients/',
]);
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
const LIST_LINK = /^\s*[-*]\s+\[([^\]]*)\]\(([^)]*)\)(?:\s*:\s*(.*))?$/;

const sourceBytes = await readFile(SOURCE_URL);

test('public/llms.txt is UTF-8 without a BOM', () => {
  assert.equal(hasBom(sourceBytes), false, 'public/llms.txt must not start with a UTF-8 BOM');
  assert.doesNotThrow(
    () => decodeUtf8(sourceBytes),
    'public/llms.txt must be valid UTF-8',
  );
});

test('public/llms.txt is at most 4 KiB', () => {
  assert.ok(
    sourceBytes.length <= MAX_BYTES,
    `public/llms.txt is ${sourceBytes.length} bytes; the selected llms.txt must be <= ${MAX_BYTES} bytes`,
  );
});

test('H1 is the first non-empty line and appears exactly once', () => {
  const lines = splitLines(decodeUtf8(sourceBytes));
  const first = firstNonEmptyLine(lines);
  assert.equal(
    first,
    REQUIRED_H1,
    `first non-empty line must be exactly ${JSON.stringify(REQUIRED_H1)}; got ${JSON.stringify(first)}`,
  );
  const h1s = headingLines(lines, 1);
  assert.equal(
    h1s.length,
    1,
    `expected exactly one H1, found ${h1s.length}: ${h1s.join(' | ') || '(none)'}`,
  );
  assert.equal(
    h1s[0],
    REQUIRED_H1,
    `the only H1 must be exactly ${JSON.stringify(REQUIRED_H1)}`,
  );
});

test('a blockquote summary immediately follows the H1', () => {
  const parsed = parseStructure(decodeUtf8(sourceBytes));
  assert.ok(parsed.blockquote !== null, 'H1 must be followed immediately by a blockquote summary (no other content in between)');
  assert.ok(
    parsed.blockquote.trim() !== '',
    'the blockquote summary immediately after the H1 must be non-empty',
  );
  assert.ok(
    parsed.prose.trim() !== '',
    'concise explanatory prose must appear after the blockquote and before the first H2',
  );
});

test('exact approved H2 groups are present and non-empty', () => {
  const parsed = parseStructure(decodeUtf8(sourceBytes));
  const headings = parsed.sections.map((section) => section.heading);
  assert.deepEqual(
    headings,
    [...REQUIRED_H2],
    `H2 set must be exactly ${REQUIRED_H2.join(', ')}; got ${headings.join(', ') || '(none)'}`,
  );
  for (const section of parsed.sections) {
    const items = section.lines.filter((line) => LIST_LINK.test(line));
    assert.ok(
      items.length > 0,
      `H2 group ${section.heading} must contain at least one Markdown list link`,
    );
  }
});

test('the eight approved HTTPS URLs each appear exactly once', () => {
  const hrefs = markdownHrefs(decodeUtf8(sourceBytes));
  for (const url of REQUIRED_URLS) {
    const count = hrefs.filter((href) => href === url).length;
    assert.equal(
      count,
      1,
      `required URL must appear exactly once: ${url} appeared ${count} time(s)`,
    );
  }
});

test('every Markdown link has a non-empty factual note', () => {
  const lines = splitLines(decodeUtf8(sourceBytes));
  const links = [];
  for (const line of lines) {
    if (!line.includes('](')) continue;
    const match = LIST_LINK.exec(line);
    assert.ok(
      match,
      `Markdown link must be a list item of the form "- [name](url): note": ${line}`,
    );
    const note = (match[3] ?? '').trim();
    assert.ok(
      note !== '',
      `Markdown link note must be non-empty: ${line}`,
    );
    links.push(match[2]);
  }
  assert.equal(
    links.length,
    REQUIRED_URLS.length,
    `expected ${REQUIRED_URLS.length} noted Markdown list links, found ${links.length}`,
  );
});

test('Markdown links are not relative, HTTP, wrong-domain, fragment-only, or placeholders', () => {
  const hrefs = markdownHrefs(decodeUtf8(sourceBytes));
  assert.ok(hrefs.length > 0, 'public/llms.txt must contain Markdown links');
  for (const href of hrefs) {
    const kind = classifyHref(href);
    assert.equal(
      kind,
      'approved',
      `${kind} Markdown URL is not allowed: ${href}`,
    );
  }
});

test('public/llms-full.txt is absent', async () => {
  await assert.rejects(
    () => access(FULL_URL, fsConstants.F_OK),
    (error) => {
      assert.equal(
        error?.code,
        'ENOENT',
        `public/llms-full.txt must not exist (stat failed with ${error?.code ?? error})`,
      );
      return true;
    },
    `public/llms-full.txt must not exist at ${fileURLToPath(FULL_URL)}`,
  );
});

test('package.json wires source and rendered llms.txt gates', async () => {
  const pkg = JSON.parse(await readFile(PACKAGE_URL, 'utf8'));
  assert.equal(pkg.scripts['test:llms-txt'], 'node --test tests/llms-txt.test.mjs');
  assert.equal(pkg.scripts['test:llms-txt-rendered'], 'node tests/llms-txt.test.mjs --check-rendered');
  assert.equal(pkg.scripts['posttest:seo-docs'], undefined);
  assert.equal(pkg.scripts['posttest:seo-docs-rendered'], undefined);
  assert.equal(
    pkg.scripts.prebuild,
    'npm run test:compare-freshness && npm run test:hosted-checkout && npm run test:mail-security-docs && npm run test:iphone-mail-guide && npm run test:jsonld && npm run test:seo-docs && npm run test:llms-txt && npm run test:mcp-tools && npm run test:mcp-tools-upstream && npm run test:webhook-normative && npm run test:webhook-normative-source && node scripts/i18n-check.mjs && npm run test:i18n-sync',
    'the canonical lifecycle must preserve all prior gates and append i18n checks',
  );
  assert.equal(
    pkg.scripts.postbuild,
    'npm run test:compare-rendered && npm run test:jsonld-rendered && npm run test:seo-docs-rendered && npm run test:llms-txt-rendered && npm run test:mcp-tools-rendered && npm run test:i18n-sync-rendered',
    'postbuild must preserve prior gates and append test:i18n-sync-rendered',
  );
});

if (process.argv.includes('--check-rendered')) {
  test('dist/llms.txt exists and is byte-for-byte identical to public/llms.txt', async () => {
    let distBytes;
    try {
      distBytes = await readFile(DIST_URL);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        assert.fail('dist/llms.txt is missing; the build must copy public/llms.txt into dist/llms.txt');
      }
      throw error;
    }
    assert.equal(
      Buffer.compare(distBytes, sourceBytes),
      0,
      `dist/llms.txt drifted from public/llms.txt (${distBytes.length} vs ${sourceBytes.length} bytes)`,
    );
  });
}

function hasBom(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function firstNonEmptyLine(lines) {
  for (const line of lines) {
    if (line.trim() !== '') return line;
  }
  return undefined;
}

function headingLevel(line) {
  const match = /^(#{1,6}) (.+)$/.exec(line);
  return match ? match[1].length : 0;
}

function headingLines(lines, level) {
  return lines.filter((line) => headingLevel(line) === level);
}

function parseStructure(text) {
  const lines = splitLines(text);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  assert.equal(
    lines[i],
    REQUIRED_H1,
    `first non-empty line must be exactly ${JSON.stringify(REQUIRED_H1)}; got ${JSON.stringify(lines[i])}`,
  );
  i += 1;
  while (i < lines.length && lines[i].trim() === '') i += 1;

  let blockquote = null;
  if (i < lines.length && lines[i].startsWith('>')) {
    const quote = [];
    while (i < lines.length && lines[i].startsWith('>')) {
      quote.push(lines[i].replace(/^>\s?/, ''));
      i += 1;
    }
    blockquote = quote.join('\n');
  }

  const prose = [];
  while (i < lines.length && headingLevel(lines[i]) !== 2) {
    assert.notEqual(
      headingLevel(lines[i]),
      1,
      `unexpected extra H1 before H2 groups: ${lines[i]}`,
    );
    assert.ok(
      headingLevel(lines[i]) === 0,
      `only H2 headings may follow the summary; found ${lines[i]}`,
    );
    prose.push(lines[i]);
    i += 1;
  }

  const sections = [];
  while (i < lines.length) {
    assert.equal(
      headingLevel(lines[i]),
      2,
      `expected an H2 group heading, found ${JSON.stringify(lines[i])}`,
    );
    const section = { heading: lines[i], lines: [] };
    i += 1;
    while (i < lines.length && headingLevel(lines[i]) !== 2) {
      assert.notEqual(
        headingLevel(lines[i]),
        1,
        `unexpected extra H1 inside ${section.heading}: ${lines[i]}`,
      );
      assert.ok(
        headingLevel(lines[i]) === 0,
        `H2 groups may not contain nested headings: ${lines[i]}`,
      );
      section.lines.push(lines[i]);
      i += 1;
    }
    sections.push(section);
  }

  return { blockquote, prose: prose.join('\n'), sections };
}

function markdownHrefs(text) {
  return Array.from(text.matchAll(MARKDOWN_LINK), (match) => match[2]);
}

function classifyHref(href) {
  const trimmed = href.trim();
  if (
    trimmed === ''
    || /^(TODO|TBD|FIXME|PLACEHOLDER|\.\.\.)$/i.test(trimmed)
    || /example\.(com|org|net)/i.test(trimmed)
    || /your-domain/i.test(trimmed)
  ) {
    return 'placeholder';
  }
  if (trimmed.startsWith('#')) return 'fragment-only';
  if (trimmed.startsWith('http://')) return 'HTTP';
  if (trimmed.startsWith('https://')) {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return 'placeholder';
    }
    if (parsed.protocol !== 'https:') return 'HTTP';
    if (parsed.hostname !== 'openagent.email') return 'wrong-domain';
    if (parsed.hash) return 'fragment-only';
    if (!REQUIRED_URLS.includes(trimmed)) return 'unapproved';
    return 'approved';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return 'wrong-domain';
  return 'relative';
}
