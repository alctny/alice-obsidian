import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { mermaidBlocks } from '../src/blocks.js';

const source = await readFile(new URL('../src/markdown.js', import.meta.url), 'utf8');
const livePreview = Symbol('livePreview');
function load() {
  const context = vm.createContext({
    mermaidBlocks, editorLivePreviewField: livePreview,
    MarkdownRenderChild: class {
      constructor(element) { this.containerEl = element; this.cleanups = []; }
      registerEvent() {}
      register(fn) { this.cleanups.push(fn); }
    },
    Prec: { highest: value => value }, StateField: { define: value => value },
    EditorView: { decorations: { from: field => field } }, WidgetType: class {},
    Decoration: {
      none: [], set: value => value,
      replace: spec => ({ range: (from, to) => ({ from, to, ...spec }) }),
    },
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '') +
    '\nthis.Block = MermaidBlock; this.extension = livePreviewExtension;', context);
  return context;
}
const text = '# Heading\n```mermaid\n---\nconfig:\n  layout: elk\n---\nflowchart TD\nA --> B\n```\nTail';
function state(source = text, cursor = 0, live = true) {
  return { doc: { toString: () => source }, selection: { ranges: [{ from: cursor, to: cursor }] },
    field(key) { assert.equal(key, livePreview); return live; } };
}

test('Live Preview replaces only Mermaid fences, preserving frontmatter and surrounding text', () => {
  const runtime = load();
  const field = runtime.extension({}, () => {}, () => {});
  const [range] = field.create(state());
  assert.equal(range.from, text.indexOf('```mermaid'));
  assert.equal(range.to, text.indexOf('\nTail'));
  assert.match(range.widget.source, /^---\nconfig:\n  layout: elk/);
  assert.equal(range.block, true);
  assert.equal(field.create(state('```text\n```mermaid\nA --> B\n```\n```')).length, 0);
  assert.equal(field.create(state('```mermaid\nA --> B')).length, 0);
});

test('cursor entry reveals source and Source mode leaves all fences editable', () => {
  const field = load().extension({}, () => {}, () => {});
  const original = field.create(state());
  assert.equal(original.length, 1);
  assert.equal(field.create(state(text, text.indexOf('A --> B'))).length, 0);
  assert.equal(field.create(state(text, 0, false)).length, 0);
  assert.equal(field.update(original, { selection: true, state: state(text, 15) }).length, 0);
  assert.equal(field.update(original, { state: state() }), original);
});

function element() {
  const classes = new Set();
  const el = {
    classList: { contains: name => classes.has(name) },
    addClass: name => classes.add(name), removeClass: name => classes.delete(name),
    children: [], handlers: {},
    replaceChildren(...children) { this.children = children; },
    createDiv({ cls }) { const child = element(); child.addClass(cls); this.children.push(child); return child; },
    createEl(tag, options) { const child = { tag, ...options }; this.children.push(child); return child; },
    remove() { this.removed = true; },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    ownerDocument: { body: { classList: { contains: () => true } },
      defaultView: { requestAnimationFrame: () => 1, cancelAnimationFrame() {} },
      createElement: () => element(),
    },
  };
  return el;
}
const workspace = { on() {} };

test('Markdown blocks use the shared renderer and bind interactions after insertion', async () => {
  const el = element();
  let bound = false;
  const child = new (load().Block)(el, 'flowchart TD\nA --> B', async (source, container, dark, current) => {
    assert.equal(source, 'flowchart TD\nA --> B');
    assert.equal(dark, true);
    assert.equal(current(), true);
    assert.ok(el.children.includes(container));
    return { svg: '<svg/>', bindFunctions(target) { bound = el.children[0] === target; } };
  }, workspace);
  child.onload();
  await child.refresh();
  assert.equal(el.children[0].innerHTML, '<svg/>');
  assert.equal(bound, true);
});

test('unloading prevents pending renders from replacing removed widgets', async () => {
  const el = element();
  let finish;
  const child = new (load().Block)(el, 'graph TD', () => new Promise(resolve => { finish = resolve; }), workspace);
  child.onload();
  const pending = child.refresh();
  child.onunload();
  finish({ svg: '<svg/>', bindFunctions() { assert.fail('stale callback'); } });
  await pending;
  assert.equal(el.children[0].innerHTML, undefined);
  assert.equal(el.children[0].removed, true);
});

test('syntax errors appear as text and subsequent theme refresh can recover', async () => {
  const el = element();
  let fail = true;
  const child = new (load().Block)(el, 'invalid', async () => {
    if (fail) throw new Error('<invalid syntax>');
    return { svg: '<svg/>' };
  }, workspace);
  child.onload();
  await child.refresh();
  assert.equal(el.children[0].text, '<invalid syntax>');
  fail = false;
  await child.refresh();
  assert.equal(el.children[0].innerHTML, '<svg/>');
});

test('Live Preview widget teardown unloads the child even when an equivalent widget reuses its DOM', () => {
  const runtime = load();
  let added, removed, menuOffset;
  const plugin = { app: { workspace }, addChild(child) { added = child; }, removeChild(child) { removed = child; } };
  const field = runtime.extension(plugin, () => {}, (_event, _view, from) => { menuOffset = from; });
  const first = field.create(state())[0].widget;
  const second = field.create(state())[0].widget;
  assert.equal(first.eq(second), true);
  const view = { dom: element(), requestMeasure() {} };
  const dom = first.toDOM(view);
  dom.handlers.contextmenu({});
  assert.equal(menuOffset, text.indexOf('```mermaid'));
  second.destroy(dom);
  assert.equal(removed, added);
});
