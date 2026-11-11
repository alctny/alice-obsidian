import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/plugin.cjs', import.meta.url), 'utf8');

function setup({ outlineEnabled = true } = {}) {
  const notices = [];
  const entry = { exports: {} };
  runInNewContext(source, {
    module: entry,
    require(id) {
      if (id === 'obsidian') return { Plugin: class {}, Notice: class {
        constructor(message) { notices.push(message); }
      } };
      if (id === './constants.cjs') return { TYPE: 'alice-sidebar' };
      if (id === './view.cjs') return { OpenFilesView: class {} };
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  const leaves = [];
  const revealed = [];
  const tabs = { children: leaves };
  let collapsed = false;
  function addLeaf(type, selected = false) {
    const leaf = {
      selected,
      parent: tabs,
      view: {
        getViewType: () => type,
        containerEl: { isShown: () => leaf.selected && !collapsed },
      },
      async setViewState(state) {
        type = state.type === 'outline' && !outlineEnabled ? 'empty' : state.type;
      },
      detach() { leaves.splice(leaves.indexOf(leaf), 1); },
    };
    leaves.push(leaf);
    return leaf;
  }
  const plugin = new entry.exports();
  const commands = [];
  plugin.registerView = () => {};
  plugin.addCommand = command => commands.push(command);
  plugin.addRibbonIcon = () => {};
  plugin.app = { workspace: {
    activeLeaf: { view: { getViewType: () => 'markdown' } },
    onLayoutReady() {},
    getLeavesOfType: type => leaves.filter(leaf => leaf.view.getViewType() === type),
    getRightLeaf: split => {
      assert.equal(split, false);
      return addLeaf('empty');
    },
    async revealLeaf(leaf) {
      collapsed = false;
      leaves.forEach(item => { item.selected = item === leaf; });
      revealed.push(leaf);
    },
  } };
  return { plugin, commands, leaves, revealed, notices, addLeaf,
    collapse() { collapsed = true; } };
}

test('Option+O alternates existing sidebar tabs while the editor has focus', async () => {
  const { plugin, commands, addLeaf, revealed, leaves } = setup();
  const list = addLeaf('alice-sidebar', true);
  const outline = addLeaf('outline');
  await plugin.onload();
  const command = commands.find(item => item.id === 'toggle-outline-open-files');
  assert.equal(command.hotkeys[0].modifiers.join(), 'Alt');
  assert.equal(command.hotkeys[0].key, 'o');
  await command.callback();
  await command.callback();
  assert.deepEqual(revealed, [outline, list]);
  assert.equal(leaves.length, 2);
  // A mouse selection must override the previous keyboard toggle.
  list.selected = false;
  outline.selected = true;
  await command.callback();
  assert.equal(revealed.at(-1), list);
});

test('cycles dynamically added tabs in group order, including duplicate view types', async () => {
  const { plugin, addLeaf, revealed } = setup();
  const list = addLeaf('alice-sidebar', true);
  const outline = addLeaf('outline');
  const extra = addLeaf('search');
  const duplicate = addLeaf('search');
  for (let i = 0; i < 4; i++) await plugin.togglePanel();
  assert.deepEqual(revealed, [outline, extra, duplicate, list]);
  extra.detach();
  await plugin.togglePanel();
  await plugin.togglePanel();
  assert.equal(revealed.at(-1), duplicate);
});

test('creates the list when it is missing', async () => {
  const { plugin, revealed } = setup();
  await plugin.togglePanel();
  assert.equal(revealed.at(-1).view.getViewType(), 'alice-sidebar');
});

test('expands the list when the sidebar is collapsed', async () => {
  const { plugin, addLeaf, revealed, collapse } = setup();
  const list = addLeaf('alice-sidebar', true);
  addLeaf('outline');
  collapse();
  await plugin.togglePanel();
  assert.equal(revealed.at(-1), list);
  assert.equal(list.view.containerEl.isShown(), true);
});

