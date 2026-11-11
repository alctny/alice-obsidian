import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/view.cjs', import.meta.url), 'utf8');
const { CUP, POT, icon } = require('../src/icons.cjs');

class Events {
  refs = new Set();
  on(name, callback) {
    const ref = { name, callback };
    this.refs.add(ref);
    return ref;
  }
  offref(ref) { this.refs.delete(ref); }
  trigger(name, ...args) {
    for (const ref of [...this.refs]) if (ref.name === name) ref.callback(...args);
  }
}

class Element {
  children = [];
  attributes = {};
  createDiv(options) { return this.createEl('div', options); }
  createEl(tag, options) {
    const child = Object.assign(new Element(), options, { tag });
    this.children.push(child);
    return child;
  }
  addClass() {}
  toggleClass() {}
  addEventListener() {}
  setAttribute(name, value) { this.attributes[name] = value; }
  empty() { this.children = []; }
  querySelector() { return null; }
}

async function setup() {
  const workspace = Object.assign(new Events(), {
    leaves: [],
    iterateRootLeaves(callback) {
      for (const leaf of this.leaves) if (callback(leaf)) break;
    },
    getMostRecentLeaf() { return this.leaves[0]; },
  });
  function addLeaf() {
    const leaf = Object.assign(new Events(), {
      pinned: false,
      view: { getDisplayText: () => 'Note' },
      getViewState() { return { pinned: this.pinned }; },
      setPinned(pinned) {
        this.pinned = pinned;
        // Native pin shortcuts emit this event without a layout or focus change.
        this.trigger('pinned-change', pinned);
      },
    });
    workspace.leaves.push(leaf);
    return leaf;
  }
  const leaf = addLeaf();
  const entry = { exports: {} };
  runInNewContext(source, {
    module: entry,
    require(id) {
      if (id === 'obsidian') return { ItemView: class {
        contentEl = new Element();
        app = { workspace, vault: new Events() };
        registerEvent() {}
      } };
      return require('../src/' + id);
    },
  });
  const view = new entry.exports.OpenFilesView();
  await view.onOpen();
  return { view, workspace, leaf, addLeaf };
}

test('pin and unpin immediately update the action icon without switching tabs', async () => {
  const { view, leaf } = await setup();
  const action = () => view.list.children[0].children[1];
  assert.equal(action().innerHTML, icon(CUP));
  leaf.setPinned(true);
  assert.equal(action().innerHTML, icon(POT));
  assert.equal(action().attributes['aria-label'], '取消釘選');
  leaf.setPinned(false);
  assert.equal(action().innerHTML, icon(CUP));
  assert.equal(action().attributes['aria-label'], '關閉分頁');
});

test('tracks new tabs once and releases pin listeners on removal and close', async () => {
  const { view, workspace, leaf, addLeaf } = await setup();
  const second = addLeaf();
  workspace.trigger('layout-change');
  workspace.trigger('layout-change');
  assert.equal(leaf.refs.size, 1);
  assert.equal(second.refs.size, 1);
  second.setPinned(true);
  assert.equal(view.list.children[1].children[1].innerHTML, icon(POT));
  workspace.leaves.splice(0, 1);
  workspace.trigger('layout-change');
  assert.equal(leaf.refs.size, 0);
  await view.onClose();
  assert.equal(second.refs.size, 0);
});
