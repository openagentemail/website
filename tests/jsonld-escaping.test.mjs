import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const homepageSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const sinks = [...homepageSource.matchAll(/<script type="application\/ld\+json" set:html=\{([^}]+)\}/g)]
  .map((match) => match[1].trim());
assert.ok(sinks.length >= 2, `Expected both JSON-LD sinks on the homepage (found ${sinks.length})`);
for (const expression of sinks) {
  assert.match(
    expression,
    /^jsonLd\(/,
    `Every JSON-LD set:html sink must serialize through jsonLd(); found: ${expression}`,
  );
}
assert.equal(
  /set:html=\{JSON\.stringify\(/.test(homepageSource),
  false,
  'No set:html sink may serialize with bare JSON.stringify()',
);

// --- rendered output, after the build ---

if (process.argv.includes('--check-rendered')) {
  const renderedHomepage = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const document = parse(renderedHomepage);
  const blocks = descendants(document).filter(
    (node) => node.nodeName === 'script' && attribute(node, 'type') === 'application/ld+json',
  );
  assert.ok(blocks.length >= 2, `Built homepage must include both JSON-LD blocks (found ${blocks.length})`);
  for (const block of blocks) {
    const text = (block.childNodes ?? []).map((child) => child.value ?? '').join('');
    assert.ok(text.length > 0, 'A rendered JSON-LD block must not be empty');
    assert.equal(text.includes('<'), false, 'Rendered JSON-LD must not contain a raw less-than character');
    assert.equal(/<\/script/i.test(text), false, 'Rendered JSON-LD must not contain a script-closing sequence');
    assert.doesNotThrow(() => JSON.parse(text), 'Rendered JSON-LD must still parse as JSON');
  }
}

function descendants(node) {
  return (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function attribute(node, name) {
  return (node.attrs ?? []).find((attr) => attr.name === name)?.value;
}
