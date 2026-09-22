import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRequire = createRequire(resolve(root, 'package.json'));
let dependencyRequire = localRequire;
try { dependencyRequire.resolve('esbuild'); }
catch { dependencyRequire = createRequire(resolve(root, '../eveonline-monopoly/package.json')); }
const { build } = dependencyRequire('esbuild');
const threeRoot = resolve(dirname(dependencyRequire.resolve('three')), '..');
await mkdir(resolve(root, 'vendor'), { recursive: true });
await build({
  absWorkingDir: root, entryPoints: ['scripts/ship-viewer-source.js'], bundle: true,
  minify: true, format: 'esm', target: ['es2020'], outfile: 'vendor/ship-viewer.bundle.js',
  legalComments: 'linked', alias: {
    'three/addons': resolve(threeRoot, 'examples/jsm'),
    three: resolve(threeRoot, 'build/three.module.js')
  }
});
await copyFile(resolve(threeRoot, 'LICENSE'), resolve(root, 'vendor/THREE-LICENSE.txt'));
console.log('Built local EVE ship viewer.');
