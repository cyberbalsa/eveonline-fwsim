#!/usr/bin/env python3
"""Rebuild the research map from frozen public data, without network or packages."""
from collections import Counter, deque
from pathlib import Path
import csv
import hashlib
import html
import json

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'research/raw'
FACTIONS = {500001: 'Caldari', 500004: 'Gallente'}


def read(name):
    return json.loads((RAW / name).read_text())


def components(adj, omit_node=None, omit_edge=None):
    remaining = set(adj) - {omit_node}
    result = []
    while remaining:
        start = min(remaining)
        remaining.remove(start)
        queue, group = [start], []
        while queue:
            v = queue.pop()
            group.append(v)
            for w in sorted(adj[v]):
                if w in remaining and frozenset((v, w)) != omit_edge:
                    remaining.remove(w)
                    queue.append(w)
        result.append(sorted(group))
    return sorted(result, key=lambda g: (-len(g), g))


def distances_and_centrality(adj):
    """Unweighted undirected Brandes, plus all-pairs hop distances."""
    centrality = dict.fromkeys(adj, 0.0)
    distances = {}
    for source in sorted(adj):
        stack, queue = [], deque([source])
        predecessors = {v: [] for v in adj}
        paths = dict.fromkeys(adj, 0)
        paths[source] = 1
        dist = {source: 0}
        while queue:
            v = queue.popleft()
            stack.append(v)
            for w in sorted(adj[v]):
                if w not in dist:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    paths[w] += paths[v]
                    predecessors[w].append(v)
        distances[source] = dist
        dependency = dict.fromkeys(adj, 0.0)
        while stack:
            w = stack.pop()
            for v in predecessors[w]:
                dependency[v] += paths[v] / paths[w] * (1 + dependency[w])
            if w != source:
                centrality[w] += dependency[w]
    centrality = {v: c / 2 for v, c in centrality.items()}
    # Every unordered pair contributes distance - 1 internal shortest-path nodes.
    expected = sum(d - 1 for v, ds in distances.items() for w, d in ds.items() if v < w)
    assert abs(sum(centrality.values()) - expected) < 1e-7
    return distances, centrality


def dump(relative, value):
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def main():
    inherited = read('risk-warzone.json')
    layout = read('risk-map-layout.json')
    manifest = read('manifest.json')
    for item in manifest['files']:
        assert hashlib.sha256((ROOT / item['file']).read_bytes()).hexdigest() == item['sha256']
    roster = {r['solar_system_id']: r for r in read('esi-fw-systems-2026-09-22.json')
              if r['owner_faction_id'] in FACTIONS}
    systems = {s['system_id']: s for s in inherited['systems']}
    positions = {s['id']: s for s in layout['systems']}
    assert set(roster) == set(systems) == set(positions), 'Changed roster: reimport geography.'
    ids = set(roster)
    gates = inherited['stargates']
    pairs = {(g['system_id'], g['destination']['system_id']) for g in gates
             if g['destination']['system_id'] in ids}
    assert all((b, a) in pairs for a, b in pairs), 'Missing reciprocal internal gate.'
    edges = sorted({tuple(sorted((a, b))) for a, b in pairs})
    assert edges == [tuple(e) for e in inherited['edges']]
    assert all(a != b for a, b in edges)
    adj = {s: set() for s in ids}
    for a, b in edges:
        adj[a].add(b)
        adj[b].add(a)
    connected = components(adj)
    distances, centrality = distances_and_centrality(adj)
    front = {s for s in ids if any(roster[s]['occupier_faction_id'] !=
                                  roster[n]['occupier_faction_id'] for n in adj[s])}
    command = {s for s in ids - front if adj[s] & front}
    external = sorted([{'fromSystemId': g['system_id'],
                        'fromSystemName': systems[g['system_id']]['name'],
                        'toSystemId': g['destination']['system_id'],
                        'gateId': g['stargate_id'],
                        'destinationGateId': g['destination']['stargate_id'],
                        'gateName': g['name']}
                       for g in gates if g['destination']['system_id'] not in ids],
                      key=lambda g: (g['fromSystemId'], g['toSystemId']))
    external_counts = Counter(g['fromSystemId'] for g in external)
    n = len(ids)
    records = []
    for sid in sorted(ids, key=lambda s: systems[s]['name']):
        system, observation = systems[sid], roster[sid]
        constellation = inherited['constellations'][str(system['constellation_id'])]
        region = inherited['regions'][str(constellation['region_id'])]
        threshold = observation['victory_points_threshold']
        assert threshold > 0
        records.append({
            'id': sid, 'name': system['name'], 'constellationId': system['constellation_id'],
            'constellation': constellation['name'], 'regionId': constellation['region_id'],
            'region': region['name'], 'securityStatus': system['security_status'],
            'npcStationCount': len(system.get('stations', [])),
            'originalFactionId': observation['owner_faction_id'],
            'occupierFactionId': observation['occupier_faction_id'],
            'contestedState': observation['contested'],
            'victoryPoints': observation['victory_points'], 'victoryPointsThreshold': threshold,
            'contestedPercent': round(100 * observation['victory_points'] / threshold, 6),
            'derivedOperationalState': 'frontline' if sid in front else 'command' if sid in command else 'rearguard',
            'position2D': positions[sid]['position2D'], 'position3D': positions[sid]['position'],
            'neighbors': sorted(adj[sid]), 'externalGateCount': external_counts[sid],
            'unweightedBetweenness': round(centrality[sid], 9),
            'normalizedBetweenness': round(centrality[sid] / ((n - 1) * (n - 2) / 2), 9),
        })
    names = {s: systems[s]['name'] for s in ids}
    articulations = []
    for sid in sorted(ids):
        groups = components(adj, omit_node=sid)
        if len(groups) > len(connected):
            articulations.append({'id': sid, 'name': names[sid], 'componentSizesWithoutNode': list(map(len, groups))})
    bridges = []
    for a, b in edges:
        groups = components(adj, omit_edge=frozenset((a, b)))
        if len(groups) > len(connected):
            bridges.append({'ids': [a, b], 'names': [names[a], names[b]], 'componentSizesWithoutEdge': list(map(len, groups))})
    ordered_pairs = [d for v, ds in distances.items() for w, d in ds.items() if v != w]
    summary = {
        'systems': n, 'internalUndirectedEdges': len(edges),
        'constellations': len({s['constellationId'] for s in records}),
        'regions': len({s['regionId'] for s in records}),
        'connectedComponents': len(connected), 'externalDirectedGates': len(external),
        'uniqueExternalDestinations': len({g['toSystemId'] for g in external}),
        'occupancy': dict(Counter(FACTIONS[r['occupierFactionId']] for r in records)),
        'originalFaction': dict(Counter(FACTIONS[r['originalFactionId']] for r in records)),
        'derivedOperationalStates': dict(Counter(r['derivedOperationalState'] for r in records)),
        'vpThresholds': dict(Counter(r['victoryPointsThreshold'] for r in records)),
        'diameterInternalHops': max(ordered_pairs),
        'meanShortestPathInternalHops': round(sum(ordered_pairs) / len(ordered_pairs), 6),
        'topBetweenness': [{'id': s['id'], 'name': s['name'], 'score': s['normalizedBetweenness']}
                           for s in sorted(records, key=lambda s: -s['normalizedBetweenness'])[:12]],
        'articulationSystems': articulations, 'bridgeEdges': bridges,
    }
    snapshot = {
        'schemaVersion': 1, 'scenarioId': 'calgal-2026-09-22-predowntime',
        'observation': manifest['publicSnapshot'],
        'geographyProvenance': manifest['inheritedGeography'],
        'rulesetStatus': 'Research candidate; exact unverified mechanics must remain explicit unknowns.',
        'limitations': [
            'Operational states are inferred from internal gate adjacency and recorded occupancy, not returned by this ESI route.',
            'Occupancy is a cached point observation, not a claim about all of September 22 or subsequent downtime.',
            'Internal graph centrality excludes routes through external systems, shipcasters, wormholes, and jump drives.',
            'Original faction and occupier are separate. No corporation assets, active pilots, advantage, or current site list are inferred.',
            'Station count is metadata, not proof that a pilot has docking access.',
        ],
        'summary': summary, 'systems': records, 'edges': edges, 'externalGates': external,
        'unobserved': {'corporationAssets': None, 'pilotAvailability': None, 'advantage': None,
                       'activeSites': None, 'structureAccess': None, 'coalitionDiplomacy': None},
    }
    dump('data/warzone-snapshot.json', snapshot)
    dump('research/warzone-analysis.json', summary)
    with (ROOT / 'research/warzone-roster.csv').open('w', newline='') as stream:
        fields = ['id', 'name', 'constellation', 'region', 'originalFactionId', 'occupierFactionId',
                  'victoryPoints', 'victoryPointsThreshold', 'contestedPercent',
                  'derivedOperationalState', 'externalGateCount', 'normalizedBetweenness']
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(records)
    draw_map(snapshot)
    print(json.dumps(summary, indent=2))


def draw_map(snapshot):
    records = snapshot['systems']
    xs = [r['position2D']['x'] for r in records]
    ys = [r['position2D']['y'] for r in records]
    scale = min(1460 / (max(xs) - min(xs)), 1070 / (max(ys) - min(ys)))
    coords = {r['id']: (75 + (r['position2D']['x'] - min(xs)) * scale,
                         150 + (max(ys) - r['position2D']['y']) * scale) for r in records}
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1620" height="1330" viewBox="0 0 1620 1330" role="img" aria-labelledby="title desc">',
           '<title id="title">Caldari–Gallente warzone: 90 systems, 22 September 2026 before downtime</title>',
           '<desc id="desc">Official 2D positions, 110 internal gate links. Blue is Caldari occupancy and green Gallente. Orange rings indicate frontlines derived from internal adjacency. External routes are not drawn.</desc>',
           '<rect width="1620" height="1330" fill="#09121c"/>',
           '<g font-family="system-ui, sans-serif" fill="#e3edf7">',
           '<text x="55" y="48" font-size="27">CALDARI–GALLENTE / WARZONE RESEARCH</text>',
           '<text x="55" y="81" font-size="17" fill="#a6b8ca">ESI cache last modified 2026-09-22 05:11 UTC · inherited SDE 3528119 geometry</text>',
           '<text x="55" y="113" font-size="17"><tspan fill="#63b7ff">● Caldari 56</tspan><tspan dx="28" fill="#66d5a0">● Gallente 34</tspan><tspan dx="28" fill="#f6bb69">○ Derived frontline</tspan></text>', '</g>']
    for a, b in snapshot['edges']:
        x1, y1 = coords[a]; x2, y2 = coords[b]
        svg.append(f'<line x1="{x1:.4f}" y1="{y1:.4f}" x2="{x2:.4f}" y2="{y2:.4f}" stroke="#30475b" stroke-width="1.7"/>')
    labeled = {'Tama', 'Fliet', 'Nennamaila', 'Heydieles', 'Aldranette', 'Old Man Star', 'Vlillirier',
               'Ishomilken', 'Eha', 'Iralaja', 'Hikkoken', 'Kedama', 'Oinasiken', 'Athounon', 'Hevrice',
               'Nisuwa', 'Sujarento', 'Oicx', 'Nagamanen', 'Pynekastoh'}
    label_boxes = []
    def label_position(x, y, name):
        width = len(name) * 8
        candidates = [(11, -10), (11, 23), (-width-11, -10), (-width-11, 23), (11, -31), (11, 42)]
        candidates += [(dx, dy) for dy in (-54, 65, -78, 89) for dx in (11, -width-11, -width/2)]
        for dx, dy in candidates:
            box = (x+dx-3, y+dy-15, x+dx+width+3, y+dy+4)
            conflict = any(not (box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3]) for b in label_boxes)
            conflict |= any(box[0]-7 < sx < box[2]+7 and box[1]-7 < sy < box[3]+7 for sx, sy in coords.values())
            if not conflict and box[0] > 20 and box[2] < 1600 and box[1] > 122:
                label_boxes.append(box)
                return x+dx, y+dy
        raise ValueError(f'Cannot place research label without collision: {name}')
    for record in records:
        x, y = coords[record['id']]
        color = '#63b7ff' if record['occupierFactionId'] == 500001 else '#66d5a0'
        name = html.escape(record['name'])
        svg.append(f'<g><title>{name} · {FACTIONS[record["occupierFactionId"]]} · {record["contestedPercent"]:.2f}% contested</title>')
        if record['derivedOperationalState'] == 'frontline':
            svg.append(f'<circle cx="{x:.4f}" cy="{y:.4f}" r="8" fill="none" stroke="#f6bb69" stroke-width="1.6"/>')
        svg.append(f'<circle cx="{x:.4f}" cy="{y:.4f}" r="4.4" fill="{color}"/>')
        if record['name'] in labeled:
            lx, ly = label_position(x, y, record['name'])
            if abs(ly-y) > 31:
                svg.append(f'<line x1="{x:.4f}" y1="{y:.4f}" x2="{lx:.4f}" y2="{ly-5:.4f}" stroke="#6a8296" stroke-width="0.8" stroke-dasharray="2 3"/>')
            svg.append(f'<text x="{lx:.4f}" y="{ly:.4f}" font-family="system-ui,sans-serif" font-size="14" fill="#e3edf7" stroke="#09121c" stroke-width="4" paint-order="stroke">{name}</text>')
        svg.append('</g>')
    svg.extend(['<g font-family="system-ui,sans-serif" font-size="15" fill="#a6b8ca">',
                '<text x="55" y="1272">All 90 stars retain CCP schematic coordinates under one uniform scale and Y reflection.</text>',
                '<text x="55" y="1300">31 outgoing gates lead outside this diagram. Control is occupancy, not a blockade or a claim of current corporation ownership.</text>',
                '</g></svg>'])
    (ROOT / 'research/warzone-map.svg').write_text('\n'.join(svg) + '\n')


if __name__ == '__main__':
    main()
