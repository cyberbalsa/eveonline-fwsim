import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path));
const json = async path => JSON.parse(await read(path));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedHulls = ['astrahus', 'caracal', 'catalyst', 'dominix', 'drake', 'providence', 'rifter', 'venture'];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngSize(bytes, file) {
  assert.deepEqual(bytes.subarray(0, 8), pngSignature, `${file}: genuine PNG header`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${file}: image dimensions present`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(bytes, file) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, `${file}: JPEG start marker`);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, `${file}: JPEG end marker`);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    assert.equal(bytes[offset++], 0xff, `${file}: valid JPEG segment marker`);
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= bytes.length, `${file}: bounded JPEG segment`);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      assert.equal(bytes[offset + 2], 8, `${file}: browser-compatible sample precision`);
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  assert.fail(`${file}: JPEG has no frame dimensions`);
}

function parseGlb(bytes, file) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${file}: glTF binary magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${file}: glTF version 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${file}: declared file length is intact`);
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    assert.ok(offset + 8 <= bytes.length, `${file}: complete chunk header`);
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, `${file}: aligned chunk`);
    assert.ok(offset + 8 + length <= bytes.length, `${file}: complete chunk data`);
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  assert.equal(chunks[0]?.type, 0x4e4f534a, `${file}: embedded JSON chunk`);
  const binary = chunks.find(chunk => chunk.type === 0x004e4942)?.data;
  assert.ok(binary?.length > 0, `${file}: embedded geometry buffer`);
  return { gltf: JSON.parse(chunks[0].data.toString()), binary };
}

test('every shipped EVE asset is covered by a provenance manifest with a matching SHA-256', async () => {
  for (const directory of ['icons', 'sounds', 'models', 'ships', 'backgrounds', 'identities']) {
    const manifest = await json(`assets/${directory}/provenance.json`);
    const entries = manifest.files || manifest.assets || manifest.icons.map(icon => ({
      ...icon, file: `assets/icons/${icon.name}.png`
    }));
    assert.ok(entries.length > 0, `${directory}: manifest is populated`);
    assert.equal(new Set(entries.map(entry => entry.file)).size, entries.length, `${directory}: no duplicate entries`);
    for (const entry of entries) {
      assert.ok(entry.file.startsWith(`assets/${directory}/`), `${entry.file}: correct asset directory`);
      const localPath = relative(root, resolve(root, entry.file));
      assert.ok(!localPath.startsWith('..') && !isAbsolute(localPath), `${entry.file}: local asset path`);
      assert.match(entry.sha256, /^[a-f0-9]{64}$/, `${entry.file}: SHA-256 supplied`);
      const bytes = await read(entry.file);
      assert.ok(bytes.length > 0, `${entry.file}: nonempty file`);
      assert.equal(sha256(bytes), entry.sha256, `${entry.file}: contents match recorded provenance`);
      if (entry.bytes !== undefined) assert.equal(bytes.length, entry.bytes, `${entry.file}: recorded size`);
    }
    const shipped = (await readdir(resolve(root, `assets/${directory}`)))
      .filter(file => file !== 'provenance.json').map(file => `assets/${directory}/${file}`).sort();
    assert.deepEqual(shipped, entries.map(entry => entry.file).sort(), `${directory}: no uncredited or missing assets`);
  }
});

test('historical Neocom icons retain their original CCP archive attribution and PNG data', async () => {
  const manifest = await json('assets/icons/provenance.json');
  assert.equal(manifest.source, 'https://content.eveonline.com/data/Phoebe_1.0_Icons.zip');
  assert.match(manifest.copyright, /CCP Games/);
  assert.equal(manifest.icons.length, 10);
  for (const icon of manifest.icons) {
    assert.match(icon.source, /^Icons\/items\/.+\.png$/, `${icon.name}: original archive member`);
    const file = `assets/icons/${icon.name}.png`;
    assert.deepEqual(pngSize(await read(file), file), { width: 64, height: 64 });
  }
});

test('all eight hull GLBs contain nontrivial, self-contained mesh geometry and retained source attribution', async () => {
  const manifest = await json('assets/models/provenance.json');
  assert.deepEqual(manifest.files.map(file => file.name).sort(), expectedHulls);
  for (const entry of manifest.files) {
    const { gltf, binary } = parseGlb(await read(entry.file), entry.file);
    assert.equal(gltf.extras.source, entry.source, `${entry.name}: original source remains embedded`);
    assert.equal(gltf.extras.copyright, entry.copyright, `${entry.name}: embedded CCP attribution`);
    assert.match(gltf.extras.materials, /Project-authored/, `${entry.name}: honest material attribution`);
    assert.match(entry.source, /^https:\/\/raw\.githubusercontent\.com\/EstamelGG\/EVE_Model_Gallery\/[a-f0-9]{40}\//);
    assert.ok(entry.source.endsWith(`/${entry.typeID}_lite.glb`), `${entry.name}: source type ID agrees`);
    assert.ok(gltf.meshes?.length > 0 && gltf.nodes?.some(node => node.mesh !== undefined));
    assert.ok(gltf.scenes?.[gltf.scene ?? 0]?.nodes?.length > 0, `${entry.name}: scene has geometry nodes`);
    assert.ok(gltf.buffers.every(buffer => !buffer.uri), `${entry.name}: no external model service needed`);
    assert.ok((gltf.images || []).every(image => !image.uri || image.uri.startsWith('data:')), `${entry.name}: no remote texture dependency`);
    for (const view of gltf.bufferViews) {
      assert.equal(view.buffer, 0, `${entry.name}: embedded buffer`);
      assert.ok((view.byteOffset || 0) + view.byteLength <= binary.length, `${entry.name}: buffer view stays within binary chunk`);
    }
    let vertices = 0, triangles = 0;
    const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      assert.equal(primitive.mode ?? 4, 4, `${entry.name}: triangle mesh`);
      const position = gltf.accessors[primitive.attributes.POSITION];
      assert.equal(position.type, 'VEC3');
      assert.equal(position.componentType, 5126, `${entry.name}: floating point vertices`);
      const view = gltf.bufferViews[position.bufferView];
      const stride = view.byteStride || 12;
      const start = (view.byteOffset || 0) + (position.byteOffset || 0);
      assert.ok(start + (position.count - 1) * stride + 12 <= (view.byteOffset || 0) + view.byteLength);
      for (let vertex = 0; vertex < position.count; vertex++) for (let axis = 0; axis < 3; axis++) {
        const value = binary.readFloatLE(start + vertex * stride + axis * 4);
        assert.ok(Number.isFinite(value), `${entry.name}: finite vertex coordinate`);
        minimum[axis] = Math.min(minimum[axis], value);
        maximum[axis] = Math.max(maximum[axis], value);
      }
      vertices += position.count;
      triangles += (primitive.indices === undefined ? position.count : gltf.accessors[primitive.indices].count) / 3;
    }
    assert.ok(vertices > 1000 && triangles > 1000, `${entry.name}: substantial hull geometry, not a flat image quad`);
    assert.ok(maximum.every((value, axis) => value - minimum[axis] > 0.01), `${entry.name}: geometry occupies three dimensions`);
  }
});

test('official painted renders cover every hull and identify matching EVE type IDs', async () => {
  const models = await json('assets/models/provenance.json');
  const renders = await json('assets/ships/provenance.json');
  assert.deepEqual(renders.files.map(file => file.name).sort(), expectedHulls);
  for (const entry of renders.files) {
    assert.equal(entry.typeID, models.files.find(model => model.name === entry.name).typeID);
    assert.equal(entry.source, `https://images.evetech.net/types/${entry.typeID}/render?size=512`);
    // The sibling retained .png filenames for EVE Image Server responses;
    // that service can return JPEG bytes. Validate the actual format, without
    // re-encoding the original artwork merely to change its extension.
    const bytes = await read(entry.file);
    const dimensions = bytes.subarray(0, 8).equals(pngSignature)
      ? pngSize(bytes, entry.file) : jpegSize(bytes, entry.file);
    assert.deepEqual(dimensions, { width: 512, height: 512 });
  }
});

test('EVE skybox has six distinct valid square faces and a full-resolution map background', async () => {
  const manifest = await json('assets/backgrounds/provenance.json');
  assert.equal(new URL(manifest.source).hostname, 'resources.eveonline.com');
  assert.ok(manifest.source.endsWith(`_${manifest.sourceMD5}`), 'content-addressed CCP URL agrees with source checksum');
  assert.match(manifest.sourceSHA256, /^[a-f0-9]{64}$/);
  assert.match(manifest.resource, /^res:\/dx9\/scene\/universe\/.+_cube\.dds$/);
  for (const source of [manifest.clientIndex, manifest.resourceIndex]) {
    assert.equal(new URL(source).hostname, 'binaries.eveonline.com', 'CCP index provenance');
  }
  assert.equal(new URL(manifest.sceneSource).hostname, 'resources.eveonline.com');
  assert.match(manifest.sceneEvidence, /NebulaMap/);
  const faces = manifest.files.filter(entry => entry.file !== 'assets/backgrounds/warzone.jpg');
  assert.deepEqual(faces.map(entry => entry.face).sort(), ['nx', 'ny', 'nz', 'px', 'py', 'pz']);
  assert.equal(new Set(faces.map(entry => entry.sha256)).size, 6, 'six different faces, not repeated artwork');
  for (const entry of manifest.files) {
    const expected = entry.file.endsWith('/warzone.jpg') ? 2048 : 1024;
    assert.deepEqual(jpegSize(await read(entry.file), entry.file), { width: expected, height: expected });
    assert.equal(entry.width, expected); assert.equal(entry.height, expected);
  }
  assert.equal(manifest.files.filter(entry => entry.file === 'assets/backgrounds/warzone.jpg').length, 1);
});

test('viewer ships an accessible licensed local bundle with no remote runtime imports or asset endpoints', async () => {
  const entry = (await read('ship-viewer.js')).toString();
  assert.match(entry, /export\s*\{\s*createShipViewer\s*\}\s*from\s*['"]\.\/vendor\/ship-viewer\.bundle\.js['"]/);
  const bundle = (await read('vendor/ship-viewer.bundle.js')).toString();
  assert.ok(bundle.length > 100000, 'renderer dependency is bundled locally');
  assert.match(bundle, /export\s*\{[^}]*createShipViewer/);
  // Static and dynamic imports would introduce runtime dependencies beyond the
  // checked-in bundle. Documentation URLs in license comments are harmless.
  assert.doesNotMatch(bundle, /\bimport\s*\(/, 'no dynamic module loading');
  assert.doesNotMatch(bundle, /\bimport\s*(?:['"]|[^;\n]*\bfrom\s*['"])/, 'no external static imports');
  assert.doesNotMatch(bundle, /\bexport\s*[^;\n]*\bfrom\s*['"]/, 'no external re-exports');
  const literalEndpoints = [...bundle.matchAll(/['"`](https?:\/\/[^'"`\s]+)['"`]/g)].map(match => match[1]);
  assert.ok(literalEndpoints.every(url => url === 'http://www.w3.org/1999/xhtml'),
    `runtime URL literals must only be DOM namespaces: ${literalEndpoints.join(', ')}`);
  const license = (await read('vendor/THREE-LICENSE.txt')).toString();
  assert.match(license, /The MIT License/);
  assert.match(license, /three\.js authors/i);
  assert.match(license, /Permission is hereby granted/);
  const notice = (await read('vendor/ship-viewer.bundle.js.LEGAL.txt')).toString();
  assert.match(notice, /Three\.js Authors/);
  assert.match(notice, /SPDX-License-Identifier: MIT/);
});
