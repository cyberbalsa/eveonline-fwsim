#!/usr/bin/env python3
"""Cache official logos/portraits for the verified current candidate cast."""
from pathlib import Path
import argparse
import datetime
import hashlib
import html
import json
import struct
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/identities'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'research/identity-catalog.json').read_text())
    selected = [e for e in catalog['entities'] if e['usage'] in
                ('contemporary-player-roster', 'official-NPC-militia')]
    selected += [p for p in catalog['pilotCandidates'] if p.get('eligibleForDefault2026FactionRole')]
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / 'provenance.json'
    previous = json.loads(manifest_path.read_text())['assets'] if manifest_path.exists() else []
    previous = {(a['entityType'], a['id']): a for a in previous}
    assets = []
    for entity in selected:
        key = (entity['entityType'], entity['id'])
        old = previous.get(key)
        if not args.refresh and old and (ROOT / old['file']).exists():
            assert hashlib.sha256((ROOT / old['file']).read_bytes()).hexdigest() == old['sha256']
            assets.append(old)
            continue
        url = entity['imageUrl']
        assert url.startswith('https://images.evetech.net/')
        request = urllib.request.Request(url, headers={'User-Agent': 'New-Eden-FW-Sim-Research/1.0'})
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            content_type = response.headers.get_content_type()
            assert content_type in ('image/png', 'image/jpeg', 'image/webp'), content_type
            ext = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}[content_type]
            if ext == 'png':
                assert body[:8] == b'\x89PNG\r\n\x1a\n'
                width, height = struct.unpack('>II', body[16:24])
                assert (width, height) == (128, 128)
            elif ext == 'jpg':
                assert body[:2] == b'\xff\xd8'
            else:
                assert body[:4] == b'RIFF' and body[8:12] == b'WEBP'
            filename = f'{entity["entityType"]}-{entity["id"]}.{ext}'
            (DEST / filename).write_bytes(body)
            assets.append({'entityType': entity['entityType'], 'id': entity['id'], 'name': entity['name'],
                           'usage': entity['usage'], 'file': f'assets/identities/{filename}',
                           'url': url, 'resolvedUrl': response.url, 'contentType': content_type,
                           'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                           'httpDate': response.headers.get('Date'), 'etag': response.headers.get('ETag'),
                           'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
                           'historicalAppearanceVerified': False,
                           'sourceIds': entity['sourceIds']})
        print('Cached', entity['name'], flush=True)
        time.sleep(0.15)
    manifest = {'researchDate': '2026-09-22', 'sourceService': 'https://images.evetech.net',
                'terms': 'https://support.eveonline.com/hc/en-us/articles/8563917741084-EVE-Online-Content-Creation-Terms-of-Use',
                'rights': 'CCP and applicable original rights holders; these image files are not relicensed as project code.',
                'limitations': 'Current official images of verified typed identities, not evidence of historical appearance, active pilots, endorsement, or real AI behavior.',
                'assets': assets}
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    gallery(assets)
    print(f'{len(assets)} official images; hashes recorded; no game implementation.')


def gallery(assets):
    cards = []
    for a in assets:
        name = html.escape(a['name'])
        cards.append(f'<article><img src="../{a["file"]}" width="128" height="128" alt="{name}">'
                     f'<h2>{name}</h2><p>{a["entityType"]} · {a["id"]}</p>'
                     f'<a href="{html.escape(a["url"])}">Official image</a></article>')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>War Council · Verified identity assets</title><style>
*{box-sizing:border-box}body{margin:0;background:#09121c;color:#e3edf7;font:16px/1.55 system-ui,sans-serif}
main{max-width:1200px;margin:auto;padding:36px 24px}h1{font-size:30px;margin:0 0 12px}p{color:#a6b8ca}
a{color:#82c4ff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:30px}
article{background:#122333;border:1px solid #294154;border-radius:10px;padding:20px;text-align:center}
article img{object-fit:contain}h2{font-size:17px;margin:12px 0 4px}article p{font-size:13px;margin:0 0 8px}
</style><main><h1>Real identities for War Council</h1>
<p>Verified in-game entities and current official images collected on 22 September 2026. Organization membership is not fleet attendance. Campaign behavior will be simulated.</p>
<p><a href="identity-catalog.json">Identity and affiliation evidence</a> · <a href="../assets/identities/provenance.json">Asset provenance</a> · <a href="../PRD.md">Game design PRD</a></p>
<section class="grid">'''+''.join(cards)+'''</section><p>Artwork remains CCP intellectual property and applicable original rights holders' material. See <a href="../CREDITS.md">credits and terms</a>.</p></main></html>'''
    (ROOT / 'research/identity-gallery.html').write_text(page)


if __name__ == '__main__':
    main()
