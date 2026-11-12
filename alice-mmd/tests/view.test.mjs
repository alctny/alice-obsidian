import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { translate } from '../src/i18n.js';
import { MermaidOutline, sourcePosition } from '../src/outline.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
function load(language = 'zh-TW') {
  const timers = new Map();
  let nextTimer = 0;
  const context = vm.createContext({
    MermaidOutline, sourcePosition, addIcon() {}, setIcon(element, icon) { element.icon = icon; },
    translate, getLanguage: () => language,
    Plugin: class { registerEvent() {} }, TextFileView: class {},
    TFolder: class { constructor(path) { this.path = path; } },
    normalizePath: path => path.replace(/\\/g, '/'),
    Notice: class { constructor(message) { throw new Error(message); } },
    mermaid: { initialize() {}, registerLayoutLoaders() {} }, elkLayouts: [],
    createRenderer: () => async () => ({ svg: '<svg/>' }), parseYaml() {},
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(main.replace(/^import .*;\n/gm, '')
    .replace('export default class AliceMmdPlugin', 'class AliceMmdPlugin') +
    '\nthis.View = MermaidView; this.PluginClass = AliceMmdPlugin;', context);
  return { View: context.View, PluginClass: context.PluginClass, TFolder: context.TFolder, timers };
}

test('file data replacement updates source and supersedes pending renders', () => {
  const { View, timers } = load();
  const view = new View();
  view.editor = { value: '' };
  view.setViewData('first', true);
  view.setViewData('second', false);
  assert.equal(view.getViewData(), 'second');
  assert.equal(view.editor.value, 'second');
  assert.equal(timers.size, 1);
  assert.equal(view.revision, 2);
});

test('clearing a file cancels rendering and clears both panes', () => {
  const { View, timers } = load();
  const view = new View();
  view.editor = { value: 'old' };
  let cleared = false;
  view.preview = { replaceChildren() { cleared = true; } };
  view.errorEl = { hidden: false };
  view.setViewData('old', true);
  view.clear();
  assert.equal(view.getViewData(), '');
  assert.equal(view.editor.value, '');
  assert.equal(view.errorEl.hidden, true);
  assert.equal(cleared, true);
  assert.equal(timers.size, 0);
});

test('closing a view invalidates in-flight work and cancels its timer', async () => {
  const { View, timers } = load();
  const view = new View();
  view.scheduleRender();
  const revision = view.revision;
  await view.onClose();
  assert.equal(view.closed, true);
  assert.ok(view.revision > revision);
  assert.equal(timers.size, 0);
});

test('registers a dedicated .mmd view and a create-file command', async () => {
  const { View, PluginClass } = load();
  const plugin = new PluginClass();
  plugin.app = { workspace: { onLayoutReady() {}, getLeavesOfType() { return []; }, on() {} } };
  let factory;
  plugin.registerView = (type, callback) => {
    assert.equal(type, 'alice-mmd'); factory = callback;
  };
  plugin.registerExtensions = (extensions, type) => {
    assert.deepEqual(Array.from(extensions), ['mmd']); assert.equal(type, 'alice-mmd');
  };
  const commands = [];
  plugin.addCommand = (command) => { commands.push(command.id); };
  await plugin.onload();
  assert.ok(factory({}) instanceof View);
  assert.deepEqual(commands, ['reset-zoom', 'create-mmd']);
});

function element() {
  return {
    handlers: {}, style: {}, attributes: {}, value: '', captures: new Set(),
    ownerDocument: { defaultView: { ResizeObserver: class { observe() {} disconnect() { this.disconnected = true; } } } },
    clientWidth: 400, clientHeight: 300, clientLeft: 0, clientTop: 0,
    scrollLeft: 100, scrollTop: 50,
    addClass() {}, removeClass() {}, replaceChildren() {},
    closest() { return null; },
    setPointerCapture(id) { this.captures.add(id); },
    hasPointerCapture(id) { return this.captures.has(id); },
    releasePointerCapture(id) { this.captures.delete(id); },
    createSpan: (options = {}) => Object.assign(element(), { textContent: options.text, attributes: options.attr ?? {} }),
    createDiv: (options = {}) => Object.assign(element(), { attributes: options.attr ?? {} }),
    createEl: (_tag, options = {}) => Object.assign(element(), { textContent: options.text, attributes: options.attr ?? {} }),
    addEventListener(name, callback, options) { this.handlers[name] = { callback, options }; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; },
    getBoundingClientRect() { return { left: 10, top: 20 }; },
  };
}

async function openView(runtime = load()) {
  const { View } = runtime;
  const view = new View();
  view.contentEl = element();
  view.app = { workspace: { onLayoutReady() {}, getLeavesOfType() { return []; }, on() {} } };
  view.registerEvent = () => {};
  await view.onOpen();
  return view;
}

test('double-click enters editing and repeated double-click keeps editing', async () => {
  const view = await openView();
  assert.equal(view.editor.hidden, true);
  view.preview.handlers.dblclick.callback();
  assert.equal(view.editor.hidden, false);
  assert.equal(view.canvas.hidden, true);
  assert.equal(view.zoomControls.hidden, true);
  assert.equal(view.errorEl.hidden, true);
  assert.equal(view.toggle.attributes['aria-pressed'], 'true');
  assert.equal(view.editor.focused, true);
  assert.equal(view.toggle.attributes['aria-expanded'], 'true');
  view.preview.handlers.dblclick.callback();
  assert.equal(view.editing, true);
  view.toggle.handlers.click.callback();
  assert.equal(view.editing, false);
  assert.equal(view.canvas.hidden, false);
  assert.equal(view.zoomControls.hidden, false);
  assert.equal(view.editor.hidden, true);
});

test('zoom resizes the canvas and keeps the cursor point anchored', async () => {
  const view = await openView();
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  view.setZoom(2, { x: 50, y: 80 });
  assert.equal(view.diagramEl.style.width, '1600px');
  assert.equal(view.diagramEl.style.height, '1200px');
  assert.equal(view.preview.scrollLeft, 250);
  assert.equal(view.preview.scrollTop, 180);
  assert.equal(view.zoomReset.textContent, '200%');
  assert.equal(view.getViewData(), '');
  view.setZoom(100);
  assert.equal(view.zoom, 20);
  view.setZoom(0);
  assert.equal(view.zoom, 0.05);
  view.zoomReset.handlers.click.callback();
  assert.equal(view.zoom, 1);
});

test('wheel events zoom only the diagram and prevent page scrolling', async () => {
  const view = await openView();
  const wheel = view.preview.handlers.wheel;
  assert.equal(wheel.options.passive, false);
  let prevented = false;
  const event = {
    clientX: 60, clientY: 100, deltaY: -100, deltaMode: 0,
    preventDefault() { prevented = true; },
  };
  wheel.callback(event);
  assert.equal(prevented, false);
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  wheel.callback(event);
  assert.equal(prevented, true);
  assert.ok(view.zoom > 1);
  const zoom = view.zoom;
  wheel.callback({ ...event, deltaY: 100 });
  assert.ok(view.zoom < zoom);
});


test('dragging pans the viewport, updates the map, and releases pointer capture', async () => {
  const view = await openView();
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  const event = { pointerId: 7, button: 0, clientX: 150, clientY: 120,
    target: element(), preventDefault() {}, stopPropagation() {} };
  view.preview.handlers.pointerdown.callback(event);
  assert.equal(view.preview.hasPointerCapture(7), true);
  view.preview.handlers.pointermove.callback({ ...event, clientX: 110, clientY: 90 });
  assert.equal(view.preview.scrollLeft, 140);
  assert.equal(view.preview.scrollTop, 80);
  assert.equal(view.miniMap.hidden, false);
  view.preview.handlers.pointerup.callback(event);
  assert.equal(view.drag, null);
  assert.equal(view.preview.hasPointerCapture(7), false);
  let suppressed = false;
  view.preview.handlers.click.callback({ preventDefault() { suppressed = true; }, stopPropagation() {} });
  assert.equal(suppressed, true);
});

test('small pointer movements preserve double-click and interactive elements skip panning', async () => {
  const view = await openView();
  view.diagramEl = element();
  const event = { pointerId: 3, button: 0, clientX: 100, clientY: 100,
    target: element(), preventDefault() {} };
  view.preview.handlers.pointerdown.callback(event);
  view.preview.handlers.pointermove.callback({ ...event, clientX: 102 });
  assert.equal(view.preview.scrollLeft, 100);
  view.preview.handlers.pointercancel.callback(event);
  assert.equal(view.suppressClick, false);
  view.preview.handlers.pointerdown.callback({ ...event, target: { closest() { return {}; } } });
  assert.equal(view.drag, null);
});

test('minimap appears only for overflow, tracks scroll and responds to resizing', async () => {
  const view = await openView();
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  view.updateMiniMap();
  assert.equal(view.miniMap.hidden, false);
  assert.equal(view.miniMap.style.width, '160px');
  assert.equal(view.mapViewport.style.width, '80px');
  assert.equal(view.mapViewport.style.left, '20px');
  view.preview.scrollLeft = 200;
  view.preview.handlers.scroll.callback();
  assert.equal(view.mapViewport.style.left, '40px');
  view.preview.clientWidth = 1000;
  view.preview.clientHeight = 700;
  view.updateMiniMap();
  assert.equal(view.miniMap.hidden, true);
  view.preview.clientWidth = 400;
  view.updateMiniMap();
  assert.equal(view.miniMap.hidden, false);
  view.clear();
  assert.equal(view.miniMap.hidden, true);
});

test('clicking and dragging the minimap navigates the visible region', async () => {
  const view = await openView();
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  view.updateMiniMap();
  const event = { pointerId: 4, button: 0, clientX: 110, clientY: 80, preventDefault() {} };
  view.miniMap.handlers.pointerdown.callback(event);
  assert.equal(view.preview.scrollLeft, 300);
  assert.equal(view.preview.scrollTop, 150);
  view.miniMap.handlers.pointermove.callback({ ...event, clientX: 120 });
  assert.equal(view.preview.scrollLeft, 350);
  view.miniMap.handlers.pointerup.callback(event);
  assert.equal(view.miniMap.hasPointerCapture(4), false);
  await view.onClose();
  assert.equal(view.resizeObserver.disconnected, true);
});


test('editing cancels pending preview work and renders latest source when returning', async () => {
  const view = await openView();
  view.errorEl.textContent = 'previous error';
  view.errorEl.hidden = false;
  view.setEditing(true);
  view.editor.value = 'flowchart TD\n A-->C';
  let saved = false;
  view.requestSave = () => { saved = true; };
  view.editor.handlers.input.callback();
  assert.equal(saved, true);
  assert.equal(view.getViewData(), 'flowchart TD\n A-->C');
  assert.equal(view.errorEl.hidden, true);
  // Hidden preview must not be measured or rendered while the editor is active.
  view.preview.createDiv = () => { throw new Error('hidden preview rendered'); };
  await view.renderDiagram(view.revision);
  view.setEditing(false);
  assert.equal(view.canvas.hidden, false);
  assert.equal(view.zoomControls.hidden, false);
  assert.equal(view.errorEl.hidden, true);
  assert.ok(view.timer);
});


test('Mod+0 resets only the active Mermaid preview and checking does not change zoom', async () => {
  const { View, PluginClass } = load();
  const view = new View();
  view.zoom = 2.5;
  const plugin = new PluginClass();
  let active = view;
  plugin.app = { workspace: { onLayoutReady() {}, getLeavesOfType() { return []; }, on() {}, getActiveViewOfType(type) {
    assert.equal(type, View);
    return active;
  } } };
  plugin.registerView = () => {};
  plugin.registerExtensions = () => {};
  let command;
  plugin.addCommand = (value) => { if (value.id === 'reset-zoom') command = value; };
  await plugin.onload();
  assert.equal(command.hotkeys[0].key, '0');
  assert.deepEqual(Array.from(command.hotkeys[0].modifiers), ['Mod']);
  assert.equal(command.checkCallback(true), true);
  assert.equal(view.zoom, 2.5);
  assert.equal(command.checkCallback(false), true);
  assert.equal(view.zoom, 1);
  view.zoom = 3;
  view.editing = true;
  assert.equal(command.checkCallback(false), false);
  assert.equal(view.zoom, 3);
  active = null;
  assert.equal(command.checkCallback(false), false);
});


test('minimap auto-hides after idle and reappears on viewport interaction', async () => {
  const runtime = load();
  const view = await openView(runtime);
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  view.updateMiniMap();
  assert.equal(view.miniMap.hidden, false);
  const firstTimer = view.miniMapTimer;
  view.preview.handlers.scroll.callback();
  assert.equal(runtime.timers.has(firstTimer), false);
  runtime.timers.get(view.miniMapTimer)();
  assert.equal(view.miniMap.hidden, true);
  view.setZoom(2);
  assert.equal(view.miniMap.hidden, false);
  view.miniMap.handlers.pointerenter.callback();
  assert.equal(runtime.timers.has(view.miniMapTimer), false);
  view.updateMiniMap();
  assert.equal(runtime.timers.has(view.miniMapTimer), false);
  view.miniMap.handlers.pointerleave.callback();
  assert.equal(runtime.timers.has(view.miniMapTimer), true);
  await view.onClose();
  assert.equal(runtime.timers.has(view.miniMapTimer), false);
});

test('minimap stays visible while dragging outside its bounds', async () => {
  const runtime = load();
  const view = await openView(runtime);
  view.diagramEl = element();
  view.diagramSize = { width: 800, height: 600 };
  view.updateMiniMap();
  const event = { pointerId: 4, button: 0, clientX: 110, clientY: 80, preventDefault() {} };
  view.miniMap.handlers.pointerdown.callback(event);
  view.miniMap.handlers.pointerleave.callback();
  assert.equal(view.mapDragging, true);
  assert.equal(runtime.timers.has(view.miniMapTimer), false);
  view.miniMap.handlers.pointerup.callback(event);
  assert.equal(view.mapDragging, false);
  assert.equal(runtime.timers.has(view.miniMapTimer), true);
  view.setEditing(true);
  assert.equal(view.miniMap.hidden, true);
  assert.equal(runtime.timers.has(view.miniMapTimer), false);
});


test('context menu creates Mermaid files in the selected folder or file parent without overwriting', async () => {
  const { PluginClass, TFolder } = load();
  const plugin = new PluginClass();
  let fileMenu;
  let opened;
  let created;
  const existing = new Set(['diagrams/未命名.mmd', 'diagrams/未命名 1.mmd']);
  plugin.app = {
    workspace: { onLayoutReady() {}, getLeavesOfType() { return []; },
      on(name, callback) { if (name === 'file-menu') fileMenu = callback; },
      getLeaf() { return { async openFile(file) { opened = file; } }; },
    },
    vault: {
      getAbstractFileByPath(path) { return existing.has(path); },
      async create(path, data) { created = { path, data }; existing.add(path); return created; },
    },
  };
  plugin.registerView = () => {};
  plugin.registerExtensions = () => {};
  plugin.addCommand = () => {};
  await plugin.onload();
  const folder = new TFolder('diagrams');
  for (const [target, expected] of [
    [folder, 'diagrams/未命名 2.mmd'],
    [{ parent: folder }, 'diagrams/未命名 3.mmd'],
    [new TFolder(''), '未命名.mmd'],
  ]) {
    let click;
    const item = {
      setSection(section) { assert.equal(section, 'action-primary'); return this; },
      setTitle(title) { assert.equal(title, 'New mermaid'); return this; },
      setIcon(icon) { assert.equal(icon, 'alice-mmd-mermaid'); return this; },
      onClick(callback) { click = callback; return this; },
    };
    fileMenu({ addItem(callback) { callback(item); } }, target);
    await click();
    assert.equal(created.path, expected);
    assert.match(created.data, /layout: elk/);
    assert.match(created.data, /flowchart TD/);
    assert.equal(opened, created);
  }
});

test('English UI localizes buttons, accessibility labels, commands, context menu and new file contents', async () => {
  const runtime = load('en');
  const view = await openView(runtime);
  assert.equal(view.toggle.attributes['aria-pressed'], 'false');
  assert.equal(view.editor.attributes['aria-label'], 'Mermaid source');
  assert.equal(view.miniMap.attributes['aria-label'], 'Diagram minimap');
  assert.equal(view.zoomReset.attributes['aria-label'], 'Reset zoom to 100%');
  view.setEditing(true);
  assert.equal(view.toggle.attributes['aria-pressed'], 'true');
  view.setEditing(false);
  assert.equal(view.toggle.attributes['aria-pressed'], 'false');
  const plugin = new runtime.PluginClass();
  let menuCallback;
  let created;
  const commands = [];
  plugin.app = {
    workspace: { onLayoutReady() {}, getLeavesOfType() { return []; },
      on(name, callback) { if (name === 'file-menu') menuCallback = callback; },
      getLeaf() { return { async openFile() {} }; },
    },
    vault: {
      getAbstractFileByPath() { return null; },
      async create(path, data) { created = { path, data }; return created; },
    },
  };
  plugin.registerView = () => {};
  plugin.registerExtensions = () => {};
  plugin.addCommand = command => { commands.push(command.name); };
  await plugin.onload();
  assert.deepEqual(commands, ['Reset zoom', 'New mermaid']);
  let click;
  const item = {
    setSection() { return this; }, setIcon() { return this; },
    setTitle(title) { assert.equal(title, 'New mermaid'); return this; },
    onClick(callback) { click = callback; return this; },
  };
  menuCallback({ addItem(callback) { callback(item); } }, new runtime.TFolder(''));
  await click();
  assert.equal(created.path, 'Untitled.mmd');
  assert.match(created.data, /A\[Start\] --> B\[End\]/);
});


test('one mode button toggles both ways and updates its label, icon and action', async () => {
  const view = await openView(load('en'));
  assert.equal(view.previewMode, undefined);
  assert.equal(view.modeLabel.textContent, 'Preview');
  assert.equal(view.modeIcon.icon, 'alice-mmd-mermaid');
  assert.equal(view.toggle.attributes['aria-label'], 'Source');
  view.toggle.handlers.click.callback();
  assert.equal(view.editing, true);
  assert.equal(view.modeLabel.textContent, 'Source');
  assert.equal(view.modeIcon.icon, 'file-code-2');
  assert.equal(view.toggle.attributes['aria-label'], 'Preview');
  assert.equal(view.canvas.hidden, true);
  view.toggle.handlers.click.callback();
  assert.equal(view.editing, false);
  assert.equal(view.modeLabel.textContent, 'Preview');
  assert.equal(view.modeIcon.icon, 'alice-mmd-mermaid');
  assert.equal(view.editor.hidden, true);
});
