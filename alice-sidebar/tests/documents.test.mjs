import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { documents } = require('../src/documents.cjs');

test('collects every root tab without stopping at the first, keeping duplicate files', () => {
  const first = { file: 'README.md' };
  const second = { file: 'README.md' };
  const workspace = {
    iterateRootLeaves(callback) {
      // Obsidian stops traversal when the callback returns a truthy value.
      for (const leaf of [first, second]) {
        if (callback(leaf)) break;
      }
    },
    getLeavesOfType() { throw new Error('Must not enumerate sidebar panels'); },
  };
  assert.deepEqual(documents(workspace), [first, second]);
  assert.notEqual(documents(workspace)[0], documents(workspace)[1]);
});
