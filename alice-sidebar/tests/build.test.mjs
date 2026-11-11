import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildPlugin } from '../build.mjs';

test('packaged plugin loads with only the Obsidian runtime available', async t => {
  const destination = await mkdtemp(join(tmpdir(), 'alice-sidebar-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  await buildPlugin(destination);
  assert.deepEqual((await readdir(destination)).sort(), ['main.js', 'manifest.json', 'styles.css']);
  const entry = { exports: {} };
  const requests = [];
  runInNewContext(await readFile(join(destination, 'main.js'), 'utf8'), {
    module: entry,
    require(id) {
      requests.push(id);
      assert.equal(id, 'obsidian', 'Local files must be bundled');
      return { Plugin: class {}, ItemView: class {}, Menu: class {} };
    },
  });
  assert.ok(requests.length > 0);
  const plugin = new entry.exports();
  let registeredType;
  plugin.registerView = type => { registeredType = type; };
  plugin.addCommand = () => {};
  plugin.addRibbonIcon = () => {};
  plugin.app = { workspace: { onLayoutReady() {} } };
  await plugin.onload();
  assert.equal(registeredType, 'alice-sidebar');
});
