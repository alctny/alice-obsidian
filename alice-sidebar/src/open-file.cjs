const { WorkspaceLeaf } = require('obsidian');
const { documents } = require('./documents.cjs');

function reuseOpenFiles(plugin) {
  const { workspace } = plugin.app;
  const original = WorkspaceLeaf.prototype.openFile;
  const redirected = async function(file, options) {
    const leaves = documents(workspace);
    if (!leaves.includes(this)) return original.call(this, file, options);
    const pathOf = leaf => leaf.getViewState().state?.file || leaf.view.file?.path;
    const existing = pathOf(this) === file.path ? this : leaves.find(leaf => pathOf(leaf) === file.path);
    if (!existing || existing === this) return original.call(this, file, options);

    // Keep native navigation options, including heading and block destinations.
    const empty = this.getViewState().type === 'empty';
    await original.call(existing, file, options);
    if (empty && this.getViewState().type === 'empty') this.detach();
    await workspace.revealLeaf(existing);
  };
  WorkspaceLeaf.prototype.openFile = redirected;
  plugin.register(() => {
    if (WorkspaceLeaf.prototype.openFile === redirected) WorkspaceLeaf.prototype.openFile = original;
  });
}

module.exports = { reuseOpenFiles };
