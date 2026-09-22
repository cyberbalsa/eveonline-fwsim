import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Keep the repository prefix locally so browser tests catch broken absolute URLs.
const output = new URL('_site/eveonline-fwsim/', root);
const published = [
  'index.html', '.nojekyll',
  'game.js', 'engine.js', 'rules.js', 'map.js', 'audio.js', 'ship-viewer.js',
  'styles.css', 'map.css', 'game-ui.css',
  'assets', 'data', 'vendor', 'research', 'design', 'docs',
  'README.md', 'PRD.md', 'ASSETS.md', 'CREDITS.md'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of published) {
  await cp(new URL(path, root), new URL(path, output), { recursive: true });
}
console.log(`GitHub Pages site prepared at ${fileURLToPath(output)}`);
