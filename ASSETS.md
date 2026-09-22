# EVE art and renderer provenance

This game uses authentic EVE assets. It contains no AI-generated ship hulls or substitute stock space imagery. EVE artwork remains the intellectual property of CCP Games; the JavaScript dependency licenses do not license the artwork. This is an unofficial fan project and is not endorsed by CCP Games. See CCP's [content creation terms](https://support.eveonline.com/hc/en-us/articles/8563917741084-EVE-Online-Content-Creation-Terms-of-Use) and [community toolkit](https://community.eveonline.com/community/content-creation/toolkit/).

## Historical colored UI icons

The ten `assets/icons/*.png` files are **unchanged 2014 Phoebe 1.0 Neocom icons**, copied byte-for-byte from the sibling `eveonline-monopoly` project. Their original source is CCP's [Phoebe 1.0 icon archive](https://content.eveonline.com/data/Phoebe_1.0_Icons.zip). The [manifest](assets/icons/provenance.json) preserves each original archive filename and SHA-256. The game's window layout and CSS are project-authored styling inspired by EVE; no EVE UI source code is included.

## Real EVE skybox

`assets/backgrounds/warzone.jpg` and the six `c01-{px,nx,py,ny,pz,nz}.jpg` files are converted from the actual client cubemap `res:/dx9/scene/universe/c01_cube.dds`. This texture was downloaded directly from [CCP's public resource CDN](https://resources.eveonline.com/a7/a74c90e0df6d352e_b2606d300e06f2aa952b1f325773a548), verified against the MD5 in CCP's public client resource index for build **3528119**. The original [`c01_cube.black` scene](https://resources.eveonline.com/fe/fe75f82c85332114_f78c4c0239ab02f5fa03e47d12eb2322) explicitly binds this DDS as its background effect's **NebulaMap**.

The DDS is a six-face, 2048 × 2048, signed BC6H floating point cubemap. Conversion decodes the original pixels, clips values beyond the display range, applies the standard linear RGB → sRGB transfer, and encodes JPEG. The map background is the full-resolution +X face; the model preview uses 1024px faces to save GPU memory. The [background manifest](assets/backgrounds/provenance.json) records every URL, resource name, transformation, source checksum, and output checksum.

The client combines this nebula with additional star layers and effects. This project renders the genuine nebula texture without claiming to reproduce the complete EVE background shader, or to identify the exact sky seen from a particular warzone system or historical date. CCP's [original ccpwgl repository](https://github.com/ccpgames/ccpwgl) documents the official WebGL scene/resource system; its retired assetpath service was not used as the download source.

Rebuild these files with `python3 scripts/prepare-game-assets.py` in a Python environment containing `pillow`, `numpy`, and `imagecodecs`. This is an optional build tool; the browser uses only the checked-in JPEGs. It fetches one content-addressed public DDS and rejects a checksum mismatch.

## Actual ship and structure geometry

The Rifter, Catalyst, Caracal, Drake, Dominix, Venture, Providence, and Astrahus models in `assets/models/` contain **CCP mesh geometry**, simplified for small previews. They were copied byte-for-byte from the sibling project. The conversion source is [EstamelGG / iDea SP1's EVE Model Gallery, pinned revision 951c041](https://github.com/EstamelGG/EVE_Model_Gallery/tree/951c041d363ce184886a194fef67f0ae1ee5f33f). The gallery's reconstructed texture maps, materials, and lighting are not included. Each GLB retains its embedded original download URL and provenance; the [model manifest](assets/models/provenance.json) also records the type ID and checksum.

The interactive preview is **real geometry with a project-authored metallic finish**, using the EVE cubemap for the background and reflections. It does not reproduce EVE's client materials, paint schemes, or full shaders. For exact painted appearance, the local official renders remain available.

## Official ship renders and identities

The eight `assets/ships/*.png` images come from CCP's [EVE Image Server](https://images.evetech.net/), through `/types/{typeID}/render?size=512`. They are unmodified copies of the sibling project's verified renders. The [ship manifest](assets/ships/provenance.json) lists type IDs, source URLs, and checksums. Existing alliance logos, corporation logos, and character portraits retain their [separate identity provenance](assets/identities/provenance.json). These images represent the EVE organizations and characters; their presence does not imply endorsement by those players.

## Genuine EVE UI audio

Five prepared EVE interface cues are included: `interface`, `notification`, `complete`, `capacitor`, and `structure`. They are byte-identical to the sibling project's prepared clips and preserve its [source and checksum manifest](assets/sounds/provenance.json). The source author, Mad_Guns22, recorded CCP's in-game UI audio and [published the recording collection](https://www.reddit.com/r/Eve/comments/2r3pwl/eve_online_audio_warning_and_training_completed/). These are genuine EVE recordings, trimmed and faded, not synthetic imitations. No Kenney dice or generic thruster sounds were copied.

## Local 3D viewer

`ship-viewer.js` exports `createShipViewer(container)`. The returned object provides `setModel(name, faction)`, `setVisible(boolean)`, `destroy()`, and rendering `metrics`. Give the container an explicit height. A viewer creates one WebGL context; calling the constructor again on the same container destroys the previous viewer. Model selection reuses the same context and caches up to eight local meshes.

Pointer drag and arrow keys rotate the model. Automatic rotation runs at at most 24 fps, honors reduced-motion preferences, and pauses offscreen, in hidden browser tabs, or after `setVisible(false)`. Device pixel ratio is capped at 1.5. WebGL failure/context loss shows the official ship render; destruction cancels the animation, disconnects observers/listeners, and releases geometry, materials, textures, and the context.

Renderer source: `scripts/ship-viewer-source.js`. Rebuild with `node scripts/build-ship-viewer.mjs` after installing `three@0.180.0` and `esbuild@0.25.10`; the build tool can also use the existing sibling project's dependencies. The checked-in ES module in `vendor/ship-viewer.bundle.js` works without a package install, runtime CDN, live EVE resource server, API token, or application server. Three.js is MIT-licensed; its [license](vendor/THREE-LICENSE.txt) and generated legal notice are included.

## Locally hosted typography

The interface uses **Barlow** and **Barlow Condensed**, designed by Jeremy Tribby, in regular, medium, semibold, and bold weights. These are third-party open fonts chosen for compact client-style typography, not CCP's proprietary EVE client fonts. The eight Latin-subset WOFF2 files in `assets/fonts/` were downloaded unchanged from [Google Fonts](https://fonts.google.com/specimen/Barlow) on September 22, 2026, and total approximately 173 KiB. `styles.css` loads them locally; the game makes no font or stylesheet CDN requests.

The [font manifest](assets/fonts/provenance.json) records the exact source URLs, sizes, and SHA-256 checksums. Both families use the **SIL Open Font License 1.1**. The original [Barlow license](assets/fonts/BARLOW-OFL.txt) and [Barlow Condensed license](assets/fonts/BARLOWCONDENSED-OFL.txt) are included, copied from the [Google Fonts source repository](https://github.com/google/fonts/tree/main/ofl/barlow).
