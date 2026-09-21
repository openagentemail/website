import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { jsonLd, validateJsonLd } from '../src/data/jsonld.js';

const ownerSource = 'components/JsonLd.astro';
const ownerMarker = 'JsonLd';
const expectedBlocks = new Map([['index.html', 2], ['compare/index.html', 1]]);
const expectedTotalBlocks = 3;
const baselinePayloadDigest = '6fa72fecf0f1d10b93a7b36780799f9758fa74ffdb9f7f22f3286bd225d491e6';

// The owner marker and source rule guard regressions and accidental misuse. They do not
// defend against a malicious contributor, who could forge the marker and edit this test.

// --- the serializer and owner validation close the sink (#22) ---

const scriptClosing = {
  '@type': 'FAQPage',
  name: '</script><script>alert(1)</script>',
  nested: { answer: 'before <!-- comment --> after </SCRIPT > tail' },
  list: ['</script', 'plain text', 'a < b'],
};

const serialized = jsonLd(scriptClosing);
assert.equal(serialized.includes('<'), false, 'Serialized JSON-LD must not contain a raw less-than character');
assert.match(serialized, /\\u003c/, 'A less-than character must be written as a JSON Unicode escape');
assert.deepEqual(JSON.parse(serialized), scriptClosing, 'Escaping must not change the decoded structured data');
assert.equal(/<\/script/i.test(serialized), false, 'No script-closing sequence may survive, in any case');
assert.equal(validateJsonLd(serialized), serialized, 'Owner validation must return an accepted serialization unchanged');

assert.throws(() => validateJsonLd(undefined), /must produce a string/, 'Non-string serialization must fail closed');
assert.throws(() => validateJsonLd('{broken'), /must be valid JSON/, 'Unparseable serialization must fail closed');
for (const hostile of [
  JSON.stringify({ value: '</script>' }),
  JSON.stringify({ value: '</SCRIPT>' }),
  JSON.stringify({ value: '<!--' }),
]) {
  assert.throws(() => validateJsonLd(hostile), /raw less-than/, 'Every raw less-than form must fail closed');
}

// --- zero-dependency sole-owner source backstop ---

const sourcesRoot = new URL('../src/', import.meta.url);
const sourceFiles = await recursiveFiles(sourcesRoot, 'source');
assert.ok(sourceFiles.length > 0, 'The JSON-LD guard must discover the complete source tree');
for (const file of sourceFiles) {
  const surface = portableRelative(sourcesRoot, file);
  assertSoleOwnerSource(surface, await readFile(file, 'utf8'));
}

assert.throws(
  () => assertSoleOwnerSource('pages/mutation.astro', '<script type="application/ld+json">'),
  /Only components\/JsonLd\.astro/,
  'Any page containing the reserved substring must fail',
);
assert.doesNotThrow(
  () => assertSoleOwnerSource('pages/data-slot.astro', '<Widget data-slot="head" />'),
  'A data-slot attribute must remain green',
);
assert.doesNotThrow(
  () => assertSoleOwnerSource(ownerSource, '<script type="application/ld+json">'),
  'Only the owner component may contain the reserved substring',
);

for (const mutation of [
  '<Fragment slot="head"><script type="application/ld+json">{}</script></Fragment>',
  '<script type="application/ld+json" set:html={unsafe(data)} />',
  '<script type={"application/ld+json"} set:html={unsafe(data)} />',
  '<script type="application/ld+json" set:html={jsonLd(data) + dynamic} />',
  '<script slot={"head"} type="application/ld+json">{}</script>',
  'const raw = `<script type="application/ld+json">`; <main set:html={raw} />',
]) {
  assert.throws(
    () => assertSoleOwnerSource('pages/prior-mutation.astro', mutation),
    /Only components\/JsonLd\.astro/,
    'Prior literal sink mutations must fail the sole-owner source rule',
  );
}

const ownerComponent = await readFile(new URL('../src/components/JsonLd.astro', import.meta.url), 'utf8');
assert.match(ownerComponent, /data-jsonld-owner="JsonLd"/, 'The owner component must emit its provenance marker');
assert.match(ownerComponent, /validateJsonLd\(jsonLd\(data\)\)/, 'The owner must validate immediately before its set:html sink');

// --- FAQ structured rendering backstop (#53) ---

const homepageSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
assert.equal(
  homepageSource.includes('aHtml'),
  false,
  'The FAQ data must not define a raw aHtml property (#53)',
);
assert.equal(
  homepageSource.includes('set:html={item.'),
  false,
  'The FAQ section must not render answers through a raw HTML sink (#53)',
);

// --- rendered output, after the build ---

if (process.argv.includes('--check-rendered')) {
  const renderedRoot = new URL('../dist/', import.meta.url);
  const renderedPages = await recursiveFiles(renderedRoot, 'rendered', '.html');
  assert.ok(renderedPages.length > 0, 'The rendered JSON-LD guard must discover built HTML pages');

  const renderedBySurface = new Map();
  for (const file of renderedPages) {
    renderedBySurface.set(portableRelative(renderedRoot, file), await readFile(file, 'utf8'));
  }

  const payloadRows = assertRenderedOwnership(renderedBySurface);
  const digest = createHash('sha256').update(JSON.stringify(payloadRows)).digest('hex');
  assert.equal(digest, baselinePayloadDigest, 'The three parsed JSON-LD payloads must remain semantically equal to the pinned baseline (#251 positioning sync)');

  const compareDocument = parse(renderedBySurface.get('compare/index.html'));
  const compareHead = descendants(compareDocument).find((node) => node.nodeName === 'head');
  assert.ok(compareHead, 'Built compare page must have a document head');
  assert.equal(jsonLdBlocks(compareHead).length, 1, 'The compare JsonLd component must still render into the Legal head slot');

  const renderedIndex = renderedBySurface.get('index.html');
  assert.match(
    renderedIndex,
    /<a href="\/pricing"[^>]*>see our <strong[^>]*>pricing<\/strong><\/a>\./,
    'Rendered FAQ must preserve the structured /pricing link (#53)',
  );
}

// Deleting the owner marker from a rendered artifact must turn the provenance gate red.
assert.throws(
  () => assertRenderedOwnership(new Map([
    ['index.html', '<html><head><script type="application/ld+json" data-jsonld-owner="JsonLd">{}</script><script type="application/ld+json" data-jsonld-owner="JsonLd">{}</script></head></html>'],
    ['compare/index.html', '<html><head><script type="application/ld+json">{}</script></head></html>'],
  ])),
  /must carry data-jsonld-owner/,
  'Removing an owner marker must fail the rendered provenance assertion',
);

for (const [label, site, message] of [
  [
    'uppercase unowned MIME',
    renderedFixture({ compare: '<script type="APPLICATION/LD+JSON">{}</script>' }),
    /must carry data-jsonld-owner/,
  ],
  [
    'uppercase unowned MIME inside template content',
    renderedFixture({ compare: `${ownedBlock()}<template><script type="APPLICATION/LD+JSON">{}</script></template>` }),
    /must carry data-jsonld-owner/,
  ],
  [
    'missing required owner block',
    renderedFixture({ compare: '' }),
    /exactly 1 JSON-LD block/,
  ],
  [
    'extra owner block',
    renderedFixture({ compare: `${ownedBlock()}${ownedBlock()}` }),
    /exactly 1 JSON-LD block/,
  ],
  [
    'raw less-than through owner marker',
    renderedFixture({ compare: ownedBlock('{"value":"<!--"}') }),
    /must not contain a raw less-than/,
  ],
  [
    'unparseable payload through owner marker',
    renderedFixture({ compare: ownedBlock('{broken') }),
    /must parse as JSON/,
  ],
]) {
  assert.throws(
    () => assertRenderedOwnership(site),
    message,
    `${label} must fail at the rendered artifact boundary`,
  );
}

function assertSoleOwnerSource(surface, source) {
  if (surface === ownerSource) return;
  assert.equal(
    source.includes('ld+json'),
    false,
    `Only ${ownerSource} may contain the reserved JSON-LD MIME substring; found it in ${surface}`,
  );
}

function assertRenderedOwnership(renderedBySurface) {
  const blocksBySurface = new Map();
  let totalBlocks = 0;

  for (const [surface, rendered] of renderedBySurface) {
    const document = parse(rendered);
    const blocks = jsonLdBlocks(document);
    blocksBySurface.set(surface, blocks);
    totalBlocks += blocks.length;

    for (const block of blocks) {
      assert.equal(
        attribute(block, 'data-jsonld-owner'),
        ownerMarker,
        `Rendered ${surface} JSON-LD must carry data-jsonld-owner="${ownerMarker}"`,
      );
      const text = (block.childNodes ?? []).map((child) => child.value ?? '').join('');
      assert.ok(text.length > 0, `A rendered ${surface} JSON-LD block must not be empty`);
      assert.equal(text.includes('<'), false, `Rendered ${surface} JSON-LD must not contain a raw less-than character`);
      assert.doesNotThrow(() => JSON.parse(text), `Rendered ${surface} JSON-LD must parse as JSON`);
    }
  }

  for (const [surface, expected] of expectedBlocks) {
    assert.ok(blocksBySurface.has(surface), `Rendered output must include ${surface}`);
    assert.equal(blocksBySurface.get(surface).length, expected, `Built ${surface} must contain exactly ${expected} JSON-LD block(s)`);
  }
  assert.equal(totalBlocks, expectedTotalBlocks, `The rendered site must contain exactly ${expectedTotalBlocks} JSON-LD blocks`);

  const payloadRows = [];
  for (const surface of ['index.html', 'compare/index.html']) {
    for (const [index, block] of blocksBySurface.get(surface).entries()) {
      const text = (block.childNodes ?? []).map((child) => child.value ?? '').join('');
      payloadRows.push({ file: surface, index, payload: JSON.parse(text) });
    }
  }
  return payloadRows;
}

function renderedFixture({ compare = ownedBlock() } = {}) {
  return new Map([
    ['index.html', `<html><head>${ownedBlock()}${ownedBlock()}</head></html>`],
    ['compare/index.html', `<html><head>${compare}</head></html>`],
  ]);
}

function ownedBlock(payload = '{}') {
  return `<script type="application/ld+json" data-jsonld-owner="JsonLd">${payload}</script>`;
}

async function recursiveFiles(directory, treeLabel, extension = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    assert.equal(entry.isSymbolicLink(), false, `Symlinks are not allowed in the guarded ${treeLabel} tree: ${new URL(entry.name, directory)}`);
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) {
      files.push(...await recursiveFiles(url, treeLabel, extension));
    } else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
      files.push(url);
    }
  }
  return files;
}

function jsonLdBlocks(node) {
  return descendants(node).filter(
    (descendant) => descendant.nodeName === 'script'
      && (attribute(descendant, 'type') ?? '').toLowerCase() === 'application/ld+json',
  );
}

function descendants(node) {
  const children = [
    ...(node.childNodes ?? []),
    ...(node.content?.childNodes ?? []),
  ];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

function attribute(node, name) {
  return (node.attrs ?? []).find((attr) => attr.name === name)?.value;
}

function portableRelative(root, file) {
  return relative(fileURLToPath(root), fileURLToPath(file)).replaceAll('\\', '/');
}
