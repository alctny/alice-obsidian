const { WorkspaceLeaf } = require('obsidian');
const { documents } = require('./documents.cjs');

function reuseOpenFiles(plugin) {
  const { workspace } = plugin.app;
  const original = WorkspaceLeaf.prototype.openFile;
  const pinEvents = new Map();
  let opening = 0;
  let scheduled = false;
  let disposed = false;
  let preferred;

  function refresh(keep) {
    if (keep && !keep.getViewState().pinned) preferred = keep;
    const leaves = documents(workspace);
    for (const [leaf, ref] of pinEvents) {
      if (!leaves.includes(leaf)) {
        leaf.offref(ref);
        pinEvents.delete(leaf);
      }
    }
    for (const leaf of leaves) {
      if (!pinEvents.has(leaf)) {
        pinEvents.set(leaf, leaf.on('pinned-change', () => refresh(leaf)));
      }
    }
    if (scheduled) return;
    scheduled = true;
    // Native tab creation and file loading can emit intermediate layouts.
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || opening) return;
      const unpinned = documents(workspace).filter(leaf => !leaf.getViewState().pinned);
      const recent = workspace.getMostRecentLeaf();
      const target = unpinned.includes(preferred) ? preferred
        : unpinned.includes(recent) ? recent : unpinned[0];
      preferred = undefined;
      for (const leaf of unpinned) {
        if (leaf !== target) leaf.detach();
      }
    });
  }

  const redirected = async function(file, options) {
    const leaves = documents(workspace);
    if (!leaves.includes(this)) return original.call(this, file, options);
    const pathOf = leaf => leaf.getViewState().state?.file || leaf.view.file?.path;
    const existing = pathOf(this) === file.path ? this : leaves.find(leaf => pathOf(leaf) === file.path);
    const unpinned = leaves.filter(leaf => !leaf.getViewState().pinned);
    const reusable = unpinned.includes(this) && this.getViewState().type !== 'empty' ? this
      : unpinned.find(leaf => leaf !== this) || unpinned[0];
    const target = existing || reusable || workspace.getLeaf('tab');
    const empty = this !== target && this.getViewState().type === 'empty' && !this.getViewState().pinned;
    opening++;
    try {
      // Keep native navigation options, including heading and block destinations.
      await original.call(target, file, options);
      if (empty && this.getViewState().type === 'empty') this.detach();
      if (target !== this) await workspace.revealLeaf(target);
      refresh(target);
    } finally {
      opening--;
    }
  };
  WorkspaceLeaf.prototype.openFile = redirected;
  plugin.registerEvent(workspace.on('layout-change', () => refresh()));
  refresh();
  plugin.register(() => {
    disposed = true;
    for (const [leaf, ref] of pinEvents) leaf.offref(ref);
    pinEvents.clear();
    if (WorkspaceLeaf.prototype.openFile === redirected) WorkspaceLeaf.prototype.openFile = original;
  });
}

module.exports = { reuseOpenFiles };
