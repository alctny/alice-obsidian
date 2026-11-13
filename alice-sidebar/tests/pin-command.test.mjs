import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { redirectSidebarPin } = require('../src/pin-command.cjs');

function setup() {
  const cleanups = [];
  const document = {
    pinned: false,
    getViewState() { return { pinned: this.pinned }; },
    setPinned(value) { this.pinned = value; },
  };
  const workspace = {
    leftSplit: {}, rightSplit: {}, rootSplit: {},
    getMostRecentLeaf: () => document,
  };
  const sidebar = { getRoot: () => workspace.rightSplit };
  workspace.activeLeaf = sidebar;
  let nativeCalls = 0;
  const original = function(checking) {
    assert.equal(this, command);
    nativeCalls++;
    return checking;
  };
  const command = { checkCallback: original };
  redirectSidebarPin({
    app: { workspace, commands: { commands: { 'workspace:toggle-pin': command } } },
    register: cleanup => cleanups.push(cleanup),
  });
  return { workspace, sidebar, document, command, original, cleanups,
    nativeCalls: () => nativeCalls };
}

test('native shortcut pins the document from either sidebar without moving focus', () => {
  const { workspace, sidebar, document, command, nativeCalls } = setup();
  for (const root of [workspace.leftSplit, workspace.rightSplit]) {
    sidebar.getRoot = () => root;
    assert.equal(command.checkCallback(true), true);
    assert.equal(document.pinned, false);
    assert.equal(command.checkCallback(false), true);
    assert.equal(document.pinned, true);
    command.checkCallback(false);
    assert.equal(document.pinned, false);
    assert.equal(workspace.activeLeaf, sidebar);
  }
  assert.equal(nativeCalls(), 0);
});

test('resolves the latest document each time and handles no open document', () => {
  const { workspace, document, command, nativeCalls } = setup();
  command.checkCallback(false);
  const second = { ...document, pinned: false };
  workspace.getMostRecentLeaf = () => second;
  command.checkCallback(false);
  assert.equal(second.pinned, true);
  assert.equal(document.pinned, true);
  workspace.getMostRecentLeaf = () => null;
  assert.equal(command.checkCallback(true), false);
  assert.equal(command.checkCallback(false), false);
  assert.equal(nativeCalls(), 0);
});

test('preserves native behavior in main and floating windows and restores it on unload', () => {
  const { workspace, command, original, cleanups, nativeCalls } = setup();
  for (const root of [workspace.rootSplit, {}]) {
    workspace.activeLeaf = { getRoot: () => root };
    assert.equal(command.checkCallback(true), true);
    assert.equal(command.checkCallback(false), false);
  }
  workspace.activeLeaf = null;
  command.checkCallback(true);
  assert.equal(nativeCalls(), 5);
  cleanups.forEach(cleanup => cleanup());
  assert.equal(command.checkCallback, original);
});
