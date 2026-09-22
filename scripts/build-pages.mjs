import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Keep the repository prefix locally so browser tests catch broken absolute URLs.
const output = new URL('_site/eveonline-fwsim/', root);
const published = [
  'index.html', '.nojekyll',
  'game.js', 'engine.js', 'rules.js', 'map.js', 'audio.js', 'ship-viewer.js',
  'people.js', 'diplomacy.js', 'ui-social.js', 'save-slots.js',
  'styles.css', 'map.css', 'game-ui.css',
  'assets', 'data', 'vendor', 'research', 'design', 'docs',
  'README.md', 'PRD.md', 'ASSETS.md', 'CREDITS.md'
];

// Pages caches individual files. One content-derived key keeps every module and
// stylesheet in the same release when someone returns with an older cache.
const runtimePaths = published.filter(path => /\.(js|css|html)$/.test(path));
const sources = await Promise.all(runtimePaths.map(async path => [path, await readFile(new URL(path, root), 'utf8')]));
const digest = createHash('sha256');
for (const [path, source] of sources) digest.update(path).update('\0').update(source);
const release = digest.digest('hex').slice(0, 16);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of published) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
for (const [path, source] of sources) {
  let versioned = source;
  if (path.endsWith('.js')) versioned = source.replace(/\b((?:from|import)\s+|import\s*\(\s*)(['"])(\.\/[^'"]+\.js)\2/g, (_, prefix, quote, resource) => `${prefix}${quote}${resource}?v=${release}${quote}`);
  if (path.endsWith('.html')) versioned = source.replace(/((?:src|href)=['"])(\.\/[^'"]+\.(?:js|css))(['"])/g, `$1$2?v=${release}$3`);
  if (versioned !== source) await writeFile(new URL(path, output), versioned);
}
console.log(`GitHub Pages site prepared at ${fileURLToPath(output)}`);
