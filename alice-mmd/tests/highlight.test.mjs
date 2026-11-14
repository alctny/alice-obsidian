import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undoDepth, undo, redo } from '@codemirror/commands';
import { mermaidHighlights } from '../src/highlight.js';
import { mermaidHighlightExtension, replaceSource } from '../src/editor.js';

const spans = (source, markdown = false) => mermaidHighlights(source, markdown)
  .map(({ from, to, kind }) => [source.slice(from, to), kind]);

test('highlights Mermaid keywords, adjacent arrows, labels, strings, comments and numbers', () => {
  const source = 'flowchart LR\n流程["開始😀"]-->|通過|B\nB-.->C:::done\n%% end --> "comment"\nclick B "https://example.test"\nlinkStyle 0 stroke:red';
  const tokens = spans(source);
  for (const token of [
    ['flowchart', 'keyword'], ['LR', 'keyword'], ['流程', 'variable'], ['"開始😀"', 'string'],
    ['-->', 'operator'], ['|通過|', 'string'], ['-.->', 'operator'], [':::', 'operator'],
    ['%% end --> "comment"', 'comment'], ['click', 'keyword'], ['0', 'number'],
  ]) assert.ok(tokens.some(value => value[0] === token[0] && value[1] === token[1]), JSON.stringify(token));
  assert.equal(tokens.filter(([, kind]) => kind === 'comment').length, 1);
});

test('sequence, class, state and ER relationships keep their complete operator spans', () => {
  for (const arrow of ['->>', '-->>', '-->', '<-->', '-.->', '==>', '||--o{', '}o--||', '<|--', '--|>']) {
    assert.ok(spans(`A${arrow}B`).some(([text, kind]) => text === arrow && kind === 'operator'), arrow);
  }
  assert.ok(spans('stateDiagram-v2\nstate "開始" as start').some(([text, kind]) => text === 'stateDiagram-v2' && kind === 'keyword'));
});

test('frontmatter keeps YAML comments and quoted colors distinct and resumes Mermaid after CRLF', () => {
  const source = '\uFEFF---\r\nconfig:\r\n  theme: base\r\n  primaryColor: "#461c89" # color\r\n  enabled: true\r\n  maxEdges: 100\r\n---\r\nflowchart TD\r\nA-->B';
  const tokens = spans(source);
  for (const token of [['config', 'property'], ['"#461c89"', 'string'], ['# color', 'comment'], ['true', 'keyword'], ['100', 'number'], ['flowchart', 'keyword']]) {
    assert.ok(tokens.some(value => value[0] === token[0] && value[1] === token[1]), JSON.stringify(token));
  }
  assert.equal(tokens.filter(([, kind]) => kind === 'meta').length, 2);
  assert.equal(spans('---\nconfig:\n  theme: "dark"').at(-1)[1], 'string');
});

test('directives and multiline strings stay intact', () => {
  const source = '%%{init: {"theme": "dark"}}%%\nflowchart TD\nA["line one\nline two"]\n%% comment';
  assert.deepEqual(spans(source)[0], ['%%{init: {"theme": "dark"}}%%', 'meta']);
  assert.ok(spans(source).some(([text, kind]) => text === '"line one\nline two"' && kind === 'string'));
});

test('Markdown highlights only Mermaid bodies with exact offsets, including unfinished fences', () => {
  const source = '# flowchart\r\n```js\r\nflowchart TD\r\n```\r\n~~~mermaid\r\nflowchart LR\r\nA-->B\r\n~~~\r\n````md\r\n```mermaid\r\nA-->B\r\n```\r\n````\r\n```mermaid\r\nsequenceDiagram\r\nA->>B: hi';
  const tokens = mermaidHighlights(source, true);
  assert.deepEqual(tokens.filter(token => token.kind === 'keyword').map(token => source.slice(token.from, token.to)), ['flowchart', 'LR', 'sequenceDiagram']);
  assert.equal(tokens[0].from, source.indexOf('flowchart LR'));
  assert.ok(tokens.every(token => !source.slice(token.from, token.to).includes('```')));
});

function decorations(state) {
  const result = [];
  for (const ranges of state.facet(EditorView.decorations)) {
    ranges.between(0, state.doc.length, (from, to, value) => result.push([state.sliceDoc(from, to), value.spec.class]));
  }
  return result;
}

test('real CodeMirror state updates highlights after typing and removing a Mermaid fence', () => {
  let state = EditorState.create({ doc: '```mermaid\nflowchart TD\nA-->B\n```', extensions: [mermaidHighlightExtension(true)] });
  assert.ok(decorations(state).some(([text, cls]) => text === '-->' && cls === 'alice-mmd-token-operator'));
  state = state.update({ changes: { from: 3, to: 10, insert: 'text' } }).state;
  assert.deepEqual(decorations(state), []);
  state = state.update({ changes: { from: 3, to: 7, insert: 'mermaid' } }).state;
  assert.ok(decorations(state).some(([text]) => text === 'flowchart'));
});

test('programmatic file reloads replace the editor without entering undo history', () => {
  let state = EditorState.create({ doc: 'A-->B', extensions: [mermaidHighlightExtension(), history()] });
  let dispatches = 0;
  const editor = {
    get state() { return state; },
    dispatch(spec) { state = state.update(spec).state; dispatches++; },
  };
  replaceSource(editor, 'flowchart LR\nC-->D');
  assert.equal(state.doc.toString(), 'flowchart LR\nC-->D');
  assert.equal(undoDepth(state), 0);
  assert.ok(decorations(state).some(([text]) => text === 'flowchart'));
  replaceSource(editor, state.doc.toString());
  assert.equal(dispatches, 1);
});

test('standalone editor saves typing and undo/redo, while external reloads do not echo a save', async () => {
  // Replace only the DOM constructor; use real CM state, facets and history.
  class TestView {
    static decorations = EditorView.decorations;
    static contentAttributes = EditorView.contentAttributes;
    static updateListener = EditorView.updateListener;
    constructor({ state }) { this.state = state; }
    dispatch = spec => {
      const transaction = spec.state ? spec : this.state.update(spec);
      this.state = transaction.state;
      for (const listener of this.state.facet(EditorView.updateListener)) {
        listener({ docChanged: transaction.docChanged, transactions: [transaction], state: this.state });
      }
    };
  }
  const source = await readFile(new URL('../src/editor.js', import.meta.url), 'utf8');
  const stateModule = await import('@codemirror/state');
  const commands = await import('@codemirror/commands');
  const viewModule = await import('@codemirror/view');
  const context = vm.createContext({ ...stateModule, ...commands, ...viewModule, EditorView: TestView, mermaidHighlights });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '') +
    '\nthis.create = createSourceEditor; this.replace = replaceSource;', context);
  const saved = [];
  const editor = context.create({}, 'flowchart LR\nA-->B', 'Mermaid source', text => saved.push(text));
  editor.dispatch({ changes: { from: editor.state.doc.length - 1, to: editor.state.doc.length, insert: 'C' } });
  assert.equal(saved.at(-1), 'flowchart LR\nA-->C');
  undo(editor);
  assert.equal(saved.at(-1), 'flowchart LR\nA-->B');
  redo(editor);
  assert.equal(saved.at(-1), 'flowchart LR\nA-->C');
  assert.equal(saved.length, 3);
  context.replace(editor, 'sequenceDiagram\nA->>B: hi');
  assert.equal(saved.length, 3);
  assert.equal(editor.state.doc.toString(), 'sequenceDiagram\nA->>B: hi');
});
