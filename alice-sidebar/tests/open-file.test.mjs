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
  class WorkspaceLeaf {
    constructor(path, type = path ? 'markdown' : 'empty') {
      this.state = { type, state: path ? { file: path } : {} };
      this.view = { file: path ? { path } : null };
      leaves.push(this);
    }
    getViewState() { return this.state; }
    async openFile(file, options) {
      opened.push({ leaf: this, file, options });
      if (this.error) throw this.error;
      this.state = { ...this.state, type: 'markdown', state: { file: file.path } };
      this.view.file = file;
    }
    detach() { leaves.splice(leaves.indexOf(this), 1); }
  }
  const original = WorkspaceLeaf.prototype.openFile;
  const workspace = {
    iterateRootLeaves(callback) { for (const leaf of leaves) if (callback(leaf)) break; },
    async revealLeaf(leaf) { revealed.push(leaf); this.activeLeaf = leaf; },
  };
  const entry = { exports: {} };
  runInNewContext(source, {
    module: entry,
    require(id) {
      if (id === 'obsidian') return { WorkspaceLeaf };
      return require('../src/' + id);
    },
  });
  entry.exports.reuseOpenFiles({ app: { workspace }, register: cleanup => cleanups.push(cleanup) });
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

test('redirecting from another document keeps that document open', async () => {
  const { WorkspaceLeaf, leaves, workspace } = setup();
  const existing = new WorkspaceLeaf('A.md');
  const current = new WorkspaceLeaf('B.md');
  await current.openFile({ path: 'A.md' });
  assert.deepEqual(leaves, [existing, current]);
  assert.equal(current.view.file.path, 'B.md');
  assert.equal(workspace.activeLeaf, existing);
});

test('uses complete paths and leaves unopened files and the current file to native handling', async () => {
  const { WorkspaceLeaf, leaves, opened, revealed } = setup();
  const first = new WorkspaceLeaf('one/Note.md');
  const second = new WorkspaceLeaf();
  await second.openFile({ path: 'two/Note.md' });
  await first.openFile({ path: 'one/Note.md' });
  assert.deepEqual(leaves, [first, second]);
  assert.deepEqual(opened.map(call => call.leaf), [second, first]);
  assert.equal(revealed.length, 0);
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
