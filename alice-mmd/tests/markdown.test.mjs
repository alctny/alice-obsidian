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
      registerDomEvent(element, name, callback, options) {
        element.addEventListener(name, callback, options);
        this.register(() => element.removeEventListener(name, callback));
      }
      unload() { this.onunload(); this.cleanups.forEach(fn => fn()); }
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
  const pointers = new Set();
  const el = {
    classList: { contains: name => classes.has(name) },
    addClass: name => classes.add(name), removeClass: name => classes.delete(name),
    children: [], handlers: {}, options: {}, style: {},
    clientWidth: 400, clientHeight: 200, scrollLeft: 0, scrollTop: 0,
    setPointerCapture: id => pointers.add(id),
    hasPointerCapture: id => pointers.has(id),
    releasePointerCapture: id => pointers.delete(id),
    closest() { return null; },
    replaceChildren(...children) {
      this.children.forEach(child => { child.parentElement = null; });
      for (const child of children) {
        const previous = child.parentElement;
        if (previous) previous.children = previous.children.filter(value => value !== child);
        child.parentElement = this;
      }
      this.children = children;
    },
    createDiv({ cls }) {
      const child = element(); child.addClass(cls); child.parentElement = this;
      this.children.push(child); return child;
    },
    createEl(tag, options) { const child = { tag, ...options }; this.children.push(child); return child; },
    remove() { this.removed = true; },
    addEventListener(name, callback, options) { this.handlers[name] = callback; this.options[name] = options; },
    removeEventListener(name, callback) { if (this.handlers[name] === callback) delete this.handlers[name]; },
    querySelector() {
      if (!this.innerHTML?.match(/<(svg|iframe)/)) return null;
      this.graphic ??= { style: {}, getBoundingClientRect: () => ({ width: 400, height: 200 }) };
      return this.graphic;
    },
    getBoundingClientRect() {
      const parent = this.parentElement;
      const width = parseFloat(this.style.width) || 400;
      return { width, height: parseFloat(this.style.height) || 200,
        left: 40 + Math.max(0, ((parent?.clientWidth ?? 400) - width) / 2) - (parent?.scrollLeft ?? 0),
        top: 80 - (parent?.scrollTop ?? 0) };
    },
    ownerDocument: { body: { classList: { contains: () => true } },
      defaultView: { requestAnimationFrame: () => 1, cancelAnimationFrame() {},
        ResizeObserver: class {
          constructor(callback) { this.callback = callback; }
          observe(target) { target.observer = this; }
          disconnect() { this.disconnected = true; }
        },
      },
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
    return { svg: '<svg/>', bindFunctions(target) { bound = el.children[0].children[0] === target; } };
  }, workspace);
  child.onload();
  await child.refresh();
  assert.equal(child.viewport.children[0].innerHTML, '<svg/>');
  assert.equal(bound, true);
});

test('unloading prevents pending renders from replacing removed widgets', async () => {
  const el = element();
  let finish, staging;
  const child = new (load().Block)(el, 'graph TD', (_source, target) => {
    staging = target;
    return new Promise(resolve => { finish = resolve; });
  }, workspace);
  child.onload();
  const pending = child.refresh();
  child.unload();
  finish({ svg: '<svg/>', bindFunctions() { assert.fail('stale callback'); } });
  await pending;
  assert.equal(staging.innerHTML, undefined);
  assert.equal(staging.removed, true);
  assert.deepEqual(Object.keys(child.viewport.handlers), []);
  assert.equal(el.observer.disconnected, true);
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
  assert.equal(child.viewport.children[0].text, '<invalid syntax>');
  fail = false;
  await child.refresh();
  assert.equal(child.viewport.children[0].innerHTML, '<svg/>');
});

async function renderedBlock() {
  const child = new (load().Block)(element(), 'graph TD\nA --> B', async () => ({ svg: '<svg/>' }), workspace);
  child.onload();
  await child.refresh();
  return child;
}

function inputEvent(values = {}) {
  return { clientX: 140, clientY: 130, deltaY: -Math.log(2) / 0.002, deltaMode: 0,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
}

function pointerEvent(values = {}) {
  return inputEvent({ pointerId: 7, pointerType: 'mouse', button: 0, target: element(), ...values });
}

test('Markdown dragging pans only its viewport and suppresses the click after a drag', async () => {
  const child = await renderedBlock();
  const other = await renderedBlock();
  child.setZoom(2);
  const viewport = child.viewport;
  const start = pointerEvent();
  viewport.handlers.pointerdown(start);
  assert.equal(viewport.hasPointerCapture(7), true);
  viewport.handlers.pointermove(pointerEvent({ pointerId: 8, clientX: 100 }));
  assert.equal(viewport.scrollLeft, 0);
  const move = pointerEvent({ clientX: 100, clientY: 100 });
  viewport.handlers.pointermove(move);
  assert.equal(viewport.scrollLeft, 40);
  assert.equal(viewport.scrollTop, 30);
  assert.equal(viewport.classList.contains('is-panning'), true);
  assert.equal(move.prevented, true);
  assert.equal(move.stopped, true);
  assert.equal(other.viewport.scrollLeft, 0);
  assert.equal(other.viewport.scrollTop, 0);
  assert.equal(viewport.style.height, '200px');
  assert.equal(child.zoom, 2);
  assert.equal(child.source, 'graph TD\nA --> B');
  viewport.handlers.pointerup(start);
  assert.equal(child.drag, null);
  assert.equal(viewport.hasPointerCapture(7), false);
  assert.equal(viewport.classList.contains('is-panning'), false);
  const click = inputEvent();
  viewport.handlers.click(click);
  assert.equal(click.prevented, true);
  assert.equal(click.stopped, true);
  const nextClick = inputEvent();
  viewport.handlers.click(nextClick);
  assert.equal(nextClick.prevented, undefined);
});

test('Markdown small movements preserve clicks and double-click editing; controls and touch keep native behavior', async () => {
  const child = await renderedBlock();
  const viewport = child.viewport;
  const event = pointerEvent();
  viewport.handlers.pointerdown(event);
  viewport.handlers.pointermove(pointerEvent({ clientX: 142 }));
  viewport.handlers.pointerup(event);
  const click = inputEvent();
  viewport.handlers.click(click);
  assert.equal(click.prevented, undefined);
  assert.equal(viewport.scrollLeft, 0);
  assert.equal(viewport.classList.contains('is-panning'), false);

  for (const values of [{ button: 2 }, { pointerType: 'touch' },
    { target: { closest: () => ({}) } }]) {
    const ignored = pointerEvent(values);
    viewport.handlers.pointerdown(ignored);
    assert.equal(child.drag, null);
    assert.equal(viewport.hasPointerCapture(7), false);
    assert.equal(ignored.prevented, undefined);
  }

  const runtime = load();
  let selection, focused = false;
  const plugin = { app: { workspace }, addChild() {} };
  const widget = runtime.extension(plugin, () => {}, () => {}).create(state())[0].widget;
  const dom = widget.toDOM({ dom: element(), requestMeasure() {},
    dispatch(value) { selection = value.selection.anchor; }, focus() { focused = true; } });
  dom.handlers.dblclick();
  assert.equal(selection, text.indexOf('```mermaid'));
  assert.equal(focused, true);
});

test('Markdown cancellation, lost capture, rerender, errors and unload end active drags', async () => {
  for (const finish of ['pointercancel', 'lostpointercapture', 'refresh', 'error', 'unload']) {
    const child = await renderedBlock();
    const viewport = child.viewport;
    viewport.handlers.pointerdown(pointerEvent());
    viewport.handlers.pointermove(pointerEvent({ clientX: 100 }));
    if (finish === 'refresh') await child.refresh();
    else if (finish === 'error') {
      child.render = async () => { throw new Error('syntax'); };
      await child.refresh();
    } else if (finish === 'unload') child.unload();
    else viewport.handlers[finish](pointerEvent());
    assert.equal(child.drag, null, finish);
    assert.equal(viewport.hasPointerCapture(7), false, finish);
    assert.equal(viewport.classList.contains('is-panning'), false, finish);
  }
});

test('Markdown wheel zoom anchors the diagram without changing the note layout or source', async () => {
  const child = await renderedBlock();
  const viewport = child.viewport;
  assert.equal(viewport.options.wheel.passive, false);
  const event = inputEvent();
  viewport.handlers.wheel(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(child.zoom, 2);
  assert.equal(child.diagramEl.style.width, '800px');
  assert.equal(child.diagramEl.style.height, '400px');
  assert.equal(viewport.style.height, '200px');
  assert.equal(viewport.scrollLeft, 100);
  assert.equal(viewport.scrollTop, 50);
  assert.equal(child.source, 'graph TD\nA --> B');
  assert.equal(child.diagramEl.graphic.style.maxWidth, 'none');

  // Chromium delivers touchpad pinches as Ctrl+wheel events.
  viewport.handlers.wheel(inputEvent({ ctrlKey: true, deltaY: Math.log(2) / 0.002 }));
  assert.equal(child.zoom, 1);
  assert.equal(viewport.scrollLeft, 0);
  assert.equal(viewport.scrollTop, 0);
});

test('wheel units and zoom limits match the standalone Mermaid preview, independently per block', async () => {
  const first = await renderedBlock();
  const second = await renderedBlock();
  first.viewport.handlers.wheel(inputEvent({ deltaMode: 1, deltaY: -1 }));
  assert.equal(first.zoom, Math.exp(16 * 0.002));
  second.viewport.handlers.wheel(inputEvent({ deltaMode: 2, deltaY: -1 }));
  assert.equal(second.zoom, Math.exp(200 * 0.002));
  first.viewport.handlers.wheel(inputEvent({ deltaY: -100000 }));
  assert.equal(first.zoom, 20);
  first.viewport.handlers.wheel(inputEvent({ deltaY: 100000 }));
  assert.equal(first.zoom, 0.05);
  assert.equal(second.zoom, Math.exp(200 * 0.002));
});

test('two-finger touch pinches scale around the midpoint and release on end or cancellation', async () => {
  const child = await renderedBlock();
  const viewport = child.viewport;
  const touches = (left, right) => [{ clientX: left, clientY: 180 }, { clientX: right, clientY: 180 }];
  const single = inputEvent({ touches: touches(190, 290).slice(0, 1) });
  viewport.handlers.touchstart(single);
  viewport.handlers.touchmove(single);
  assert.equal(single.prevented, undefined);
  assert.equal(child.zoom, 1);
  for (const end of ['touchend', 'touchcancel']) {
    child.setZoom(1);
    viewport.scrollLeft = viewport.scrollTop = 0;
    const start = inputEvent({ touches: touches(190, 290) });
    viewport.handlers.touchstart(start);
    assert.equal(start.prevented, true);
    const move = inputEvent({ touches: touches(140, 340) });
    viewport.handlers.touchmove(move);
    assert.equal(child.zoom, 2);
    assert.equal(viewport.scrollLeft, 200);
    assert.equal(viewport.scrollTop, 100);
    assert.equal(move.stopped, true);
    viewport.handlers[end](inputEvent({ touches: [] }));
    viewport.handlers.touchmove(inputEvent({ touches: touches(40, 440) }));
    assert.equal(child.zoom, 2);
    assert.equal(child.pinch, null);
  }
});

test('theme and width refreshes preserve the block zoom and notify Live Preview about layout', async () => {
  const child = await renderedBlock();
  child.setZoom(2);
  await child.refresh();
  assert.equal(child.zoom, 2);
  assert.equal(child.diagramEl.style.width, '800px');
  const resized = new Promise(resolve => { child.onRendered = resolve; });
  child.containerEl.clientWidth = 300;
  child.containerEl.observer.callback();
  await resized;
  assert.equal(child.zoom, 2);
  assert.equal(child.diagramEl.style.width, '800px');
});

test('Markdown height limits update existing blocks without rerendering or changing zoom', async () => {
  let height = 100, renders = 0, measures = 0;
  const listeners = new Map();
  const child = new (load().Block)(element(), 'graph TD\nA --> B', async () => {
    renders++;
    return { svg: '<svg/>' };
  }, { on(name, callback) { listeners.set(name, callback); } },
  () => { measures++; }, () => height);
  child.onload();
  await child.refresh();
  child.setZoom(2);
  assert.equal(child.viewport.style.height, '200px');
  assert.equal(child.viewport.style.maxHeight, '100px');
  for (const limit of [500, 0, 120]) {
    height = limit;
    const before = measures;
    listeners.get('alice-mmd:settings-change')();
    assert.equal(child.viewport.style.maxHeight, limit ? `${limit}px` : '');
    assert.equal(child.viewport.style.height, '200px');
    assert.equal(child.diagramEl.style.height, '400px');
    assert.equal(child.zoom, 2);
    assert.equal(renders, 1);
    assert.equal(measures, before + 1);
  }
  await child.refresh();
  assert.equal(child.viewport.style.maxHeight, '120px');
  assert.equal(child.zoom, 2);
  const unlimited = await renderedBlock();
  assert.equal(unlimited.viewport.style.maxHeight, '');
});

test('Live Preview widgets read the current plugin height limit and request layout measurement', () => {
  const runtime = load();
  const listeners = new Map();
  let child, measures = 0;
  const plugin = {
    settings: { markdownMaxHeight: 150 },
    app: { workspace: { on(name, callback) { listeners.set(name, callback); } } },
    addChild(value) { child = value; child.onload(); },
  };
  const widget = runtime.extension(plugin, () => {}, () => {}).create(state())[0].widget;
  widget.toDOM({ dom: element(), requestMeasure() { measures++; } });
  assert.equal(child.viewport.style.maxHeight, '150px');
  plugin.settings.markdownMaxHeight = 0;
  listeners.get('alice-mmd:settings-change')();
  assert.equal(child.viewport.style.maxHeight, '');
  assert.equal(measures, 1);
});

test('unrendered and failed diagrams leave wheel scrolling available', async () => {
  const child = new (load().Block)(element(), 'invalid', async () => { throw new Error('syntax'); }, workspace);
  child.onload();
  for (const rendered of [false, true]) {
    if (rendered) await child.refresh();
    const event = inputEvent();
    child.viewport.handlers.wheel(event);
    assert.equal(event.prevented, undefined);
    assert.equal(child.zoom, 1);
  }
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
