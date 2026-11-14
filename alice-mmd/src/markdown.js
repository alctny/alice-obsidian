import { MarkdownRenderChild, editorLivePreviewField } from 'obsidian';
import { Prec, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { mermaidBlocks } from './blocks.js';

export class MermaidBlock extends MarkdownRenderChild {
  constructor(element, source, render, workspace, onRendered = () => {}) {
    super(element);
    Object.assign(this, { source, render, workspace, onRendered });
    this.revision = 0;
  }

  onload() {
    this.active = true;
    this.containerEl.addClass('alice-mmd-block');
    this.registerEvent(this.workspace.on('css-change', () => this.refresh()));
    // CodeMirror calls toDOM before inserting the widget. Mermaid needs live DOM.
    const window = this.containerEl.ownerDocument.defaultView;
    const frame = window.requestAnimationFrame(() => { void this.refresh(); });
    this.register(() => window.cancelAnimationFrame(frame));
  }

  async refresh() {
    const revision = ++this.revision;
    const current = () => this.active && this.revision === revision;
    const element = this.containerEl;
    const staging = element.createDiv({ cls: 'alice-mmd-staging' });
    try {
      const result = await this.render(this.source, staging,
        element.ownerDocument.body.classList.contains('theme-dark'), current);
      if (!current() || !result) return;
      staging.innerHTML = result.svg;
      staging.removeClass('alice-mmd-staging');
      element.replaceChildren(staging);
      result.bindFunctions?.(staging);
    } catch (error) {
      if (current()) {
        element.replaceChildren();
        element.createEl('pre', { cls: 'alice-mmd-error', text: error.message ?? String(error) });
      }
    } finally {
      if (staging.classList.contains('alice-mmd-staging')) staging.remove();
      if (current()) this.onRendered();
    }
  }

  onunload() { this.active = false; this.revision++; }
}

export function livePreviewExtension(plugin, render, showMenu) {
  const children = new WeakMap();
  class MermaidWidget extends WidgetType {
    constructor(source, from) { super(); this.source = source; this.from = from; }
    eq(other) { return this.source === other.source && this.from === other.from; }
    toDOM(view) {
      const element = view.dom.ownerDocument.createElement('div');
      element.className = 'cm-embed-block cm-lang-mermaid block-language-mermaid';
      const child = new MermaidBlock(element, this.source, render, plugin.app.workspace,
        () => view.requestMeasure());
      children.set(element, child);
      plugin.addChild(child);
      element.addEventListener('dblclick', () => {
        view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
        view.focus();
      });
      element.addEventListener('contextmenu', event => showMenu(event, view, this.from));
      return element;
    }
    destroy(element) {
      const child = children.get(element);
      if (child) plugin.removeChild(child);
      children.delete(element);
    }
    ignoreEvent() { return true; }
  }

  const decorations = state => {
    if (!state.field(editorLivePreviewField, false)) return Decoration.none;
    const source = state.doc.toString();
    const ranges = [];
    for (const block of mermaidBlocks(source)) {
      // Keep the trailing newline outside the replacement, like native widgets.
      const end = block.end - (source[block.end - 1] === '\n' ? 1 : 0);
      if (state.selection.ranges.some(range => range.from <= end && range.to >= block.start)) continue;
      ranges.push(Decoration.replace({ block: true,
        widget: new MermaidWidget(block.content, block.start),
      }).range(block.start, end));
    }
    return Decoration.set(ranges);
  };
  return Prec.highest(StateField.define({
    create: decorations,
    update(value, transaction) {
      return transaction.docChanged || transaction.selection || transaction.reconfigured
        ? decorations(transaction.state) : value;
    },
    provide: field => EditorView.decorations.from(field),
  }));
}
