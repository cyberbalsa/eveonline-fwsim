#!/usr/bin/env python3
"""Rebuild browser textures from the pinned, authentic CCP EVE cubemap.

Build-time only: pip install pillow numpy imagecodecs
The client DDS is fetched from its public content-addressed URL, validated,
and converted from signed BC6H linear RGB to sRGB JPEG. No invented pixels,
art generation, recoloring, or composited non-EVE space imagery is involved.
"""
from pathlib import Path
import hashlib
import json
import struct
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://resources.eveonline.com/a7/a74c90e0df6d352e_b2606d300e06f2aa952b1f325773a548'
MD5 = 'b2606d300e06f2aa952b1f325773a548'
RESOURCE = 'res:/dx9/scene/universe/c01_cube.dds'


def main():
    import imagecodecs
    import numpy as np
    from PIL import Image

    request = urllib.request.Request(URL, headers={'User-Agent': 'New-Eden-FW-Sim-Assets/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        source = response.read()
    if hashlib.md5(source).hexdigest() != MD5:
        raise ValueError('CCP source DDS checksum does not match pinned resource index')
    # DDS+DX10: 2048px faces, signed BC6H, one mip, six faces in DDS order.
    height, width = struct.unpack_from('<II', source, 12)
    if source[:4] != b'DDS ' or source[84:88] != b'DX10' or struct.unpack_from('<I', source, 128)[0] != 96:
        raise ValueError('Expected signed BC6H (DXGI_FORMAT_BC6H_SF16) cubemap')
    stride = ((width + 3) // 4) * ((height + 3) // 4) * 16
    destination = ROOT / 'assets' / 'backgrounds'
    destination.mkdir(parents=True, exist_ok=True)
    files = []
    for index, face in enumerate(['px', 'nx', 'py', 'ny', 'pz', 'nz']):
        raw = source[148 + index * stride:148 + (index + 1) * stride]
        linear = imagecodecs.bcn_decode(raw, -6, shape=(height, width, 3)).astype(np.float32)
        linear = np.clip(linear, 0, 1)
        srgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - .055)
        image = Image.fromarray(np.uint8(np.clip(srgb * 255 + .5, 0, 255)))
        # 1024px is ample for the small 3D fitting preview, reducing GPU memory.
        preview = image.resize((1024, 1024), Image.Resampling.LANCZOS)
        path = destination / f'c01-{face}.jpg'
        preview.save(path, quality=92, optimize=True, subsampling=0)
        files.append({'file': str(path.relative_to(ROOT)), 'face': face, 'width': 1024, 'height': 1024,
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        if face == 'px':
            path = destination / 'warzone.jpg'
            image.save(path, quality=94, optimize=True, subsampling=0)
            files.append({'file': str(path.relative_to(ROOT)), 'face': face, 'width': width, 'height': height,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = {
        'copyright': '© CCP Games', 'resource': RESOURCE, 'source': URL,
        'sourceMD5': MD5, 'sourceSHA256': hashlib.sha256(source).hexdigest(),
        'clientBuild': 3528119,
        'clientIndex': 'https://binaries.eveonline.com/eveonline_3528119.txt',
        'resourceIndex': 'https://binaries.eveonline.com/1d/1d34143a37d4b739_8c3e6b63b1f1ffbdd39c44736ba59aa9',
        'sceneResource': 'res:/dx9/scene/universe/c01_cube.black',
        'sceneSource': 'https://resources.eveonline.com/fe/fe75f82c85332114_f78c4c0239ab02f5fa03e47d12eb2322',
        'sceneEvidence': 'The original EveSpaceScene backgroundEffect resources bind c01_cube.dds to NebulaMap.',
        'processing': 'Decode signed BC6H; clip out-of-display-range linear values to [0,1]; standard sRGB transfer; JPEG encode. Cubemap faces additionally resized to 1024px. warzone.jpg is the original 2048px +X face.',
        'limitations': 'Actual EVE nebula texture. The client also layers separate stars and effects; this fan game does not reproduce the complete EVE background shader. No claim of exact regional or historical skybox assignment.',
        'retrieved': '2026-09-22', 'files': files
    }
    (destination / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Prepared {len(files)} authentic EVE skybox images with verified CCP source checksum.')


if __name__ == '__main__':
    main()
