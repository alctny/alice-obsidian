import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { buildTheme, watchTheme } from './build.mjs';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'alice-theme-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('release embeds every original SVG and preserves all other CSS', async t => {
  const themeDir = await temporaryDirectory(t);
  const result = await buildTheme({ themeDir });
  assert.equal(result.assetCount, 10);
  assert.doesNotMatch(result.css, /url\(["']\.\/assets\//);
  const source = await readFile(join(projectDir, 'alice-mindnight/src/theme.css'), 'utf8');
  const references = [...source.matchAll(/url\("(\.\/assets\/[^"\n]+\.svg)"\)/g)];
  const embedded = [...result.css.matchAll(/url\("data:image\/svg\+xml;base64,([^"\n]+)"\)/g)];
  assert.equal(embedded.length, references.length);
  for (const [index, match] of references.entries()) {
    const original = await readFile(resolve(projectDir, 'alice-mindnight/src', match[1]));
    assert.deepEqual(Buffer.from(embedded[index][1], 'base64'), original);
  }
  const restored = result.css.slice(result.css.indexOf('\n') + 1)
    .replace(/url\("data:image\/svg\+xml;base64,[^"\n]+"\)/g, () => references.shift()[0]);
  assert.equal(restored, source);
  assert.equal(await readFile(join(themeDir, 'theme.css'), 'utf8'), result.css);
  assert.equal(await readFile(join(themeDir, 'manifest.json'), 'utf8'),
    await readFile(join(projectDir, 'alice-mindnight/manifest.json'), 'utf8'));
  assert.equal(JSON.parse(await readFile(join(themeDir, 'manifest.json'), 'utf8')).name,
    'alice-mindnight');
});

test('dev deploys SVG files, uses encoded resource URLs and keeps unchanged cache versions', async t => {
  const themeDir = await temporaryDirectory(t);
  const options = {
    mode: 'dev', themeDir,
    resourceBase: 'app://local/測試 Vault/.obsidian/themes/alice-mindnight/assets?old=123',
  };
  const first = await buildTheme(options);
  assert.equal(first.assetCount, 10);
  assert.doesNotMatch(first.css, /data:image/);
  const urls = [...first.css.matchAll(/url\("(app:[^"]+)"\)/g)].map(match => new URL(match[1]));
  assert.equal(new Set(urls.map(url => url.pathname)).size, 10);
  for (const url of urls) {
    assert.match(url.pathname, /^\/%E6%B8%AC%E8%A9%A6%20Vault\/\.obsidian\/themes\/alice-mindnight\/assets\//);
    assert.ok(url.searchParams.get('v'));
    assert.equal(url.searchParams.get('old'), null);
    const filename = decodeURIComponent(url.pathname.split('/').at(-1));
    assert.deepEqual(await readFile(join(themeDir, 'assets', filename)),
      await readFile(join(projectDir, 'alice-mindnight/src/assets', filename)));
  }
  const second = await buildTheme(options);
  assert.equal(first.css, second.css);
});

test('reading illustration preserves SVG definitions and refreshes its URL only when artwork changes', async t => {
  const directory = await temporaryDirectory(t);
  const source = join(directory, 'src');
  const themeDir = join(directory, 'preview');
  await mkdir(join(source, 'assets'), { recursive: true });
  const original = await readFile(join(projectDir, 'alice-mindnight/src/assets/alice-reading.svg'), 'utf8');
  const css = '.theme-dark .view-content::after { background: url("./assets/alice-reading.svg"); }';
  await writeFile(join(source, 'assets/alice-reading.svg'), original);
  await writeFile(join(source, 'theme.css'), css);
  const options = { mode: 'dev', source, themeDir, resourceBase: 'app://local/test/assets' };
  const assetUrl = result => result.css.match(/url\("([^"]+)"\)/)[1];

  const first = await buildTheme(options);
  await writeFile(join(source, 'theme.css'), css + '\n.theme-dark { --alice-note-art-opacity: 0.3; }');
  const restyled = await buildTheme(options);
  assert.equal(assetUrl(restyled), assetUrl(first));
  assert.notEqual(restyled.css, first.css);

  const changed = original.replace('#e8bef2', '#edc9f5');
  assert.notEqual(changed, original);
  await writeFile(join(source, 'assets/alice-reading.svg'), changed);
  const redrawn = await buildTheme(options);
  assert.notEqual(assetUrl(redrawn), assetUrl(first));
  assert.equal(await readFile(join(themeDir, 'assets/alice-reading.svg'), 'utf8'), changed);

  const release = await buildTheme({ source, themeDir: join(directory, 'release') });
  const embedded = release.css.match(/data:image\/svg\+xml;base64,([^"]+)/)[1];
  assert.equal(Buffer.from(embedded, 'base64').toString('utf8'), changed);
  for (const definition of ['linearGradient', 'clipPath', 'use']) {
    assert.ok(changed.includes('<' + definition));
  }
});

test('watch mode updates deployed SVGs and CSS after either source changes', { timeout: 10000 }, async t => {
  const directory = await temporaryDirectory(t);
  const source = join(directory, 'src');
  const themeDir = join(directory, 'preview');
  await mkdir(join(source, 'assets'), { recursive: true });
  const original = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>';
  const changed = original.replace('r="2"', 'r="4"');
  await writeFile(join(source, 'assets', 'test.svg'), original);
  await writeFile(join(source, 'theme.css'), '.test { background: url("./assets/test.svg"); }');
  let notify;
  const close = await watchTheme({ source, themeDir, resourceBase: 'app://local/test/assets' }, () => notify?.());
  t.after(close);
  const initialCss = await readFile(join(themeDir, 'theme.css'), 'utf8');

  async function afterUpdate(change) {
    const updated = new Promise(resolve => { notify = resolve; });
    await change();
    await updated;
    notify = undefined;
  }

  await afterUpdate(() => writeFile(join(source, 'assets', 'test.svg'), changed));
  assert.equal(await readFile(join(themeDir, 'assets', 'test.svg'), 'utf8'), changed);
  assert.notEqual(await readFile(join(themeDir, 'theme.css'), 'utf8'), initialCss);
  await afterUpdate(() => writeFile(join(source, 'theme.css'), '.changed { mask: url("./assets/test.svg"); }'));
  assert.match(await readFile(join(themeDir, 'theme.css'), 'utf8'), /\.changed \{ mask: url\("app:/);

  // Editors often save by replacing the file rather than writing to its inode.
  await writeFile(join(source, 'assets', 'replacement.tmp'), original);
  await afterUpdate(() => rename(join(source, 'assets', 'replacement.tmp'), join(source, 'assets', 'test.svg')));
  assert.equal(await readFile(join(themeDir, 'assets', 'test.svg'), 'utf8'), original);

  await afterUpdate(async () => {
    await writeFile(join(source, 'assets', 'new.svg'), changed);
    await writeFile(join(source, 'theme.css'), '.new { mask: url("./assets/new.svg"); }');
  });
  assert.equal(await readFile(join(themeDir, 'assets', 'new.svg'), 'utf8'), changed);
  assert.match(await readFile(join(themeDir, 'theme.css'), 'utf8'), /new\.svg\?v=/);

  await close();
  const stoppedCss = await readFile(join(themeDir, 'theme.css'), 'utf8');
  await writeFile(join(source, 'theme.css'), '.stopped {}');
  await delay(600);
  assert.equal(await readFile(join(themeDir, 'theme.css'), 'utf8'), stoppedCss);
});
