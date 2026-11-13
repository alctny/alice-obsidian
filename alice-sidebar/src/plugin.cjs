const { Plugin, Notice } = require('obsidian');
const { TYPE } = require('./constants.cjs');
const { OpenFilesView } = require('./view.cjs');
const { redirectSidebarPin } = require('./pin-command.cjs');

module.exports = class AliceOpenFiles extends Plugin {
  async onload() {
    redirectSidebarPin(this);
    this.registerView(TYPE, leaf => new OpenFilesView(leaf));
    this.addCommand({ id: 'show-open-files', name: '顯示開啟文件', callback: () => this.showPanel() });
    this.addCommand({
      id: 'toggle-outline-open-files',
      name: '切換側邊欄子標籤',
      hotkeys: [{ modifiers: ['Alt'], key: 'o' }],
      callback: () => this.togglePanel(),
    });
    this.addRibbonIcon('book-open', '開啟文件', () => this.showPanel());
    this.app.workspace.onLayoutReady(() => this.showPanel());
  }
  async togglePanel() {
    const workspace = this.app.workspace;
    const anchor = workspace.getLeavesOfType(TYPE)[0];
    if (!anchor) return this.showPanel();
    // Read the current tab group every time so dragged-in tabs participate.
    const tabs = anchor.parent;
    const leaves = tabs.children.filter(leaf => leaf.view);
    if (!leaves.length) return;
    const visible = leaves.findIndex(leaf => leaf.view.containerEl.isShown());
    const next = visible < 0 ? anchor : leaves[(visible + 1) % leaves.length];
    await workspace.revealLeaf(next);
  }

  async showPanel(type = TYPE) {
    let leaf = this.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type, active: true });
      if (leaf.view.getViewType() !== type) {
        leaf.detach();
        new Notice('請先在設定 → 核心外掛啟用「大綱」。');
        return;
      }
    }
    await this.app.workspace.revealLeaf(leaf);
  }
};
