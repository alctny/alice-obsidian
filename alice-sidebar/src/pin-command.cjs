// Keep the native command ID so existing user hotkeys continue to work.
function redirectSidebarPin(plugin) {
  const { workspace } = plugin.app;
  const command = plugin.app.commands?.commands['workspace:toggle-pin'];
  if (!command?.checkCallback) return;
  const original = command.checkCallback;
  const redirected = function(checking) {
    const root = workspace.activeLeaf?.getRoot();
    if (root && (root === workspace.leftSplit || root === workspace.rightSplit)) {
      const leaf = workspace.getMostRecentLeaf();
      if (!leaf) return false;
      if (!checking) leaf.setPinned(!leaf.getViewState().pinned);
      return true;
    }
    return original.call(this, checking);
  };
  command.checkCallback = redirected;
  plugin.register(() => {
    if (command.checkCallback === redirected) command.checkCallback = original;
  });
}

module.exports = { redirectSidebarPin };
