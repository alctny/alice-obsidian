import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramObjects, sourcePosition, MermaidOutline } from '../src/outline.js';

test('finds source object IDs outside frontmatter and comments with exact offsets', () => {
  const source = '---\nconfig:\n  title: A\n---\nflowchart TD\n %% A comment\n A[Hello] --> B[World]';
  const position = sourcePosition(source, 'A');
  assert.equal(position.start.line, 6);
  assert.equal(source.slice(position.start.offset, position.end.offset), 'A');
  assert.equal(sourcePosition('flowchart TD\n AA --> A', 'A').start.col, 8);
  assert.equal(sourcePosition('flowchart TD\n 節點[標籤]', '節點').start.col, 1);
});

test('collects nodes and subgraphs, excluding style classes and keeping plain labels', () => {
  const diagram = { type: 'flowchart-v2', db: {
    getVertices: () => new Map([
      ['A', { id: 'A', text: '<b>Hello</b><br/>World', domId: 'flowchart-A-0' }],
      ['B', { id: 'B', text: 'End' }],
    ]),
    getClasses: () => new Map([['style-only', {}]]),
    getSubGraphs: () => [{ id: 'group', title: 'Group', nodes: ['A', 'B'] }],
  } };
  const objects = diagramObjects(diagram, 'flowchart TD\nsubgraph group[Group]\n A-->B\nend');
  assert.deepEqual(objects.map(object => object.id), ['A', 'B', 'group']);
  assert.equal(objects[0].label, 'Hello World');
  assert.equal(objects[0].domId, 'flowchart-A-0');
  assert.equal(objects[0].parent, 'group');
});

test('collects classes and states without state start/end pseudo objects', () => {
  const classes = diagramObjects({ type: 'class', db: {
    getClasses: () => new Map([['Animal', { label: 'Animal' }]]),
  } }, 'classDiagram\n class Animal');
  assert.equal(classes[0].id, 'Animal');
  const states = diagramObjects({ type: 'state', db: {
    getStates: () => new Map([['start', { type: 'start' }], ['Idle', { description: 'Idle state' }]]),
  } }, 'stateDiagram-v2\n [*] --> Idle');
  assert.deepEqual(states.map(object => object.id), ['Idle']);
});

test('native Outline retains Markdown headings, nests Mermaid objects, reveals objects and restores methods', () => {
  let click;
  let revealed;
  const mmd = { file: { path: 'test.mmd', extension: 'mmd' },
    outlineObjects: diagramObjects({ type: 'flowchart', db: {
      getVertices: () => new Map([['A', { text: 'Start' }]]),
      getSubGraphs: () => [{ id: 'group', title: 'Group', nodes: ['A'] }],
    } }, 'flowchart TD\n subgraph group\n A[Start]\n end'),
    revealObject(object) { revealed = object; },
  };
  const native = {
    file: mmd.file,
    getHeadings() { return ['native Markdown headings']; },
    createItemDom(heading) { return { heading, selfEl: { addEventListener(_event, callback) { click = callback; } } }; },
    requestUpdate() {},
  };
  const getHeadings = native.getHeadings;
  const createItemDom = native.createItemDom;
  const workspace = {
    getLeavesOfType(type) { return [{ view: type === 'outline' ? native : mmd }]; },
    getActiveViewOfType() { return mmd; },
  };
  const bridge = new MermaidOutline({ workspace }, 'alice-mmd');
  bridge.update();
  const headings = native.getHeadings();
  assert.deepEqual(headings.map(heading => [heading.heading, heading.level]), [['Group (group)', 1], ['Start (A)', 2]]);
  native.createItemDom(headings[1]);
  click({ target: { closest() { return null; } }, preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(revealed.id, 'A');
  native.file = { extension: 'md' };
  assert.deepEqual(native.getHeadings(), ['native Markdown headings']);
  bridge.unload();
  assert.equal(native.getHeadings, getHeadings);
  assert.equal(native.createItemDom, createItemDom);
});

test('reads actual Mermaid sequence participants and ER entity aliases', async () => {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
  const sequence = 'sequenceDiagram\n participant A as Alice\n A->>B: Hello';
  const actors = diagramObjects(await mermaid.mermaidAPI.getDiagramFromText(sequence), sequence);
  assert.deepEqual(actors.map(actor => [actor.id, actor.label]), [['A', 'Alice'], ['B', 'B']]);
  const er = 'erDiagram\n CUSTOMER ||--o{ ORDER : places';
  const entities = diagramObjects(await mermaid.mermaidAPI.getDiagramFromText(er), er);
  assert.deepEqual(entities.map(entity => entity.id), ['CUSTOMER', 'ORDER']);
  assert.match(entities[0].domId, /CUSTOMER/);
});
