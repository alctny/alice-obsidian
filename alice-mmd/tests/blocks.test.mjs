import test from 'node:test';
import assert from 'node:assert/strict';
import { mermaidBlockAt } from '../src/blocks.js';

test('extracts only the selected Mermaid block and retains frontmatter', () => {
  const source = '# Note\n\n```mermaid\n---\nconfig:\n  layout: elk\n---\nflowchart TD\n A --> B\n```\n\nTail\n';
  const block = mermaidBlockAt(source, 6);
  assert.equal(block.content, '---\nconfig:\n  layout: elk\n---\nflowchart TD\n A --> B\n');
  assert.equal(source.slice(0, block.start) + source.slice(block.end), '# Note\n\n\nTail\n');
  assert.equal(mermaidBlockAt(source, 11), null);
});

test('handles tilde fences, CRLF and a closing fence at end of file', () => {
  const source = '~~~mermaid\r\nA --> B\r\n~~~';
  const block = mermaidBlockAt(source, 1);
  assert.equal(block.content, 'A --> B\r\n');
  assert.equal(block.end, source.length);
});

test('ignores nested fence examples, other languages and incomplete blocks', () => {
  assert.equal(mermaidBlockAt('````md\n```mermaid\nA --> B\n```\n````', 2), null);
  assert.equal(mermaidBlockAt('```js\nA --> B\n```', 1), null);
  assert.equal(mermaidBlockAt('```mermaid\nA --> B', 1), null);
});

test('finds the requested block among multiple diagrams', () => {
  const source = '```mermaid\nA --> B\n```\n\n```mermaid\nC --> D\n```';
  assert.equal(mermaidBlockAt(source, 5).content, 'C --> D\n');
});
