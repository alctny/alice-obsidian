function entries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) return value.map((item, index) => [item.id ?? String(index), item]);
  return Object.entries(value ?? {});
}

export function sourcePosition(source, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u');
  const lines = source.split('\n');
  let offset = 0;
  let frontmatter = lines[0]?.replace(/^\uFEFF/, '').trim() === '---';
  for (let line = 0; line < lines.length; line++) {
    const text = lines[line];
    if (frontmatter) {
      if (line > 0 && text.trim() === '---') frontmatter = false;
    } else if (!/^\s*(?:%%|classDef\b|style\b|click\b)/.test(text)) {
      const match = pattern.exec(text);
      if (match) {
        const col = match.index + match[1].length;
        return { start: { line, col, offset: offset + col }, end: { line, col: col + id.length, offset: offset + col + id.length } };
      }
    }
    offset += text.length + 1;
  }
  return { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } };
}

export function diagramObjects(diagram, source) {
  const db = diagram.db;
  let records = [];
  if (db.getVertices) records = entries(db.getVertices());
  else if (db.getActors) records = entries(db.getActors());
  else if (db.getEntities) records = entries(db.getEntities());
  else if (db.getStates) records = entries(db.getStates()).filter(([, node]) => !['start', 'end', 'divider'].includes(node.type));
  else if (diagram.type.startsWith('class') && db.getClasses) records = entries(db.getClasses());
  else if (db.getNodes) records = entries(db.getNodes());
  else if (db.getTasks) records = entries(db.getTasks());
  else if (db.getBlocksFlat) records = entries(db.getBlocksFlat());
  else if (db.getData) records = entries(db.getData()?.nodes);
  const groups = db.getSubGraphs?.() ?? [];
  const parentOf = new Map();
  for (const group of groups) {
    for (const id of group.nodes ?? []) parentOf.set(id, group.id);
    records.push([group.id, { ...group, text: group.title }]);
  }
  const seen = new Set();
  return records.flatMap(([key, node]) => {
    const id = String(key);
    if (seen.has(id)) return [];
    seen.add(id);
    const raw = node.alias || node.label || node.text || node.description || node.descriptions?.join(' ') || node.name || id;
    const label = String(raw).replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return [{ id, label: label || id, domId: node.domId ?? node.id ?? id,
      parent: parentOf.get(id) ?? node.parent, position: sourcePosition(source, id) }];
  });
}

// Extend only existing native Outline instances; never change Markdown metadata.
export class MermaidOutline {
  constructor(app, viewType) {
    this.app = app;
    this.viewType = viewType;
    this.patches = new Map();
  }

  findView(file) {
    if (file?.extension !== 'mmd') return null;
    const views = this.app.workspace.getLeavesOfType(this.viewType).map(leaf => leaf.view);
    return views.find(view => view === this.app.workspace.getActiveViewOfType(view.constructor) && view.file?.path === file.path)
      ?? views.find(view => view.file?.path === file.path);
  }

  update() {
    for (const leaf of this.app.workspace.getLeavesOfType('outline')) {
      const outline = leaf.view;
      if (this.patches.has(outline)) {
        outline.requestUpdate();
        continue;
      }
      if (typeof outline.getHeadings !== 'function' || typeof outline.createItemDom !== 'function') continue;
      const originalHeadings = outline.getHeadings;
      const originalItem = outline.createItemDom;
      const bridge = this;
      function getHeadings() {
        const view = bridge.findView(this.file);
        if (!view) return originalHeadings.call(this);
        const objects = view.outlineObjects ?? [];
        const byId = new Map(objects.map(object => [object.id, object]));
        const children = new Map();
        for (const object of objects) {
          const parent = byId.has(object.parent) ? object.parent : null;
          if (!children.has(parent)) children.set(parent, []);
          children.get(parent).push(object);
        }
        const headings = [];
        const seen = new Set();
        const append = (object, level) => {
          if (seen.has(object.id)) return;
          seen.add(object.id);
          headings.push({ heading: object.label === object.id ? object.id : `${object.label} (${object.id})`,
            level, position: object.position, aliceMmdObject: object });
          for (const child of children.get(object.id) ?? []) append(child, level + 1);
        };
        for (const object of children.get(null) ?? []) append(object, 1);
        for (const object of objects) append(object, 1);
        return headings;
      }
      function createItemDom(heading) {
        const item = originalItem.call(this, heading);
        if (heading.aliceMmdObject) item.selfEl.addEventListener('click', event => {
          if (event.target.closest('.collapse-icon')) return;
          const view = bridge.findView(this.file);
          if (!view) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          // The native Outline may reuse a row after its source position changes.
          view.revealObject(item.heading.aliceMmdObject);
        }, true);
        return item;
      }
      outline.getHeadings = getHeadings;
      outline.createItemDom = createItemDom;
      this.patches.set(outline, { originalHeadings, originalItem, getHeadings, createItemDom });
      outline.requestUpdate();
    }
  }

  unload() {
    for (const [outline, patch] of this.patches) {
      if (outline.getHeadings === patch.getHeadings) outline.getHeadings = patch.originalHeadings;
      if (outline.createItemDom === patch.createItemDom) outline.createItemDom = patch.originalItem;
      outline.cachedHeadingDom = [];
      outline.requestUpdate();
    }
    this.patches.clear();
  }
}
