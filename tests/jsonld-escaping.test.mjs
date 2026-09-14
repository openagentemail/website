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
const sourcesRoot = new URL('../src/', import.meta.url);
const serializerFile = fileURLToPath(new URL('../src/data/jsonld.js', import.meta.url));
const sourceFiles = await recursiveFiles(sourcesRoot, '.astro', 'source');
assert.ok(sourceFiles.length > 0, 'The JSON-LD guard must discover renderable Astro sources');
assert.equal(normalizeRelativePath('compare\\index.html'), 'compare/index.html', 'Guarded route paths must use portable forward slashes');

for (const file of sourceFiles) {
  const surface = portableRelative(sourcesRoot, file);
  const source = await readFile(file, 'utf8');
  const tags = astroTags(source);
  for (const { name, text: tag } of tags) {
    assert.equal(
      /\bslot\s*=\s*\{/i.test(tag),
      false,
      `Slot assignments on ${surface} must use direct static quoted values; found: ${tag}`,
    );
    if (name.toLowerCase() === 'script') {
      assert.equal(
        /\btype\s*=\s*\{/i.test(tag),
        false,
        `Script type attributes on ${surface} must use direct static quoted values; found: ${tag}`,
      );
    }
  }

  const scriptTags = tags.filter(({ name }) => name.toLowerCase() === 'script').map(({ text }) => text);
  const sinks = scriptTags.filter((tag) => /\btype\s*=\s*(["'])application\/ld\+json\1/i.test(tag));
  if (sinks.length > 0) {
    assertApprovedJsonLdImport(source, file, surface);
    assertNoJsonLdShadowing(source, surface);
  }
  for (const tag of sinks) {
    assertSafeJsonLdSink(tag, surface);
  }
  assert.equal(
    /set:html\s*=\s*\{\s*JSON\.stringify\s*\(/.test(source),
    false,
    `No set:html sink on ${surface} may serialize with bare JSON.stringify()`,
  );

  const headSlotAssignments = tags.filter(({ text }) => /\bslot\s*=\s*(["'])head\1/i.test(text));
  for (const { name, text: tag } of headSlotAssignments) {
    const element = name.toLowerCase();
    if (element === 'script') {
      assert.match(
        tag,
        /type\s*=\s*(["'])application\/ld\+json\1/i,
        `A script passed through the Legal head slot must be JSON-LD on ${surface}; found: ${tag}`,
      );
      assertSafeJsonLdSink(tag, surface);
    } else {
      assert.ok(
        ['base', 'link', 'meta', 'title'].includes(element),
        `The Legal head slot accepts only native declarative metadata or direct safe JSON-LD scripts on ${surface}; found: ${tag}`,
      );
      assert.equal(
        /\bset:html\s*=/.test(tag),
        false,
        `Declarative metadata in the Legal head slot must not use set:html on ${surface}; found: ${tag}`,
      );
    }
  }
}

const legalLayout = await readFile(new URL('../src/layouts/Legal.astro', import.meta.url), 'utf8');
assert.match(
  legalLayout,
  /Head slot contract: declarative metadata is allowed; scripts must be application\/ld\+json serialized through jsonLd\(\)\./,
  'Legal must document the executable-content boundary on its named head slot',
);

const homepageSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const homepageFrontmatter = maskComments(frontmatter(homepageSource, 'pages/index.astro'));
for (const binding of ['rawMail', 'jsonOut']) {
  assertStaticTemplateBinding(homepageFrontmatter, binding);
  assert.match(homepageSource, new RegExp(`set:html\\s*=\\s*\\{\\s*${binding}\\s*\\}`), `Homepage must keep ${binding} wired directly to its static sink`);
}

const faqBlock = homepageSource.match(/const\s+faq\s*=\s*\[([\s\S]*?)\n\];/);
assert.ok(faqBlock, 'Homepage FAQ must remain a static array');
assert.equal(
  /(?:^|[{,])\s*\.\.\./m.test(faqBlock[1]),
  false,
  'Homepage FAQ entries must not use object spreads that can introduce dynamic aHtml values',
);
const rawHtmlProperties = [...faqBlock[1].matchAll(/(?:^|[{,])\s*(?:aHtml\b|["']aHtml["']|\[\s*["']aHtml["']\s*\])\s*(?=[:,}])/gm)];
const literalRawHtmlValues = [...faqBlock[1].matchAll(/^\s*(?:aHtml|["']aHtml["'])\s*:\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`),?\s*$/gm)];
assert.ok(rawHtmlProperties.length > 0, 'Homepage FAQ must retain the guarded static aHtml case');
assert.equal(literalRawHtmlValues.length, rawHtmlProperties.length, 'Every homepage FAQ aHtml property, including shorthand and computed forms, must be an explicit direct source literal');
for (const literal of literalRawHtmlValues) {
  if (literal[0].includes('`')) {
    assertStaticTemplateLiteral(literal[0], literal[0].indexOf('`'), 'Homepage FAQ aHtml', ',');
  }
}
const faqRawHtmlSinks = [...homepageSource.matchAll(/\bset:html\s*=\s*\{\s*item\.aHtml\s*\}/g)];
assert.equal(faqRawHtmlSinks.length, 1, 'Homepage FAQ raw HTML must have exactly one direct set:html={item.aHtml} sink');

async function recursiveFiles(directory, extension, treeLabel) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    assert.equal(entry.isSymbolicLink(), false, `Symlinks are not allowed in the guarded ${treeLabel} tree: ${new URL(entry.name, directory)}`);
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) {
      files.push(...await recursiveFiles(url, extension, treeLabel));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(url);
    }
  }

  return files;
}

function assertApprovedJsonLdImport(source, file, surface) {
  const executableFrontmatter = maskCommentsAndTemplates(frontmatter(source, surface));
  const approvedImports = [...executableFrontmatter.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*(["'])([^"']+)\2\s*;?\s*$/gm)]
    .filter((match) => match[1].split(',').map((name) => name.trim()).includes('jsonLd'));
  assert.equal(approvedImports.length, 1, `JSON-LD sinks on ${surface} must have exactly one named jsonLd import`);
  const resolvedImport = fileURLToPath(new URL(approvedImports[0][3], file));
  assert.equal(resolvedImport, serializerFile, `JSON-LD sinks on ${surface} must bind jsonLd to src/data/jsonld.js`);
  assert.equal(
    /^\s*(?:const|let|var|function)\s+jsonLd\b/m.test(executableFrontmatter),
    false,
    `JSON-LD sinks on ${surface} must not redeclare the imported jsonLd binding`,
  );
}

function assertNoJsonLdShadowing(source, surface) {
  const codeRegions = [frontmatter(source, surface), ...astroExpressions(astroMarkup(source))]
    .map((region) => maskJsLiteralsAndComments(region));
  const shadowPatterns = [
    /\b(?:const|let|var|class)\s+jsonLd\b/,
    /\bfunction\s*\*?\s+jsonLd\b/,
    /\bfunction\s*\*?\s*[A-Za-z_$][\w$]*\s*\([^)]*\bjsonLd\b[^)]*\)/,
    /\bcatch\s*\([^)]*\bjsonLd\b[^)]*\)/,
    /\([^()]*\bjsonLd\b[^()]*\)\s*=>/,
    /\bjsonLd\s*=>/,
  ];
  for (const code of codeRegions) {
    for (const pattern of shadowPatterns) {
      assert.equal(pattern.test(code), false, `JSON-LD sinks on ${surface} must not shadow the imported jsonLd binding`);
    }
  }
}

function assertSafeJsonLdSink(tag, surface) {
  const bindings = [...tag.matchAll(/\bset:html\s*=/g)];
  assert.equal(bindings.length, 1, `Every JSON-LD sink on ${surface} must have exactly one set:html binding; found: ${tag}`);
  const expression = tag.match(/\bset:html\s*=\s*\{([^{}]*)\}/);
  assert.ok(expression, `Every JSON-LD sink on ${surface} must have a simple inspectable set:html expression; found: ${tag}`);
  assert.match(
    expression[1],
    /^\s*jsonLd\s*\((?:[^()]|\([^()]*\))*\)\s*$/,
    `Every JSON-LD set:html sink on ${surface} must be exactly one jsonLd() call; found: ${tag}`,
  );
}

function frontmatter(source, surface) {
  const block = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(block, `JSON-LD source ${surface} must have inspectable Astro frontmatter`);
  return block[1];
}

function astroMarkup(source) {
  return source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');
}

function portableRelative(root, file) {
  return normalizeRelativePath(relative(fileURLToPath(root), fileURLToPath(file)));
}

function normalizeRelativePath(path) {
  return path.replaceAll('\\', '/');
}

function astroTags(source) {
  const markup = astroMarkup(source);
  const tags = [];

  for (let start = 0; start < markup.length; start += 1) {
    if (markup[start] !== '<' || !/[A-Za-z]/.test(markup[start + 1] ?? '')) continue;
    let nameEnd = start + 1;
    while (/[\w:.-]/.test(markup[nameEnd] ?? '')) nameEnd += 1;
    const name = markup.slice(start + 1, nameEnd);
    let quote = '';
    let braceDepth = 0;

    for (let index = nameEnd; index < markup.length; index += 1) {
      const current = markup[index];
      if (quote) {
        if (current === '\\') {
          index += 1;
        } else if (current === quote) {
          quote = '';
        }
      } else if (current === '"' || current === "'" || current === '`') {
        quote = current;
      } else if (current === '{') {
        braceDepth += 1;
      } else if (current === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (current === '>' && braceDepth === 0) {
        tags.push({ name, text: markup.slice(start, index + 1) });
        start = index;
        break;
      }
    }
  }

  return tags;
}

function astroExpressions(markup) {
  const expressions = [];
  for (let start = 0; start < markup.length; start += 1) {
    if (markup[start] !== '{') continue;
    let quote = '';
    let depth = 1;
    for (let index = start + 1; index < markup.length; index += 1) {
      const current = markup[index];
      if (quote) {
        if (current === '\\') {
          index += 1;
        } else if (current === quote) {
          quote = '';
        }
      } else if (current === '"' || current === "'" || current === '`') {
        quote = current;
      } else if (current === '{') {
        depth += 1;
      } else if (current === '}') {
        depth -= 1;
        if (depth === 0) {
          expressions.push(markup.slice(start + 1, index));
          start = index;
          break;
        }
      }
    }
  }
  return expressions;
}

function maskComments(source) {
  let output = '';
  let state = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (current === '/' && next === '/') {
        output += '  ';
        index += 1;
        state = 'line-comment';
      } else if (current === '/' && next === '*') {
        output += '  ';
        index += 1;
        state = 'block-comment';
      } else {
        output += current;
        if (current === "'") state = 'single-quote';
        if (current === '"') state = 'double-quote';
        if (current === '`') state = 'template';
      }
    } else if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      output += current;
      if (current === '\\') {
        output += next ?? '';
        index += 1;
      } else if (
        (state === 'single-quote' && current === "'")
        || (state === 'double-quote' && current === '"')
        || (state === 'template' && current === '`')
      ) {
        state = 'code';
      }
    } else {
      output += current === '\n' ? '\n' : ' ';
      if (state === 'line-comment' && current === '\n') {
        state = 'code';
      } else if (state === 'block-comment' && current === '*' && next === '/') {
        output += ' ';
        index += 1;
        state = 'code';
      }
    }
  }

  return output;
}

function maskJsLiteralsAndComments(source) {
  let output = '';
  let state = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (current === '/' && next === '/') {
        output += '  ';
        index += 1;
        state = 'line-comment';
      } else if (current === '/' && next === '*') {
        output += '  ';
        index += 1;
        state = 'block-comment';
      } else if (current === "'" || current === '"' || current === '`') {
        output += ' ';
        state = current === "'" ? 'single-quote' : current === '"' ? 'double-quote' : 'template';
      } else {
        output += current;
      }
    } else {
      output += current === '\n' ? '\n' : ' ';
      if (current === '\\' && ['single-quote', 'double-quote', 'template'].includes(state)) {
        output += next === '\n' ? '\n' : ' ';
        index += 1;
      } else if (state === 'line-comment' && current === '\n') {
        state = 'code';
      } else if (state === 'block-comment' && current === '*' && next === '/') {
        output += ' ';
        index += 1;
        state = 'code';
      } else if (
        (state === 'single-quote' && current === "'")
        || (state === 'double-quote' && current === '"')
        || (state === 'template' && current === '`')
      ) {
        state = 'code';
      }
    }
  }

  return output;
}

function maskCommentsAndTemplates(source) {
  let output = '';
  let state = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (current === '/' && next === '/') {
        output += '  ';
        index += 1;
        state = 'line-comment';
      } else if (current === '/' && next === '*') {
        output += '  ';
        index += 1;
        state = 'block-comment';
      } else if (current === '`') {
        output += ' ';
        state = 'template';
      } else {
        output += current;
        if (current === "'") state = 'single-quote';
        if (current === '"') state = 'double-quote';
      }
    } else if (state === 'single-quote' || state === 'double-quote') {
      output += current;
      if (current === '\\') {
        output += next ?? '';
        index += 1;
      } else if ((state === 'single-quote' && current === "'") || (state === 'double-quote' && current === '"')) {
        state = 'code';
      }
    } else {
      output += current === '\n' ? '\n' : ' ';
      if (current === '\\' && state === 'template') {
        output += next === '\n' ? '\n' : ' ';
        index += 1;
      } else if (state === 'line-comment' && current === '\n') {
        state = 'code';
      } else if (state === 'block-comment' && current === '*' && next === '/') {
        output += ' ';
        index += 1;
        state = 'code';
      } else if (state === 'template' && current === '`') {
        state = 'code';
      }
    }
  }

  return output;
}

function assertStaticTemplateBinding(source, binding) {
  const declaration = new RegExp(`\\bconst\\s+${binding}\\s*=\\s*\\\``).exec(source);
  assert.ok(declaration, `Homepage ${binding} must remain a template literal`);
  const start = declaration.index + declaration[0].length - 1;
  assertStaticTemplateLiteral(source, start, `Homepage ${binding}`, ';');
}

function assertStaticTemplateLiteral(source, start, label, terminator) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
    } else if (source[index] === '$' && source[index + 1] === '{') {
      assert.fail(`${label} must not interpolate dynamic data`);
    } else if (source[index] === '`') {
      const trailing = source.slice(index + 1);
      const trailingPattern = terminator === ';' ? /^\s*;/ : /^\s*,?\s*$/;
      assert.match(trailing, trailingPattern, `${label} must be a standalone template literal`);
      return;
    }
  }
  assert.fail(`${label} must have a closing template-literal delimiter`);
}

// --- rendered output, after the build ---

if (process.argv.includes('--check-rendered')) {
  const renderedRoot = new URL('../dist/', import.meta.url);
  const renderedPages = await recursiveFiles(renderedRoot, '.html', 'rendered');
  const requiredBlocks = new Map([['index.html', 2], ['compare/index.html', 1]]);
  const seenRequiredPages = new Set();
  assert.ok(renderedPages.length > 0, 'The rendered JSON-LD guard must discover built HTML pages');
  let totalBlocks = 0;
  for (const file of renderedPages) {
    const surface = portableRelative(renderedRoot, file);
    const rendered = await readFile(file, 'utf8');
    const document = parse(rendered);
    const blocks = descendants(document).filter(
      (node) => node.nodeName === 'script' && (attribute(node, 'type') ?? '').toLowerCase() === 'application/ld+json',
    );
    if (requiredBlocks.has(surface)) {
      const minimum = requiredBlocks.get(surface);
      seenRequiredPages.add(surface);
      assert.ok(blocks.length >= minimum, `Built ${surface} must include at least ${minimum} JSON-LD block(s) (found ${blocks.length})`);
    }
    totalBlocks += blocks.length;
    for (const block of blocks) {
      const text = (block.childNodes ?? []).map((child) => child.value ?? '').join('');
      assert.ok(text.length > 0, `A rendered ${surface} JSON-LD block must not be empty`);
      assert.equal(text.includes('<'), false, `Rendered ${surface} JSON-LD must not contain a raw less-than character`);
      assert.equal(/<\/script/i.test(text), false, `Rendered ${surface} JSON-LD must not contain a script-closing sequence`);
      assert.doesNotThrow(() => JSON.parse(text), `Rendered ${surface} JSON-LD must still parse as JSON`);
    }
  }
  assert.equal(seenRequiredPages.size, requiredBlocks.size, 'Every route with required JSON-LD must have a rendered HTML artifact');
  assert.ok(totalBlocks > 0, 'The rendered site must contain at least one guarded JSON-LD block');
}

function descendants(node) {
  return (node.childNodes ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function attribute(node, name) {
  return (node.attrs ?? []).find((attr) => attr.name === name)?.value;
}
