import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, readConfig } from '../src/renderer.js';

// Obsidian supplies the YAML parser; JSON is a YAML subset used in these fixtures.
const parseYaml = JSON.parse;
const source = (config) => `---\n${JSON.stringify({ config })}\n---\nflowchart TD\n A-->B`;
const container = () => ({ replaceChildren() {} });

test('passes nested and secure configuration without a whitelist', () => {
  const config = {
    layout: 'elk', theme: 'base', themeVariables: { primaryColor: '#461c89' },
    securityLevel: 'sandbox', maxTextSize: 100000, maxEdges: 900,
    elk: { nodePlacementStrategy: 'NETWORK_SIMPLEX' },
    sequence: { actorMargin: 80 }, futureProperty: { enabled: true },
  };
  assert.deepEqual(readConfig(source(config), parseYaml).config, config);
});

test('normalizes BOM and Windows line endings, preserving title and diagram', () => {
  const input = '\uFEFF---\r\n{"title":"圖表","config":{"layout":"elk"}}\r\n---\r\nflowchart LR\r\n A-->B';
  const result = readConfig(input, parseYaml);
  assert.equal(result.config.layout, 'elk');
  assert.match(result.source, /"title":"圖表"/);
  assert.ok(!result.source.includes('\r'));
});

test('accepts diagrams without frontmatter and empty metadata', () => {
  assert.deepEqual(readConfig('flowchart TD\n A-->B', parseYaml).config, {});
  assert.deepEqual(readConfig('---\nnull\n---\nflowchart TD\n A-->B', parseYaml).config, {});
});

test('accepts empty YAML frontmatter', () => {
  assert.deepEqual(readConfig('---\n---\nflowchart TD\n A-->B', () => null).config, {});
});

test('reports malformed frontmatter and non-object config', () => {
  assert.throws(() => readConfig('---\nconfig:\nflowchart TD', parseYaml), /closing/);
  for (const value of ['dark', [], 42]) {
    assert.throws(() => readConfig(source(value), parseYaml), /config must/);
  }
  assert.throws(() => readConfig('---\n[]\n---\nflowchart TD', parseYaml), /Frontmatter must/);
  assert.throws(() => readConfig('---\n{broken\n---\nflowchart TD', parseYaml));
});

test('serializes initialization with rendering and resets document defaults', async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const mermaid = {
    initialize(config) { events.push(config); },
    async render(id) { events.push(id); if (id.endsWith('-1')) await gate; return { svg: id }; },
  };
  const render = createRenderer(mermaid, parseYaml);
  const first = render(source({ theme: 'base', maxTextSize: 99999 }), container(), true);
  const second = render('flowchart TD\n A-->B', container(), false);
  await Promise.resolve();
  assert.equal(events.length, 2);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events[2], { startOnLoad: false, theme: 'default' });
  assert.equal(events[0].maxTextSize, 99999);
  assert.equal(events[3], 'alice-mmd-2');
});

test('render failures do not block subsequent documents', async () => {
  let count = 0;
  let cleaned = false;
  const render = createRenderer({
    initialize() {},
    async render() { if (++count === 1) throw new Error('invalid diagram'); return { svg: '<svg/>' }; },
  }, parseYaml);
  await assert.rejects(render('bad', { replaceChildren() { cleaned = true; } }, true), /invalid/);
  assert.equal(cleaned, true);
  assert.deepEqual(await render('valid', container(), true), { svg: '<svg/>' });
});

test('skips queued renders superseded by edits or a closed view', async () => {
  const render = createRenderer({ initialize() { throw new Error('must not run'); } }, parseYaml);
  assert.equal(await render('unused', container(), false, () => false), null);
});

test('captures diagram objects before rendering so callback bindings use the final parser state', async () => {
  const events = [];
  const render = createRenderer({
    initialize() {},
    mermaidAPI: { async getDiagramFromText() {
      events.push('objects');
      return { type: 'flowchart', db: { getVertices: () => new Map([['A', { text: 'Start' }]]) } };
    } },
    async render() { events.push('render'); return { svg: '<svg/>' }; },
  }, parseYaml);
  const result = await render('flowchart TD\n A[Start]', container(), false);
  assert.deepEqual(events, ['objects', 'render']);
  assert.equal(result.outlineObjects[0].label, 'Start');
});
