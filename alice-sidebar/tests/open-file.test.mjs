import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/open-file.cjs', import.meta.url), 'utf8');

function setup() {
  const leaves = [];
  const opened = [];
  const revealed = [];
  const cleanups = [];
  class Events {
    refs = new Set();
    on(name, callback) {
      const ref = { name, callback };
      this.refs.add(ref);
      return ref;
    }
    offref(ref) { this.refs.delete(ref); }
    trigger(name) {
      for (const ref of this.refs) if (ref.name === name) ref.callback();
    }
  }
  class WorkspaceLeaf extends Events {
    constructor(path, type = path ? 'markdown' : 'empty') {
      super();
      this.state = { type, state: path ? { file: path } : {} };
      this.view = { file: path ? { path } : null };
      leaves.push(this);
    }
    getViewState() { return this.state; }
    setPinned(value) {
      this.state.pinned = value;
      this.trigger('pinned-change');
    }
    async openFile(file, options) {
      opened.push({ leaf: this, file, options });
      if (this.error) throw this.error;
      if (this.beforeOpen) await this.beforeOpen();
      this.state = { ...this.state, type: 'markdown', state: { file: file.path } };
      this.view.file = file;
    }
    detach() {
      leaves.splice(leaves.indexOf(this), 1);
      workspace.trigger('layout-change');
    }
  }
  const original = WorkspaceLeaf.prototype.openFile;
  const workspace = Object.assign(new Events(), {
    iterateRootLeaves(callback) { for (const leaf of leaves) if (callback(leaf)) break; },
    getMostRecentLeaf() { return this.activeLeaf; },
    getLeaf() { return new WorkspaceLeaf(); },
    async revealLeaf(leaf) { revealed.push(leaf); this.activeLeaf = leaf; },
  });
  const entry = { exports: {} };
  runInNewContext(source, {
    module: entry,
    queueMicrotask,
    require(id) {
      if (id === 'obsidian') return { WorkspaceLeaf };
      return require('../src/' + id);
    },
  });
  entry.exports.reuseOpenFiles({
    app: { workspace },
    register: cleanup => cleanups.push(cleanup),
    registerEvent: ref => cleanups.push(() => workspace.offref(ref)),
  });
  return { WorkspaceLeaf, original, workspace, leaves, opened, revealed,
    unload() { cleanups.forEach(cleanup => cleanup()); } };
}

test('opening an existing file activates its pinned tab and removes the redundant empty tab', async () => {
  const { WorkspaceLeaf, workspace, leaves, opened, revealed } = setup();
  const existing = new WorkspaceLeaf('notes/A.md');
  existing.state.pinned = true;
  const empty = new WorkspaceLeaf();
  const file = { path: 'notes/A.md' };
  const options = { eState: { subpath: '#Heading', line: 12 } };
  await empty.openFile(file, options);
  assert.deepEqual(leaves, [existing]);
  assert.deepEqual(opened, [{ leaf: existing, file, options }]);
  assert.deepEqual(revealed, [existing]);
  assert.equal(workspace.activeLeaf, existing);
  assert.equal(existing.state.pinned, true);
});

test('redirecting from a pinned document keeps that document open', async () => {
  const { WorkspaceLeaf, leaves, workspace } = setup();
  const existing = new WorkspaceLeaf('A.md');
  const current = new WorkspaceLeaf('B.md');
  current.state.pinned = true;
  await current.openFile({ path: 'A.md' });
  assert.deepEqual(leaves, [existing, current]);
  assert.equal(current.view.file.path, 'B.md');
  assert.equal(workspace.activeLeaf, existing);
});

test('uses complete paths and replaces the unpinned page when opening a new file', async () => {
  const { WorkspaceLeaf, leaves, opened, revealed } = setup();
  const first = new WorkspaceLeaf('one/Note.md');
  const second = new WorkspaceLeaf();
  await second.openFile({ path: 'two/Note.md' });
  assert.equal(first.view.file.path, 'two/Note.md');
  assert.deepEqual(leaves, [first]);
  await first.openFile({ path: 'one/Note.md' });
  assert.deepEqual(opened.map(call => call.leaf), [first, first]);
  assert.deepEqual(revealed, [first]);
});

test('finds deferred non-Markdown files from saved view state', async () => {
  const { WorkspaceLeaf, workspace, leaves } = setup();
  const existing = new WorkspaceLeaf('diagram.mmd', 'alice-mmd');
  existing.view = {};
  const empty = new WorkspaceLeaf();
  await empty.openFile({ path: 'diagram.mmd' });
  assert.deepEqual(leaves, [existing]);
  assert.equal(workspace.activeLeaf, existing);
});

test('does not redirect sidebar or other workspaces and restores native behavior on unload', async () => {
  const { WorkspaceLeaf, original, leaves, opened, revealed, unload } = setup();
  new WorkspaceLeaf('A.md');
  const sidebar = new WorkspaceLeaf();
  leaves.pop();
  await sidebar.openFile({ path: 'A.md' });
  assert.equal(opened[0].leaf, sidebar);
  assert.equal(revealed.length, 0);
  unload();
  assert.equal(WorkspaceLeaf.prototype.openFile, original);
  const duplicate = new WorkspaceLeaf();
  await duplicate.openFile({ path: 'A.md' });
  assert.equal(opened.at(-1).leaf, duplicate);
  assert.equal(leaves.length, 2);
});

test('a failed open preserves the source tab and reports the error', async () => {
  const { WorkspaceLeaf, leaves, revealed } = setup();
  const existing = new WorkspaceLeaf('A.md');
  existing.error = new Error('Cannot load file');
  const empty = new WorkspaceLeaf();
  await assert.rejects(empty.openFile({ path: 'A.md' }), /Cannot load file/);
  assert.deepEqual(leaves, [existing, empty]);
  assert.equal(revealed.length, 0);
});

test('reuses the unpinned tab while preserving all pinned pages and navigation options', async () => {
  const { WorkspaceLeaf, leaves, opened } = setup();
  const pinned = new WorkspaceLeaf('Pinned.md');
  pinned.state.pinned = true;
  const current = new WorkspaceLeaf('A.md');
  const empty = new WorkspaceLeaf();
  const options = { eState: { subpath: '#Section' } };
  await empty.openFile({ path: 'B.md' }, options);
  assert.deepEqual(leaves, [pinned, current]);
  assert.equal(pinned.view.file.path, 'Pinned.md');
  assert.equal(current.view.file.path, 'B.md');
  assert.equal(opened[0].options, options);
});

test('opens a separate unpinned page when every existing tab is pinned', async () => {
  const { WorkspaceLeaf, leaves } = setup();
  const pinned = new WorkspaceLeaf('Pinned.md');
  pinned.state.pinned = true;
  await pinned.openFile({ path: 'New.md' });
  assert.equal(leaves.length, 2);
  assert.equal(pinned.view.file.path, 'Pinned.md');
  assert.equal(leaves[1].view.file.path, 'New.md');
  assert.ok(!leaves[1].state.pinned);
});

test('reopening a pinned page preserves the one unpinned page', async () => {
  const { WorkspaceLeaf, leaves } = setup();
  const pinned = new WorkspaceLeaf('Pinned.md');
  pinned.state.pinned = true;
  const current = new WorkspaceLeaf('Current.md');
  const empty = new WorkspaceLeaf();
  await empty.openFile({ path: 'Pinned.md' });
  assert.deepEqual(leaves, [pinned, current]);
  assert.equal(current.view.file.path, 'Current.md');
});

test('unpinning a page replaces the previous unpinned page', async () => {
  const { WorkspaceLeaf, workspace, leaves } = setup();
  const current = new WorkspaceLeaf('Current.md');
  const pinned = new WorkspaceLeaf('Pinned.md');
  pinned.state.pinned = true;
  workspace.activeLeaf = current;
  workspace.trigger('layout-change');
  await Promise.resolve();
  pinned.setPinned(false);
  await Promise.resolve();
  assert.deepEqual(leaves, [pinned]);
});

test('restored layouts and non-file views also keep only the most recent unpinned tab', async () => {
  const { WorkspaceLeaf, workspace, leaves } = setup();
  new WorkspaceLeaf('A.md');
  const pinned = new WorkspaceLeaf('Pinned.md');
  pinned.state.pinned = true;
  const canvas = new WorkspaceLeaf(undefined, 'canvas');
  workspace.activeLeaf = canvas;
  workspace.trigger('layout-change');
  await Promise.resolve();
  assert.deepEqual(leaves, [pinned, canvas]);
});

test('unload releases listeners and leaves queued layout cleanup inactive', async () => {
  const { WorkspaceLeaf, workspace, leaves, unload } = setup();
  const first = new WorkspaceLeaf('A.md');
  const second = new WorkspaceLeaf('B.md');
  workspace.trigger('layout-change');
  assert.equal(first.refs.size, 1);
  unload();
  await Promise.resolve();
  assert.deepEqual(leaves, [first, second]);
  assert.equal(first.refs.size, 0);
  assert.equal(workspace.refs.size, 0);
});

test('layout changes during file loading wait until replacement succeeds', async () => {
  const { WorkspaceLeaf, workspace, leaves } = setup();
  const current = new WorkspaceLeaf('Current.md');
  const empty = new WorkspaceLeaf();
  let finish;
  current.beforeOpen = () => new Promise(resolve => { finish = resolve; });
  const opening = empty.openFile({ path: 'New.md' });
  workspace.activeLeaf = empty;
  workspace.trigger('layout-change');
  await Promise.resolve();
  assert.deepEqual(leaves, [current, empty]);
  finish();
  await opening;
  assert.deepEqual(leaves, [current]);
  assert.equal(current.view.file.path, 'New.md');
});

test('a failed replacement keeps the previous unpinned document', async () => {
  const { WorkspaceLeaf, leaves } = setup();
  const current = new WorkspaceLeaf('Current.md');
  current.error = new Error('Cannot load file');
  const empty = new WorkspaceLeaf();
  await assert.rejects(empty.openFile({ path: 'New.md' }), /Cannot load file/);
  assert.equal(current.view.file.path, 'Current.md');
  assert.deepEqual(leaves, [current, empty]);
});
