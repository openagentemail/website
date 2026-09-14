import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { jsonLd } from '../src/data/jsonld.js';

// --- the serializer closes the sink (#22) ---

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

// --- every JSON-LD sink must actually go through the serializer ---

// The rendered page cannot prove the escaping is wired up while the shipped data contains
// no less-than character, so assert it at the call sites instead. Without this, reverting a
// sink to bare JSON.stringify() would keep every other assertion in this file green.
const pagesRoot = new URL('../src/pages/', import.meta.url);
const pageFiles = await astroPageFiles(pagesRoot);
assert.ok(pageFiles.length > 0, 'The JSON-LD guard must discover Astro pages');

for (const file of pageFiles) {
  const surface = relative(fileURLToPath(pagesRoot), fileURLToPath(file));
  const source = await readFile(file, 'utf8');
  const sinks = [...source.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/g)]
    .map((match) => match[0]);
  for (const tag of sinks) {
    assert.match(
      tag,
      /set:html\s*=\s*\{\s*jsonLd\s*\(/,
      `Every JSON-LD set:html sink on ${surface} must serialize through jsonLd(); found: ${tag}`,
    );
  }
  assert.equal(
    /set:html\s*=\s*\{\s*JSON\.stringify\s*\(/.test(source),
    false,
    `No set:html sink on ${surface} may serialize with bare JSON.stringify()`,
  );

  const slottedHeadScripts = [...source.matchAll(/<script\b[^>]*slot\s*=\s*["']head["'][^>]*>/g)]
    .map((match) => match[0]);
  for (const tag of slottedHeadScripts) {
    assert.match(
      tag,
      /type\s*=\s*["']application\/ld\+json["']/,
      `A script passed through the Legal head slot must be JSON-LD on ${surface}; found: ${tag}`,
    );
    assert.match(
      tag,
      /set:html\s*=\s*\{\s*jsonLd\s*\(/,
      `A JSON-LD script passed through the Legal head slot must use jsonLd() on ${surface}; found: ${tag}`,
    );
  }
}

const legalLayout = await readFile(new URL('../src/layouts/Legal.astro', import.meta.url), 'utf8');
assert.match(
  legalLayout,
  /Head slot contract: declarative metadata is allowed; scripts must be application\/ld\+json serialized through jsonLd\(\)\./,
  'Legal must document the executable-content boundary on its named head slot',
);

const homepageSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
for (const binding of ['rawMail', 'jsonOut']) {
  const literal = homepageSource.match(new RegExp(`const\\s+${binding}\\s*=\\s*\\\`([\\s\\S]*?)\\\`;`));
  assert.ok(literal, `Homepage ${binding} must remain a template literal`);
  assert.equal(literal[1].includes('${'), false, `Homepage ${binding} must not interpolate dynamic data`);
  assert.match(homepageSource, new RegExp(`set:html\\s*=\\s*\\{\\s*${binding}\\s*\\}`), `Homepage must keep ${binding} wired directly to its static sink`);
}

const faqBlock = homepageSource.match(/const\s+faq\s*=\s*\[([\s\S]*?)\n\];/);
assert.ok(faqBlock, 'Homepage FAQ must remain a static array');
const rawHtmlKeys = [...faqBlock[1].matchAll(/\baHtml\s*:/g)];
const literalRawHtmlValues = [...faqBlock[1].matchAll(/^\s*aHtml\s*:\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`),?\s*$/gm)];
assert.ok(rawHtmlKeys.length > 0, 'Homepage FAQ must retain the guarded static aHtml case');
assert.equal(literalRawHtmlValues.length, rawHtmlKeys.length, 'Every homepage FAQ aHtml value must be a direct source literal');
for (const literal of literalRawHtmlValues) {
  if (/aHtml\s*:\s*`/.test(literal[0])) {
    assert.equal(literal[0].includes('${'), false, 'Homepage FAQ aHtml template literals must not interpolate dynamic data');
  }
}

async function astroPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    assert.equal(entry.isSymbolicLink(), false, `Symlinks are not allowed in the guarded page tree: ${new URL(entry.name, directory)}`);
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) {
      files.push(...await astroPageFiles(url));
    } else if (entry.isFile() && entry.name.endsWith('.astro')) {
      files.push(url);
    }
  }

  return files;
}

// --- rendered output, after the build ---

if (process.argv.includes('--check-rendered')) {
  const renderedPages = [
    ['homepage', new URL('../dist/index.html', import.meta.url), 2],
    ['/compare', new URL('../dist/compare/index.html', import.meta.url), 1],
  ];
  for (const [surface, file, minBlocks] of renderedPages) {
    const rendered = await readFile(file, 'utf8');
    const document = parse(rendered);
    const blocks = descendants(document).filter(
      (node) => node.nodeName === 'script' && attribute(node, 'type') === 'application/ld+json',
    );
    assert.ok(blocks.length >= minBlocks, `Built ${surface} must include at least ${minBlocks} JSON-LD block(s) (found ${blocks.length})`);
    for (const block of blocks) {
      const text = (block.childNodes ?? []).map((child) => child.value ?? '').join('');
      assert.ok(text.length > 0, `A rendered ${surface} JSON-LD block must not be empty`);
      assert.equal(text.includes('<'), false, `Rendered ${surface} JSON-LD must not contain a raw less-than character`);
      assert.equal(/<\/script/i.test(text), false, `Rendered ${surface} JSON-LD must not contain a script-closing sequence`);
      assert.doesNotThrow(() => JSON.parse(text), `Rendered ${surface} JSON-LD must still parse as JSON`);
    }
  }
}

function descendants(node) {
  return (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function attribute(node, name) {
  return (node.attrs ?? []).find((attr) => attr.name === name)?.value;
}
