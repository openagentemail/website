import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'parse5';
import { MCP_TOOLS } from '../src/data/mcp-tools.js';

const PACKAGE_URL = new URL('../package.json', import.meta.url);
const INDEX_URL = new URL('../src/pages/index.astro', import.meta.url);
const PRICING_URL = new URL('../src/pages/pricing.astro', import.meta.url);
const MCP_CLIENTS_URL = new URL('../src/content/docs/docs/reference/mcp-clients.md', import.meta.url);
const API_URL = new URL('../src/content/docs/docs/reference/api.md', import.meta.url);
const DIST_INDEX_URL = new URL('../dist/index.html', import.meta.url);
const DIST_PRICING_URL = new URL('../dist/pricing/index.html', import.meta.url);

const isRenderedMode = process.argv.includes('--check-rendered');
const isUpstreamMode = process.argv.includes('--check-upstream');
const isSourceMode = !isRenderedMode && !isUpstreamMode;

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

function text(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(text).join('');
}

function extractRenderedMcpTools(document) {
  const allNodes = descendants(document);

  // 1. stat: find div.l with text === 'MCP tools' -> parent's child div.n -> data-count
  const lDiv = allNodes.find((node) =>
    node.nodeName === 'div'
    && (attribute(node, 'class') ?? '').split(/\s+/).includes('l')
    && text(node).trim() === 'MCP tools',
  );
  if (!lDiv || !lDiv.parentNode) {
    throw new Error('渲染结构变了: 无法在 dist/index.html 中找到 MCP tools 统计格 (div.l)');
  }

  const nDiv = (lDiv.parentNode.childNodes ?? []).find((node) =>
    node.nodeName === 'div'
    && (attribute(node, 'class') ?? '').split(/\s+/).includes('n'),
  );
  if (!nDiv) {
    throw new Error('渲染结构变了: 无法在 dist/index.html 中找到 MCP tools 统计格计数元素 (div.n)');
  }

  const dataCount = attribute(nDiv, 'data-count');
  if (dataCount === undefined) {
    throw new Error('渲染结构变了: MCP tools 统计格缺失 data-count 属性');
  }

  // 2. list: find h3 text === 'MCP tools' -> first sibling ul after h3 -> li > code
  const h3 = allNodes.find((node) =>
    node.nodeName === 'h3' && text(node).trim() === 'MCP tools',
  );
  if (!h3 || !h3.parentNode) {
    throw new Error('渲染结构变了: 无法在 dist/index.html 中找到 <h3>MCP tools</h3>');
  }

  const parentChildren = h3.parentNode.childNodes ?? [];
  const h3Index = parentChildren.indexOf(h3);
  let siblingUl = null;
  for (let i = h3Index + 1; i < parentChildren.length; i++) {
    if (parentChildren[i].nodeName === 'ul') {
      siblingUl = parentChildren[i];
      break;
    }
  }
  if (!siblingUl) {
    throw new Error('渲染结构变了: 无法在 <h3>MCP tools</h3> 后找到相邻 <ul>');
  }

  const lis = (siblingUl.childNodes ?? []).filter((node) => node.nodeName === 'li');
  const names = [];
  for (const li of lis) {
    const code = descendants(li).find((node) => node.nodeName === 'code');
    if (!code) {
      throw new Error('渲染结构变了: MCP tools 列表项 <li> 中未找到 <code>');
    }
    names.push(text(code).trim());
  }

  return { dataCount, count: names.length, names };
}

async function checkUpstream() {
  const UPSTREAM_URL = 'https://raw.githubusercontent.com/openagentemail/openagentemail/main/packages/mcp/test/tools.test.ts';
  let upstreamContent = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(UPSTREAM_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      upstreamContent = await res.text();
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (upstreamContent === null) {
    assert.fail(`MCP-TOOLS/NETWORK: 拉取上游清单失败（${UPSTREAM_URL}）：${lastError?.message ?? lastError} —— 无法核验≠通过`);
  }

  const match = upstreamContent.match(/const\s+expected\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    assert.fail('MCP-TOOLS/PARSE: 上游清单源变了（未找到 const expected = [ ... ]; 块）—— 请更新检查器 tests/mcp-tools.test.mjs');
  }

  const block = match[1];
  const upstreamNames = [];
  const leftover = block.replace(/\s*"([a-z0-9_]+)"\s*,?/g, (_, name) => {
    upstreamNames.push(name);
    return '';
  }).trim();

  if (leftover !== '') {
    assert.fail(`MCP-TOOLS/PARSE: 上游清单源变了（块内存在非字面量残留内容: ${JSON.stringify(leftover)}）—— 请更新检查器 tests/mcp-tools.test.mjs`);
  }

  if (upstreamNames.length === 0) {
    assert.fail('MCP-TOOLS/PARSE: 上游清单源变了（未解析到任何工具名称）—— 请更新检查器 tests/mcp-tools.test.mjs');
  }

  const isIdentical = upstreamNames.length === MCP_TOOLS.length
    && upstreamNames.every((name, i) => name === MCP_TOOLS[i]);

  if (!isIdentical) {
    const added = upstreamNames.filter((x) => !MCP_TOOLS.includes(x));
    const removed = MCP_TOOLS.filter((x) => !upstreamNames.includes(x));
    assert.fail(`MCP-TOOLS/MISMATCH: 上游=<${upstreamNames.join(', ')}> 本站=<${MCP_TOOLS.join(', ')}>；增：<${added.join(', ') || '无'}>；删：<${removed.join(', ') || '无'}>。改两处：① src/data/mcp-tools.js ② src/content/docs/docs/reference/mcp-clients.md 的 "Tools your agent gets" 表（index/pricing 自动跟随）`);
  }
}

if (isSourceMode) {
  test('src/data/mcp-tools.js defines 25 valid, unique tools matching naming rules', () => {
    assert.equal(Array.isArray(MCP_TOOLS), true, 'MCP_TOOLS must be an array');
    assert.equal(MCP_TOOLS.length, 25, 'MCP_TOOLS must contain exactly 25 tools');
    assert.equal(new Set(MCP_TOOLS).size, 25, 'MCP_TOOLS must not contain duplicate tool names');
    for (const name of MCP_TOOLS) {
      assert.match(name, /^[a-z][a-z0-9_]+$/, `Tool name ${name} must match ^[a-z][a-z0-9_]+$`);
    }
    assert.equal(Object.isFrozen(MCP_TOOLS), true, 'MCP_TOOLS must be frozen');
  });

  test('index.astro uses dynamic MCP_TOOLS.length counter and maps tools', async () => {
    const indexSource = await readFile(INDEX_URL, 'utf8');
    assert.match(indexSource, /import\s*\{\s*MCP_TOOLS\s*\}\s*from\s*['"]\.\.\/data\/mcp-tools\.js['"]/, 'index.astro must import MCP_TOOLS');
    const mcpStatMatch = indexSource.match(/<div class="stat reveal"><div class="n" data-count=([^\s>]+)>0<\/div><div class="l">MCP tools<\/div><\/div>/);
    assert.ok(mcpStatMatch, 'MCP tools stat block must exist in index.astro');
    assert.equal(mcpStatMatch[1], '{MCP_TOOLS.length}', 'MCP tools stat block must use data-count={MCP_TOOLS.length}');
    assert.doesNotMatch(indexSource, /<div class="n" data-count="\d+">\s*0\s*<\/div><div class="l">MCP tools<\/div>/, 'index.astro must not contain hardcoded count for MCP tools');
    assert.match(indexSource, /<h3>MCP tools<\/h3>\s*<ul>\s*\{MCP_TOOLS\.map\(/, 'index.astro must render MCP tools by mapping over MCP_TOOLS');
  });

  test('pricing.astro uses dynamic ({MCP_TOOLS.length} tools) without hardcoded numbers', async () => {
    const pricingSource = await readFile(PRICING_URL, 'utf8');
    assert.match(pricingSource, /import\s*\{\s*MCP_TOOLS\s*\}\s*from\s*['"]\.\.\/data\/mcp-tools\.js['"]/, 'pricing.astro must import MCP_TOOLS');
    assert.ok(pricingSource.includes('({MCP_TOOLS.length} tools)'), 'pricing.astro must include ({MCP_TOOLS.length} tools)');
    assert.doesNotMatch(pricingSource, /\b\d+\s+tools\b/, 'pricing.astro must not contain hardcoded tool counts like "15 tools"');
  });

  test('mcp-clients.md table tool names and order deep-equal MCP_TOOLS', async () => {
    const mcpClientsSource = await readFile(MCP_CLIENTS_URL, 'utf8');
    const heading = '## Tools your agent gets';
    const startIndex = mcpClientsSource.indexOf(heading);
    assert.ok(startIndex !== -1, 'mcp-clients.md must contain "## Tools your agent gets" heading');
    const afterHeading = mcpClientsSource.slice(startIndex + heading.length);
    const tableLines = afterHeading.split(/\r?\n/);
    const tools = [];
    let inTable = false;
    for (const line of tableLines) {
      const trimmed = line.trim();
      if (!inTable) {
        if (trimmed.startsWith('|') && trimmed.includes('Tool') && trimmed.includes('What it does')) {
          inTable = true;
        }
        continue;
      }
      if (trimmed.startsWith('|---') || trimmed.startsWith('|:---')) {
        continue;
      }
      if (!trimmed.startsWith('|')) {
        break;
      }
      const match = /^\|\s*`([^`(]+)(?:\([^`]*\))?`/.exec(trimmed);
      if (match) {
        tools.push(match[1].trim());
      }
    }
    assert.deepEqual(tools, [...MCP_TOOLS], 'mcp-clients.md table tool names and order must deep-equal MCP_TOOLS');
  });

  test('api.md must not restate tool count and must preserve pointer to mcp-clients', async () => {
    const apiSource = await readFile(API_URL, 'utf8');
    assert.doesNotMatch(apiSource, /\b\d+\s+tools?\b/i, 'api.md must not contain tool count restatements (e.g. "15 tools")');
    assert.ok(
      apiSource.includes('[MCP client setup — Tools your agent gets](/docs/reference/mcp-clients/#tools-your-agent-gets)'),
      'api.md must preserve pointer to mcp-clients tool table',
    );
  });

  test('package.json scripts and build hooks are wired for mcp-tools', async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_URL, 'utf8'));
    assert.equal(pkg.scripts['test:mcp-tools'], 'node --test tests/mcp-tools.test.mjs');
    assert.equal(pkg.scripts['test:mcp-tools-rendered'], 'node tests/mcp-tools.test.mjs --check-rendered');
    assert.equal(pkg.scripts['test:mcp-tools-upstream'], 'node tests/mcp-tools.test.mjs --check-upstream');
    assert.ok(pkg.scripts.prebuild?.includes('npm run test:mcp-tools'), 'prebuild must include test:mcp-tools');
    assert.ok(pkg.scripts.prebuild?.includes('npm run test:mcp-tools-upstream'), 'prebuild must include test:mcp-tools-upstream');
    assert.ok(pkg.scripts.postbuild?.includes('npm run test:mcp-tools-rendered'), 'postbuild must include test:mcp-tools-rendered');
  });
}

if (isRenderedMode) {
  test('dist/index.html and dist/pricing/index.html render truthful MCP tool count and list', async () => {
    let indexHtml;
    let pricingHtml;
    try {
      indexHtml = await readFile(DIST_INDEX_URL, 'utf8');
      pricingHtml = await readFile(DIST_PRICING_URL, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        assert.fail(`Built dist files missing (${error.path}): run npm run build first.`);
      }
      throw error;
    }

    const doc = parse(indexHtml);
    const rendered = extractRenderedMcpTools(doc);
    assert.equal(rendered.dataCount, String(MCP_TOOLS.length), `dist/index.html MCP tools stat data-count must be ${MCP_TOOLS.length}`);
    assert.equal(rendered.count, MCP_TOOLS.length, `dist/index.html MCP tools list count must be ${MCP_TOOLS.length}`);
    assert.deepEqual(rendered.names, [...MCP_TOOLS], 'dist/index.html MCP tools list names and order must deep-equal MCP_TOOLS');

    assert.ok(pricingHtml.includes(`(${MCP_TOOLS.length} tools)`), `dist/pricing/index.html must include (${MCP_TOOLS.length} tools)`);
    assert.doesNotMatch(pricingHtml, /\b15\s+tools\b/, 'dist/pricing/index.html must not contain stale "15 tools"');
  });
}

if (isUpstreamMode) {
  test('upstream inventory matches MCP_TOOLS in order with fail-loud diagnostics', async () => {
    await checkUpstream();
  });
}
