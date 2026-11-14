import { Plugin, TextFileView, TFolder, Menu, MarkdownRenderChild, Notice, parseYaml, normalizePath, getLanguage, addIcon, setIcon } from 'obsidian';
import mermaid from 'mermaid';
import elkLayouts from '@mermaid-js/layout-elk';
import { createRenderer } from './renderer.js';
import { translate } from './i18n.js';
import { MermaidOutline, sourcePosition } from './outline.js';
import { mermaidBlockAt } from './blocks.js';
import { MermaidBlock, livePreviewExtension } from './markdown.js';

const VIEW_TYPE = 'alice-mmd';
const MERMAID_ICON = 'alice-mmd-mermaid';
const MERMAID_SVG = '<path d="M12 38v28m26-28 12 16 12-16m26 0v28M24 52h14m24 0h14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="14" width="28" height="24" rx="5" fill="none" stroke="currentColor" stroke-width="6"/><rect x="68" y="66" width="28" height="24" rx="5" fill="none" stroke="currentColor" stroke-width="6"/>';
mermaid.initialize({ startOnLoad: false });
mermaid.registerLayoutLoaders(elkLayouts);
const t = (key) => translate(key, getLanguage());
const render = createRenderer(mermaid, parseYaml, getLanguage);

class MermaidView extends TextFileView {
  data = '';
  revision = 0;
  closed = false;
  editing = false;
  timer = null;
  zoom = 1;
  diagramEl = null;
  diagramSize = null;
  drag = null;
  miniMapTimer = null;
  mapHovered = false;
  mapDragging = false;

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.file?.basename ?? 'Mermaid'; }
  getIcon() { return MERMAID_ICON; }
  getViewData() { return this.data; }

  async onOpen() {
    this.contentEl.addClass('alice-mmd-view');
    const toolbar = this.contentEl.createDiv({ cls: 'alice-mmd-toolbar' });
    this.filename = toolbar.createEl('input', {
      cls: 'alice-mmd-filename',
      attr: { type: 'text', 'aria-label': t('filename'), placeholder: t('filename'), spellcheck: 'false' },
    });
    this.syncFilename();
    this.filename.addEventListener('blur', () => this.renameFromTitle());
    this.filename.addEventListener('keydown', (event) => {
      if (event.isComposing) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        this.filename.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.syncFilename();
        this.filename.blur();
      }
    });
    if (this.app.vault?.on) this.registerEvent(this.app.vault.on('rename', (file) => {
      if (file === this.file) this.syncFilename();
    }));
    const controls = this.controls = this.contentEl.createDiv({ cls: 'alice-mmd-toolbar alice-mmd-controls' });
    controls.addEventListener('pointerenter', () => {
      this.controlsHovered = true;
      this.showControls();
    });
    controls.addEventListener('pointerleave', () => {
      this.controlsHovered = false;
      this.showControls();
    });
    this.toggle = controls.createEl('button', { cls: 'alice-mmd-mode' });
    this.modeIcon = this.toggle.createSpan({ attr: { 'aria-hidden': 'true' } });
    this.modeLabel = this.toggle.createSpan();
    this.updateModeButton();
    this.toggle.addEventListener('click', () => this.setEditing(!this.editing));
    this.zoomControls = controls.createDiv({ cls: 'alice-mmd-zoom-controls' });
    const zoomOut = this.zoomControls.createEl('button', { text: '−', attr: { 'aria-label': t('zoomOut'), title: t('zoomOut') } });
    zoomOut.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
    this.zoomReset = this.zoomControls.createEl('button', { text: '100%', attr: { 'aria-label': t('resetZoom'), title: t('resetZoom') } });
    this.zoomReset.addEventListener('click', () => this.setZoom(1));
    const zoomIn = this.zoomControls.createEl('button', { text: '+', attr: { 'aria-label': t('zoomIn'), title: t('zoomIn') } });
    zoomIn.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
    this.toggle.setAttribute('aria-expanded', 'false');
    this.editor = this.contentEl.createEl('textarea', {
      cls: 'alice-mmd-source',
      attr: { 'aria-label': t('source'), spellcheck: 'false' },
    });
    this.editor.hidden = true;
    this.editor.value = this.data;
    this.editor.addEventListener('input', () => {
      this.data = this.editor.value;
      this.requestSave();
      this.scheduleRender();
    });
    this.errorEl = this.contentEl.createEl('pre', { cls: 'alice-mmd-error' });
    this.errorEl.hidden = true;
    const canvas = this.canvas = this.contentEl.createDiv({ cls: 'alice-mmd-canvas' });
    this.preview = canvas.createDiv({ cls: 'alice-mmd-preview' });
    this.miniMap = canvas.createDiv({ cls: 'alice-mmd-minimap', attr: { 'aria-label': t('minimap') } });
    this.miniMap.hidden = true;
    this.miniMap.addEventListener('pointerenter', () => {
      this.mapHovered = true;
      this.miniMap.removeClass('is-idle');
      clearTimeout(this.miniMapTimer);
    });
    this.miniMap.addEventListener('pointerleave', () => {
      this.mapHovered = false;
      this.scheduleMiniMapHide();
    });
    this.mapArt = this.miniMap.createDiv({ cls: 'alice-mmd-minimap-art' });
    this.mapViewport = this.miniMap.createDiv({ cls: 'alice-mmd-minimap-viewport' });
    this.preview.addEventListener('scroll', () => this.updateMiniMap());
    this.bindPan();
    const navigate = (event) => {
      if (!this.mapScale) return;
      const bounds = this.miniMap.getBoundingClientRect();
      this.preview.scrollLeft = (event.clientX - bounds.left - this.miniMap.clientLeft) / this.mapScale - this.preview.clientWidth / 2;
      this.preview.scrollTop = (event.clientY - bounds.top - this.miniMap.clientTop) / this.mapScale - this.preview.clientHeight / 2;
      this.updateMiniMap();
    };
    this.miniMap.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.mapDragging = true;
      this.miniMap.setPointerCapture(event.pointerId);
      navigate(event);
    });
    this.miniMap.addEventListener('pointermove', (event) => {
      if (this.miniMap.hasPointerCapture(event.pointerId)) navigate(event);
    });
    const releaseMap = (event) => {
      if (this.miniMap.hasPointerCapture(event.pointerId)) this.miniMap.releasePointerCapture(event.pointerId);
      this.mapDragging = false;
      this.scheduleMiniMapHide();
    };
    this.miniMap.addEventListener('pointerup', releaseMap);
    this.miniMap.addEventListener('pointercancel', releaseMap);
    this.miniMap.addEventListener('lostpointercapture', releaseMap);
    const ResizeObserverClass = this.contentEl.ownerDocument.defaultView.ResizeObserver;
    this.resizeObserver = new ResizeObserverClass(() => this.updateMiniMap());
    this.resizeObserver.observe(this.preview);
    this.preview.addEventListener('dblclick', () => this.setEditing(true));
    this.preview.addEventListener('wheel', (event) => {
      if (!this.diagramEl) return;
      event.preventDefault();
      const bounds = this.preview.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.preview.clientHeight : 1;
      this.setZoom(this.zoom * Math.exp(-event.deltaY * unit * 0.002), {
        x: event.clientX - bounds.left - this.preview.clientLeft,
        y: event.clientY - bounds.top - this.preview.clientTop,
      });
    }, { passive: false });
    this.registerEvent(this.app.workspace.on('css-change', () => this.scheduleRender()));
    this.scheduleRender();
  }

  bindPan() {
    this.preview.addEventListener('pointerdown', (event) => {
      this.suppressClick = false;
      if (event.button !== 0 || !this.diagramEl) return;
      if (event.target.closest('a, button, input, textarea, select, .clickable')) return;
      this.drag = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        left: this.preview.scrollLeft, top: this.preview.scrollTop, moved: false,
      };
      this.preview.setPointerCapture(event.pointerId);
    });
    this.preview.addEventListener('pointermove', (event) => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      event.preventDefault();
      this.preview.addClass('is-panning');
      this.preview.scrollLeft = drag.left - dx;
      this.preview.scrollTop = drag.top - dy;
      this.updateMiniMap();
    });
    const stop = (event) => {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      this.suppressClick = this.drag.moved;
      this.drag = null;
      this.preview.removeClass('is-panning');
      if (this.preview.hasPointerCapture(event.pointerId)) this.preview.releasePointerCapture(event.pointerId);
    };
    this.preview.addEventListener('pointerup', stop);
    this.preview.addEventListener('pointercancel', stop);
    this.preview.addEventListener('lostpointercapture', stop);
    this.preview.addEventListener('click', (event) => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }

  refreshMiniMap() {
    this.mapArt.replaceChildren();
    const svg = this.diagramEl?.querySelector('svg');
    if (svg) {
      // An SVG image has its own ID namespace and cannot run diagram callbacks.
      const copy = svg.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(this.diagramSize.width));
      copy.setAttribute('height', String(this.diagramSize.height));
      this.mapArt.createEl('img', { attr: {
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copy.outerHTML)}`,
        alt: '', draggable: 'false',
      } });
    } else {
      const iframe = this.diagramEl?.querySelector('iframe');
      if (iframe) {
        const copy = iframe.cloneNode(true);
        copy.removeAttribute('id');
        copy.setAttribute('tabindex', '-1');
        copy.setAttribute('aria-hidden', 'true');
        this.mapArt.appendChild(copy);
      }
    }
    this.updateMiniMap();
  }

  updateMiniMap() {
    clearTimeout(this.miniMapTimer);
    if (!this.miniMap) return;
    const size = this.diagramSize;
    if (this.closed || this.editing || !this.diagramEl || !size) {
      this.miniMap.hidden = true;
      return;
    }
    const visibleWidth = this.preview.clientWidth;
    const visibleHeight = this.preview.clientHeight;
    const diagramWidth = size.width * this.zoom;
    const diagramHeight = size.height * this.zoom;
    const width = Math.max(diagramWidth, visibleWidth);
    const height = Math.max(diagramHeight, visibleHeight);
    this.miniMap.hidden = visibleWidth <= 0 || visibleHeight <= 0 ||
      (diagramWidth <= visibleWidth + 1 && diagramHeight <= visibleHeight + 1);
    if (this.miniMap.hidden) return;
    this.miniMap.removeClass('is-idle');
    const scale = this.mapScale = Math.min(180 / width, 120 / height, visibleWidth * 0.4 / width);
    this.miniMap.style.width = `${width * scale}px`;
    this.miniMap.style.height = `${height * scale}px`;
    this.mapArt.style.width = `${diagramWidth * scale}px`;
    this.mapArt.style.height = `${diagramHeight * scale}px`;
    this.mapViewport.style.width = `${visibleWidth * scale}px`;
    this.mapViewport.style.height = `${visibleHeight * scale}px`;
    this.mapViewport.style.left = `${Math.max(0, Math.min(width - visibleWidth, this.preview.scrollLeft)) * scale}px`;
    this.mapViewport.style.top = `${Math.max(0, Math.min(height - visibleHeight, this.preview.scrollTop)) * scale}px`;
    this.scheduleMiniMapHide();
  }

  scheduleMiniMapHide() {
    clearTimeout(this.miniMapTimer);
    if (!this.miniMap || this.miniMap.hidden || this.mapHovered || this.mapDragging || this.closed) return;
    this.miniMapTimer = setTimeout(() => {
      this.miniMap.addClass('is-idle');
      this.miniMapTimer = null;
    }, 500);
  }

  updateModeButton() {
    setIcon(this.modeIcon, this.editing ? 'file-code-2' : MERMAID_ICON);
    this.modeLabel.textContent = t(this.editing ? 'edit' : 'preview');
    const action = t(this.editing ? 'preview' : 'edit');
    this.toggle.setAttribute('title', action);
    this.toggle.setAttribute('aria-label', action);
    this.toggle.setAttribute('aria-pressed', String(this.editing));
    this.toggle.setAttribute('aria-expanded', String(this.editing));
  }

  setEditing(editing) {
    this.editing = editing;
    this.editor.hidden = !editing;
    this.canvas.hidden = editing;
    if (editing) {
      this.mapHovered = false;
      this.mapDragging = false;
      this.updateMiniMap();
    }
    this.zoomControls.hidden = editing;
    this.errorEl.hidden = true;
    if (editing) this.contentEl.addClass('is-editing');
    else this.contentEl.removeClass('is-editing');
    this.updateModeButton();
    this.scheduleRender();
    if (editing) this.editor.focus();
  }

  showControls() {
    if (!this.controls || this.closed) return;
    clearTimeout(this.controlsTimer);
    this.controls.addClass('is-visible');
    if (!this.controlsHovered) this.controlsTimer = setTimeout(() => {
      this.controls.removeClass('is-visible');
      this.controlsTimer = null;
    }, 500);
  }

  setZoom(value, anchor) {
    const next = Math.min(20, Math.max(0.05, value));
    if (!Number.isFinite(next)) return;
    const previous = this.zoom;
    this.zoom = next;
    if (next !== previous) this.showControls();
    if (this.zoomReset) this.zoomReset.textContent = `${Math.round(next * 100)}%`;
    if (!this.diagramEl || !this.diagramSize) return;
    const point = anchor ?? { x: this.preview.clientWidth / 2, y: this.preview.clientHeight / 2 };
    const left = (this.preview.scrollLeft + point.x) / previous;
    const top = (this.preview.scrollTop + point.y) / previous;
    this.diagramEl.style.width = `${this.diagramSize.width * next}px`;
    this.diagramEl.style.height = `${this.diagramSize.height * next}px`;
    this.preview.scrollLeft = left * next - point.x;
    this.preview.scrollTop = top * next - point.y;
    this.updateMiniMap();
  }

  setViewData(data, clear) {
    this.data = data;
    this.syncFilename();
    if (this.editor) {
      if (clear || this.editor.value !== data) this.editor.value = data;
      this.scheduleRender();
    }
  }

  syncFilename() {
    if (!this.filename) return;
    this.filename.value = this.file?.basename ?? '';
    this.filename.title = this.file?.name ?? '';
  }

  async renameFromTitle() {
    const file = this.file;
    if (!file || this.renaming) return;
    const name = this.filename.value.trim().replace(/\.mmd$/i, '');
    if (name === file.basename) { this.syncFilename(); return; }
    if (!name || /[\\/:*?"<>|\x00-\x1f]/.test(name) || name === '.' || name === '..') {
      new Notice(t('invalidFilename'));
      this.syncFilename();
      return;
    }
    this.renaming = true;
    this.filename.readOnly = true;
    try {
      const path = normalizePath(`${file.parent?.path && file.parent.path !== '/' ? `${file.parent.path}/` : ''}${name}.mmd`);
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing && existing !== file) throw new Error(`${t('blockFileExists')}${path}`);
      await this.save();
      await this.app.fileManager.renameFile(file, path);
    } catch (error) {
      new Notice(`${t('renameError')}${error.message ?? error}`);
    } finally {
      this.renaming = false;
      this.filename.readOnly = false;
      this.syncFilename();
    }
  }

  clear() {
    this.data = '';
    this.outlineObjects = [];
    this.onOutlineChange?.();
    this.revision++;
    clearTimeout(this.timer);
    if (this.editor) this.editor.value = '';
    this.diagramEl = null;
    this.diagramSize = null;
    this.setZoom(1);
    this.preview?.replaceChildren();
    this.mapArt?.replaceChildren();
    this.updateMiniMap();
    if (this.errorEl) this.errorEl.hidden = true;
  }

  scheduleRender() {
    const revision = ++this.revision;
    clearTimeout(this.timer);
    if (this.editing) return;
    this.timer = setTimeout(() => { void this.renderDiagram(revision); }, 200);
  }

  async renderDiagram(revision) {
    const current = () => !this.closed && !this.editing && this.revision === revision;
    if (!current()) return;
    // Mermaid measures live DOM text; render in a connected staging container.
    const staging = this.preview.createDiv({ cls: 'alice-mmd-staging' });
    try {
      if (!this.data.trim()) {
        if (current()) {
          this.outlineObjects = [];
          this.onOutlineChange?.();
          this.diagramEl = null;
          this.diagramSize = null;
          this.preview.replaceChildren();
          this.preview.createEl('p', { text: t('empty') });
          this.errorEl.hidden = true;
          this.updateMiniMap();
        }
        return;
      }
      const result = await render(this.data, staging,
        this.contentEl.ownerDocument.body.classList.contains('theme-dark'), current);
      if (!current() || !result) return;
      this.outlineObjects = result.outlineObjects ?? [];
      this.onOutlineChange?.();
      staging.innerHTML = result.svg;
      const graphic = staging.querySelector('svg, iframe');
      const size = graphic?.getBoundingClientRect();
      staging.removeClass('alice-mmd-staging');
      staging.addClass('alice-mmd-diagram');
      this.preview.replaceChildren(staging);
      this.diagramEl = staging;
      this.diagramSize = size?.width > 0 && size?.height > 0 ? { width: size.width, height: size.height } : null;
      if (graphic && this.diagramSize) {
        graphic.style.width = '100%';
        graphic.style.height = '100%';
        graphic.style.maxWidth = 'none';
        this.setZoom(this.zoom);
      }
      if (this.diagramSize) this.refreshMiniMap();
      else this.updateMiniMap();
      result.bindFunctions?.(staging);
      this.errorEl.hidden = true;
    } catch (error) {
      if (current()) {
        this.diagramEl = null;
        this.diagramSize = null;
        this.preview.replaceChildren();
        this.outlineObjects = [];
        this.onOutlineChange?.();
        this.errorEl.textContent = error instanceof Error ? error.message : String(error);
        this.errorEl.hidden = false;
        this.updateMiniMap();
      }
    } finally {
      if (staging.classList.contains('alice-mmd-staging')) staging.remove();
    }
  }

  revealObject(object) {
    this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
    if (this.editing) {
      this.editor.focus();
      const position = sourcePosition(this.data, object.id);
      this.editor.setSelectionRange(position.start.offset, position.end.offset);
      const lineHeight = parseFloat(this.contentEl.ownerDocument.defaultView.getComputedStyle(this.editor).lineHeight) || 24;
      this.editor.scrollTop = Math.max(0, position.start.line * lineHeight - this.editor.clientHeight / 2);
      return;
    }
    const candidates = this.diagramEl?.querySelectorAll('[id], g[data-id], rect[name]') ?? [];
    const target = [...candidates].find(node => node.id === object.domId || node.id === object.id)
      ?? [...candidates].find(node => node.id.startsWith(`flowchart-${object.id}-`) || node.id.startsWith(`state-${object.id}-`))
      ?? [...candidates].find(node => node.getAttribute('data-id') === object.id && node.tagName.toLowerCase() !== 'line')
      ?? [...candidates].find(node => node.getAttribute('name') === object.id);
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const viewport = this.preview.getBoundingClientRect();
    this.preview.scrollLeft += bounds.left - viewport.left + bounds.width / 2 - this.preview.clientWidth / 2;
    this.preview.scrollTop += bounds.top - viewport.top + bounds.height / 2 - this.preview.clientHeight / 2;
    target.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 500, iterations: 2 });
    this.updateMiniMap();
  }

  async onClose() {
    this.closed = true;
    clearTimeout(this.controlsTimer);
    clearTimeout(this.miniMapTimer);
    this.resizeObserver?.disconnect();
    this.drag = null;
    this.revision++;
    clearTimeout(this.timer);
  }
}

export default class AliceMmdPlugin extends Plugin {
  async onload() {
    addIcon(MERMAID_ICON, MERMAID_SVG);
    // Run before the built-in reading-mode processor consumes code.language-mermaid.
    this.registerMarkdownCodeBlockProcessor('mermaid', (source, element, context) => {
      context.addChild(new MermaidBlock(element, source, render, this.app.workspace));
    }, -100);
    this.registerEditorExtension(livePreviewExtension(this, render, (event, cm, from) => {
      const view = this.app.workspace.getLeavesOfType('markdown')
        .map(leaf => leaf.view).find(view => view.editor?.cm === cm);
      if (!view?.file) return;
      const source = view.editor.getValue();
      const block = mermaidBlockAt(source, view.editor.offsetToPos(from).line);
      if (!block) return;
      event.preventDefault();
      event.stopPropagation();
      const menu = new Menu();
      this.addBlockMenuItem(menu, view.file, source, block, view.editor);
      menu.showAtMouseEvent(event);
    }));
    this.outline = new MermaidOutline(this.app, VIEW_TYPE);
    this.registerView(VIEW_TYPE, (leaf) => {
      const view = new MermaidView(leaf);
      view.onOutlineChange = () => this.outline.update();
      return view;
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => this.outline.update()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.outline.update()));
    this.app.workspace.onLayoutReady(() => this.outline.update());
    this.registerExtensions(['mmd'], VIEW_TYPE);
    this.addCommand({
      id: 'reset-zoom',
      name: t('resetZoomCommand'),
      hotkeys: [{ modifiers: ['Mod'], key: '0' }],
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MermaidView);
        if (!view || view.editing) return false;
        if (!checking) view.setZoom(1);
        return true;
      },
    });
    this.addCommand({
      id: 'create-mmd',
      name: t('createCommand'),
      callback: () => this.createMmd(),
    });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      const folder = file instanceof TFolder ? file : file.parent;
      if (!folder) return;
      menu.addItem((item) => item
        .setSection('action-primary')
        .setTitle(t('createMenu'))
        .setIcon(MERMAID_ICON)
        .onClick(() => this.createMmd(folder)));
    }));
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor, view) => {
      if (view.file?.extension !== 'md') return;
      const source = editor.getValue();
      const clicked = this.previewContext;
      const block = clicked?.editor === editor && clicked.source === source
        ? clicked.block : mermaidBlockAt(source, editor.getCursor().line);
      this.previewContext = null;
      if (block) this.addBlockMenuItem(menu, view.file, source, block, editor);
    }));
    const previewContextMenu = (event) => {
      this.previewContext = null;
      const origin = event.composedPath?.()[0] ?? event.target;
      const target = origin.closest?.('.cm-lang-mermaid, .block-language-mermaid, .mermaid, svg[id^="mermaid"]');
      if (!target) return;
      if (target.classList?.contains('alice-mmd-block')) return;
      const view = this.app.workspace.getLeavesOfType('markdown')
        .map((leaf) => leaf.view).find((view) => view.contentEl.contains(target));
      if (view?.file?.extension !== 'md') return;
      if (view.getMode?.() === 'preview') return; // Handled by the reading-mode processor.
      const editor = view.editor;
      const cm = editor.cm;
      if (!cm) return;
      const source = editor.getValue();
      const widget = target.closest('.cm-embed-block') ?? target;
      const offsets = [];
      // Obsidian's rendered code widget stores its source range. CM uses
      // cmTile in current releases and cmView in earlier releases.
      const tile = widget.cmTile ?? widget.cmView;
      const codeWidget = tile?.widget;
      if (codeWidget?.lang === 'mermaid' && codeWidget.start >= 0) offsets.push(codeWidget.start);
      if (tile?.posAtStart != null) offsets.push(tile.posAtStart);
      // posAtDOM on a replacement widget can point AFTER its closing fence.
      // Its visual block range retains the actual hidden source range.
      if (!offsets.length && cm.lineBlockAtHeight && widget.getBoundingClientRect) {
        const bounds = widget.getBoundingClientRect();
        const range = cm.lineBlockAtHeight(bounds.top + Math.min(1, bounds.height / 2) - cm.documentTop);
        offsets.push(range.from, Math.max(range.from, range.to - 1));
      }
      if (!offsets.length) {
        try { offsets.push(cm.posAtDOM(widget)); } catch { /* Replacement widget has no DOM source position. */ }
        if (cm.posAtCoords) offsets.push(cm.posAtCoords({ x: event.clientX, y: event.clientY }));
      }
      let block;
      for (const offset of offsets) {
        if (offset == null) continue;
        block = mermaidBlockAt(source, editor.offsetToPos(offset).line);
        if (!block && offset > 0) block = mermaidBlockAt(source, editor.offsetToPos(offset - 1).line);
        if (block) break;
      }
      if (!block) return;
      // Obsidian builds the native menu after this capture listener. Add our
      // action there instead of opening a competing menu that it can replace.
      this.previewContext = { editor, source, block };
    };
    const previewRoots = new WeakSet();
    const attachPreviewMenus = () => {
      for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
        const root = leaf.view.contentEl;
        if (!root || previewRoots.has(root)) continue;
        previewRoots.add(root);
        this.registerDomEvent(root, 'contextmenu', previewContextMenu, true);
      }
    };
    this.app.workspace.onLayoutReady(attachPreviewMenus);
    this.registerEvent(this.app.workspace.on('layout-change', attachPreviewMenus));
    this.registerEvent(this.app.workspace.on('active-leaf-change', attachPreviewMenus));
    attachPreviewMenus();
    this.registerMarkdownPostProcessor((element, context) => {
      const child = new MarkdownRenderChild(element);
      context.addChild(child);
      child.registerDomEvent(element, 'contextmenu', (event) => {
        const target = event.target.closest?.('.alice-mmd-block, .mermaid, pre:has(code.language-mermaid)');
        if (!target || !element.contains(target)) return;
        const section = context.getSectionInfo(target);
        const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
        if (!section || file?.extension !== 'md') return;
        // Section info supplies the document text and the block's source line.
        const block = mermaidBlockAt(section.text, section.lineStart);
        if (!block) return;
        event.preventDefault();
        event.stopPropagation();
        const menu = new Menu();
        this.addBlockMenuItem(menu, file, section.text, block);
        menu.showAtMouseEvent(event);
      }, true);
    });
  }

  addBlockMenuItem(menu, file, source, block, editor) {
    menu.addItem((item) => item
      .setTitle('New mermaid fomr block')
      .setIcon(MERMAID_ICON)
      .onClick(() => this.moveMermaidBlock(file, source, block, editor)));
  }

  async moveMermaidBlock(file, source, block, editor) {
    try {
      const base = normalizePath(`${file.parent?.path && file.parent.path !== '/' ? `${file.parent.path}/` : ''}${file.basename}`);
      let path = `${base}.mmd`;
      while (this.app.vault.getAbstractFileByPath(path)) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const suffix = Array.from({ length: 13 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        path = `${base}-${suffix}.mmd`;
      }
      const current = editor ? editor.getValue() : await this.app.vault.read(file);
      if (current !== source) throw new Error(t('blockSourceChanged'));
      const diskSource = editor ? await this.app.vault.read(file) : current;
      const created = await this.app.vault.create(path, block.content);
      try {
        // Write through the vault first: an EACCES must not remove the editor's block.
        await this.app.vault.process(file, (data) => {
          if (data !== diskSource || (editor && editor.getValue() !== source)) {
            throw new Error(t('blockSourceChanged'));
          }
          return source.slice(0, block.start) + source.slice(block.end);
        });
      } catch (error) {
        new Notice(`${t('blockMoveError')}${path}\n${error.message ?? error}`);
        await this.app.workspace.getLeaf('tab').openFile(created);
        return;
      }
      if (editor && editor.getValue() === source) {
        editor.replaceRange('', editor.offsetToPos(block.start), editor.offsetToPos(block.end));
      }
      await this.app.workspace.getLeaf('tab').openFile(created);
    } catch (error) {
      new Notice(`${t('createError')}${error.message ?? error}`);
    }
  }

  onunload() {
    this.outline.unload();
  }

  async createMmd(targetFolder) {
    try {
      const folder = targetFolder ?? this.app.fileManager.getNewFileParent(
        this.app.workspace.getActiveFile()?.path ?? '');
      let index = 0;
      let path;
      do {
        path = normalizePath(`${folder.path ? `${folder.path}/` : ''}${t('untitled')}${index ? ` ${index}` : ''}.mmd`);
        index++;
      } while (this.app.vault.getAbstractFileByPath(path));
      const file = await this.app.vault.create(path,
        `---\nconfig:\n  layout: elk\n  theme: dark\n---\nflowchart TD\n  A[${t('start')}] --> B[${t('end')}]\n`);
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (error) {
      new Notice(`${t('createError')}${error.message ?? error}`);
    }
  }
}
