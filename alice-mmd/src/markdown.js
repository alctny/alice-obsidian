import { MarkdownRenderChild, editorLivePreviewField } from 'obsidian';
import { Prec, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { mermaidBlocks } from './blocks.js';

export class MermaidBlock extends MarkdownRenderChild {
  constructor(element, source, render, workspace, onRendered = () => {}, getMaxHeight = () => 0) {
    super(element);
    Object.assign(this, { source, render, workspace, onRendered, getMaxHeight });
    this.revision = 0;
    this.zoom = 1;
  }

  onload() {
    this.active = true;
    this.containerEl.addClass('alice-mmd-block');
    this.viewport = this.containerEl.createDiv({ cls: 'alice-mmd-block-viewport' });
    this.updateMaxHeight();
    this.registerEvent(this.workspace.on('alice-mmd:settings-change', () => {
      this.updateMaxHeight();
      this.onRendered();
    }));
    this.bindPan();
    this.registerDomEvent(this.viewport, 'wheel', event => {
      if (!this.diagramSize || !event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewport.clientHeight : 1;
      this.setZoom(this.zoom * Math.exp(-event.deltaY * unit * 0.002),
        { x: event.clientX, y: event.clientY });
    }, { passive: false });
    this.registerDomEvent(this.viewport, 'touchstart', event => {
      this.pinch = null;
      if (!this.diagramSize || event.touches.length !== 2) return;
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!distance) return;
      this.pinch = { distance, zoom: this.zoom };
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });
    this.registerDomEvent(this.viewport, 'touchmove', event => {
      if (!this.pinch || event.touches.length !== 2) return;
      const [a, b] = event.touches;
      event.preventDefault();
      event.stopPropagation();
      this.setZoom(this.pinch.zoom * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / this.pinch.distance,
        { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    }, { passive: false });
    const endPinch = event => {
      if (!this.pinch) return;
      this.pinch = null;
      event.preventDefault();
      event.stopPropagation();
    };
    this.registerDomEvent(this.viewport, 'touchend', endPinch, { passive: false });
    this.registerDomEvent(this.viewport, 'touchcancel', endPinch, { passive: false });
    this.registerEvent(this.workspace.on('css-change', () => this.refresh()));
    // CodeMirror calls toDOM before inserting the widget. Mermaid needs live DOM.
    const window = this.containerEl.ownerDocument.defaultView;
    const frame = window.requestAnimationFrame(() => { void this.refresh(); });
    this.register(() => window.cancelAnimationFrame(frame));
    let width = this.containerEl.clientWidth;
    const observer = new window.ResizeObserver(() => {
      const next = this.containerEl.clientWidth;
      if (next > 0 && next !== width) {
        width = next;
        void this.refresh();
      }
    });
    observer.observe(this.containerEl);
    this.register(() => observer.disconnect());
  }

  updateMaxHeight() {
    const height = this.getMaxHeight();
    this.viewport.style.maxHeight = Number.isFinite(height) && height > 0 ? `${height}px` : '';
  }

  bindPan() {
    this.registerDomEvent(this.viewport, 'pointerdown', event => {
      this.suppressClick = false;
      // Touch scrolling stays native so it can coexist with two-finger pinches.
      if (event.button !== 0 || event.pointerType === 'touch' || !this.diagramSize || this.drag) return;
      if (event.target.closest('a, button, input, textarea, select, .clickable')) return;
      this.drag = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        left: this.viewport.scrollLeft, top: this.viewport.scrollTop, moved: false,
      };
      this.viewport.setPointerCapture(event.pointerId);
    });
    this.registerDomEvent(this.viewport, 'pointermove', event => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      event.preventDefault();
      event.stopPropagation();
      this.viewport.addClass('is-panning');
      this.viewport.scrollLeft = drag.left - dx;
      this.viewport.scrollTop = drag.top - dy;
    });
    const stop = event => {
      if (event.pointerId === this.drag?.pointerId) this.stopPan();
    };
    this.registerDomEvent(this.viewport, 'pointerup', stop);
    this.registerDomEvent(this.viewport, 'pointercancel', stop);
    this.registerDomEvent(this.viewport, 'lostpointercapture', stop);
    this.registerDomEvent(this.viewport, 'click', event => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  stopPan() {
    if (!this.drag) return;
    const { pointerId, moved } = this.drag;
    this.drag = null;
    this.suppressClick = moved;
    this.viewport.removeClass('is-panning');
    if (this.viewport.hasPointerCapture(pointerId)) this.viewport.releasePointerCapture(pointerId);
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
      const graphic = staging.querySelector('svg, iframe');
      const size = graphic?.getBoundingClientRect();
      staging.removeClass('alice-mmd-staging');
      staging.addClass('alice-mmd-block-diagram');
      this.stopPan();
      this.viewport.replaceChildren(staging);
      this.diagramEl = staging;
      this.diagramSize = size?.width > 0 && size?.height > 0 ? { width: size.width, height: size.height } : null;
      this.pinch = null;
      this.viewport.style.height = this.diagramSize ? `${size.height}px` : '';
      if (this.diagramSize) {
        graphic.style.width = '100%';
        graphic.style.height = '100%';
        graphic.style.maxWidth = 'none';
        this.setZoom(this.zoom);
      }
      result.bindFunctions?.(staging);
    } catch (error) {
      if (current()) {
        this.stopPan();
        this.diagramEl = this.diagramSize = this.pinch = null;
        this.viewport.style.height = '';
        this.viewport.replaceChildren();
        this.viewport.createEl('pre', { cls: 'alice-mmd-error', text: error.message ?? String(error) });
      }
    } finally {
      if (staging.classList.contains('alice-mmd-staging')) staging.remove();
      if (current()) this.onRendered();
    }
  }

  setZoom(value, anchor) {
    if (!this.diagramSize) return;
    const next = Math.min(20, Math.max(0.05, value));
    if (!Number.isFinite(next)) return;
    const before = this.diagramEl.getBoundingClientRect();
    const x = anchor ? (anchor.x - before.left) / this.zoom : 0;
    const y = anchor ? (anchor.y - before.top) / this.zoom : 0;
    this.zoom = next;
    this.diagramEl.style.width = `${this.diagramSize.width * next}px`;
    this.diagramEl.style.height = `${this.diagramSize.height * next}px`;
    if (anchor) {
      const after = this.diagramEl.getBoundingClientRect();
      this.viewport.scrollLeft += after.left + x * next - anchor.x;
      this.viewport.scrollTop += after.top + y * next - anchor.y;
    }
  }

  onunload() {
    this.active = false;
    this.revision++;
    this.stopPan();
    this.diagramEl = this.diagramSize = this.pinch = null;
  }
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
        () => view.requestMeasure(), () => plugin.settings?.markdownMaxHeight ?? 0);
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
