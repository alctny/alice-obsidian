import { EditorState, StateField, Transaction } from '@codemirror/state';
import { Decoration, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { mermaidHighlights } from './highlight.js';

export function mermaidHighlightExtension(markdown = false) {
  const decorate = state => Decoration.set(mermaidHighlights(state.doc.toString(), markdown)
    .map(({ from, to, kind }) => Decoration.mark({ class: `alice-mmd-token-${kind}` }).range(from, to)));
  return StateField.define({
    create: decorate,
    update: (value, transaction) => transaction.docChanged ? decorate(transaction.state) : value,
    provide: field => EditorView.decorations.from(field),
  });
}

export function createSourceEditor(parent, source, label, onChange) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: source,
      extensions: [
        mermaidHighlightExtension(), history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorState.tabSize.of(2),
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
        EditorView.updateListener.of(update => {
          if (update.docChanged && update.transactions.some(transaction =>
            transaction.docChanged && transaction.annotation(Transaction.addToHistory) !== false)) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    }),
  });
}

export function replaceSource(editor, source) {
  if (editor.state.doc.toString() === source) return;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: source },
    annotations: Transaction.addToHistory.of(false),
  });
}
