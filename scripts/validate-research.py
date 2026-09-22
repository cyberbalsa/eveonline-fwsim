#!/usr/bin/env python3
"""Validate research consistency, provenance, and proposal references offline."""
from pathlib import Path
import hashlib
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRECTORIES = {'node_modules', '.git', '.cache', '_site', '__pycache__', 'test-results', 'playwright-report'}


def project_files(pattern):
    """Validate authored artifacts, not installed dependencies or generated test traces."""
    return sorted(path for path in ROOT.rglob(pattern)
                  if not EXCLUDED_DIRECTORIES.intersection(path.relative_to(ROOT).parts))


def load(relative):
    return json.loads((ROOT / relative).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    json_files = project_files('*.json')
    for path in json_files:
        json.loads(path.read_text())
    sources = load('research/sources.json')
    ids = {s['id'] for s in sources}
    require(len(ids) == len(sources), 'Duplicate source IDs')
    for s in sources:
        for field in ('id', 'title', 'url', 'publisher', 'publishedDate', 'accessedDate', 'kind', 'claims', 'uncertainties'):
            require(field in s, f'{s["id"]}: missing {field}')
        require(s['url'].startswith('https://'), f'Unexpected source scheme: {s["id"]}')

    raw = load('research/raw/manifest.json')
    for f in raw['files']:
        require(hashlib.sha256((ROOT / f['file']).read_bytes()).hexdigest() == f['sha256'], f'Raw hash changed: {f["file"]}')
    world = load('data/warzone-snapshot.json')
    observed = {s['solar_system_id']: s for s in load('research/raw/esi-fw-systems-2026-09-22.json')
                if s['owner_faction_id'] in (500001, 500004)}
    require({s['id'] for s in world['systems']} == set(observed), 'Snapshot roster mismatch')
    for s in world['systems']:
        source = observed[s['id']]
        for field, raw_field in [('occupierFactionId', 'occupier_faction_id'), ('originalFactionId', 'owner_faction_id'),
                                 ('victoryPoints', 'victory_points'), ('victoryPointsThreshold', 'victory_points_threshold')]:
            require(s[field] == source[raw_field], f'{s["name"]}: observation mismatch {field}')
    root = ET.parse(ROOT / 'research/warzone-map.svg').getroot()
    svg = {'s': 'http://www.w3.org/2000/svg'}
    require(len(root.findall('s:line', svg)) == len(world['edges']), 'SVG gate count mismatch')
    require(len(root.findall('s:g/s:title', svg)) == len(world['systems']), 'SVG star count mismatch')

    catalog = load('research/identity-catalog.json')
    entities = catalog['entities'] + catalog['pilotCandidates']
    require(len({(e['entityType'], e['id']) for e in entities}) == len(entities), 'Duplicate typed identities')
    for e in entities:
        require(set(e['sourceIds']) <= ids, f'Unknown identity source: {e["name"]}')
    selected = [e for e in catalog['entities'] if e['usage'] in ('contemporary-player-roster', 'official-NPC-militia')]
    selected += [e for e in catalog['pilotCandidates'] if e.get('eligibleForDefault2026FactionRole')]
    for e in selected:
        require(e['currentObservation'].get('faction_id') in (500001, 500004), f'Missing contemporary faction: {e["name"]}')
    assets = load('assets/identities/provenance.json')['assets']
    require({(e['entityType'], e['id']) for e in selected} == {(a['entityType'], a['id']) for a in assets}, 'Selected cast/assets mismatch')
    for a in assets:
        require(hashlib.sha256((ROOT / a['file']).read_bytes()).hexdigest() == a['sha256'], f'Asset hash changed: {a["file"]}')

    design = load('design/ruleset-proposal.json')
    require(design['confirmedUserChoices']['browserOnly'], 'Browser-only decision missing')
    require(design['fidelityReleaseReady'] is False, 'Unimplemented proposal incorrectly marked release ready')
    for relative in design['content'].values():
        require((ROOT / 'design' / relative).resolve().exists(), f'Missing content: {relative}')
    for field in ('publishedParameters', 'unresolvedParameters', 'disabledOverlays', 'actions'):
        require(len({x['id'] for x in design[field]}) == len(design[field]), f'Duplicate {field} IDs')
        for item in design[field]:
            require(set(item['sourceRefs']) <= ids, f'Unknown rule source in {item["id"]}')
    for p in design['unresolvedParameters']:
        require(p['value'] is None, f'Unverified value filled: {p["id"]}')
    for a in design['actions']:
        require(set(a['requires']) <= set(design['predicateRegistry']), f'Unknown predicate: {a["id"]}')
        require(set(a['handlers']) <= set(design['handlerRegistry']), f'Unknown handler: {a["id"]}')
    states = set(design['captureStateContract']['states'])
    for transition in design['captureStateContract']['transitions']:
        require(transition['from'] in states and transition['to'] in states, 'Invalid state transition reference')

    local_links = 0
    for path in project_files('*.md'):
        for target in re.findall(r'\]\(([^\n)]+)\)', path.read_text()):
            if target.startswith(('https://', 'http://', '#', 'mailto:')):
                continue
            target = urllib.parse.unquote(target.split('#', 1)[0].strip('<>'))
            if not target:
                continue
            require((path.parent / target).resolve().exists(), f'Broken link in {path.relative_to(ROOT)}: {target}')
            local_links += 1
    summary = {'status': 'passed', 'jsonFilesParsed': len(json_files), 'sourceRecords': len(sources),
               'uniqueSourceUrls': len({s['url'] for s in sources}), 'rawHashesVerified': len(raw['files']),
               'systemsVerified': len(world['systems']), 'svgGateLinksVerified': len(world['edges']),
               'typedIdentities': len(entities), 'localIdentityAssetsVerified': len(assets),
               'designActionContracts': len(design['actions']), 'markdownLocalLinksVerified': local_links,
               'scope': 'Research consistency and file integrity only; no game engine, real-time rules conformance, or campaign balance tested.'}
    (ROOT / 'research/validation-results.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
