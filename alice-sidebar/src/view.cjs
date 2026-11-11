const { ItemView, Menu } = require('obsidian');
const { TYPE } = require('./constants.cjs');
const { CUP, POT, icon } = require('./icons.cjs');
const { documents } = require('./documents.cjs');

class OpenFilesView extends ItemView {
  getViewType() { return TYPE; }
  getDisplayText() { return '開啟文件'; }
  getIcon() { return 'book-open'; }
  async onOpen() {
    this.pinEvents = new Map();
    this.contentEl.addClass('alice-sidebar');
    this.list = this.contentEl.createDiv({ cls: 'alice-sidebar-list' });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.render()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
      if (documents(this.app.workspace).includes(leaf)) this.current = leaf;
      this.render();
    }));
    this.registerEvent(this.app.vault.on('rename', () => this.render()));
    this.current = this.app.workspace.getMostRecentLeaf();
    this.render();
  }
  async onClose() {
    for (const [leaf, ref] of this.pinEvents) leaf.offref(ref);
    this.pinEvents.clear();
  }
  watchPinChanges(leaves) {
    const open = new Set(leaves);
    for (const [leaf, ref] of this.pinEvents) {
      if (!open.has(leaf)) {
        leaf.offref(ref);
        this.pinEvents.delete(leaf);
      }
    }
    for (const leaf of leaves) {
      if (!this.pinEvents.has(leaf)) {
        this.pinEvents.set(leaf, leaf.on('pinned-change', () => this.render()));
      }
    }
  }
  render() {
    if (!this.list) return;
    const leaves = documents(this.app.workspace);
    this.watchPinChanges(leaves);
    const focused = this.list.querySelector('button:focus');
    const focusIndex = focused ? [...this.list.querySelectorAll('button')].indexOf(focused) : -1;
    this.list.empty();
    for (const leaf of leaves) {
      const pinned = Boolean(leaf.getViewState().pinned);
      const row = this.list.createDiv({ cls: 'alice-sidebar-row' });
      row.toggleClass('is-active', leaf === this.current);
      const title = row.createEl('button', { cls: 'alice-sidebar-title', text: leaf.view.getDisplayText() });
      title.title = leaf.view.file?.path || leaf.view.getDisplayText();
      if (leaf === this.current) title.setAttribute('aria-current', 'page');
      title.addEventListener('click', () => this.app.workspace.setActiveLeaf(leaf, { focus: true }));
      const action = row.createEl('button', { cls: `alice-sidebar-action ${pinned ? 'is-pinned' : ''}` });
      action.innerHTML = icon(pinned ? POT : CUP);
      action.setAttribute('aria-label', pinned ? '取消釘選' : '關閉分頁');
      action.title = pinned ? '取消釘選' : '關閉分頁';
      action.addEventListener('click', () => {
        if (pinned) leaf.setPinned(false);
        else leaf.detach();
        this.render();
      });
      row.addEventListener('contextmenu', event => {
        event.preventDefault();
        new Menu().addItem(item => item.setTitle(pinned ? '取消釘選' : '釘選').setIcon('pin').onClick(() => {
          leaf.setPinned(!pinned); this.render();
        })).showAtMouseEvent(event);
      });
    }
    if (!leaves.length) this.list.createDiv({ text: '尚未開啟文件', cls: 'alice-sidebar-empty' });
    if (focusIndex >= 0) this.list.querySelectorAll('button')[focusIndex]?.focus();
  }
}

module.exports = { OpenFilesView };
