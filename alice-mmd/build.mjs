import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/alice-mmd/', import.meta.url);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('src/main.js', import.meta.url))],
  outfile: fileURLToPath(new URL('main.js', output)),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['obsidian'],
  minify: true,
  legalComments: 'eof',
  footer: { js: 'module.exports = module.exports.default;' },
});
for (const name of ['manifest.json', 'styles.css']) {
  await copyFile(new URL(name, import.meta.url), new URL(name, output));
}
console.log(`Plugin: ${fileURLToPath(output)}`);
