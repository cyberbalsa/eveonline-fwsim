#!/usr/bin/env python3
"""Combine the authored research ledgers without erasing conflicting claims."""
from pathlib import Path
from collections import Counter
import json

ROOT = Path(__file__).resolve().parents[1]
GROUPS = [('Mechanics', 'mechanics-sources.json'), ('Politics and identities', 'politics-sources.json'),
          ('Theory and economy', 'theory-sources.json'), ('Project, geography, and Freeciv', 'project-sources.json')]


def main():
    all_sources, groups = [], []
    for title, filename in GROUPS:
        document = json.loads((ROOT / 'research' / filename).read_text())
        sources = document['sources'] if isinstance(document, dict) else document
        groups.append((title, sources))
        for source in sources:
            all_sources.append({**source, 'ledger': filename})
    assert len({s['id'] for s in all_sources}) == len(all_sources)
    (ROOT / 'research/sources.json').write_text(json.dumps(all_sources, indent=2, ensure_ascii=False) + '\n')
    summary = {'sourceRecords': len(all_sources), 'uniqueUrls': len({s['url'] for s in all_sources}),
               'recordsByLedger': dict(Counter(s['ledger'] for s in all_sources)),
               'note': 'Multiple records may discuss the same source in different contexts. Counts are not independent confirmations.'}
    (ROOT / 'research/source-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    text = ['# Source index', '', 'Access date: 22 September 2026. Keep published/effective dates separate from access dates. '
            'Multiple records can refer to the same page; that is not independent corroboration.', '',
            'Machine-readable claims and uncertainties: [sources.json](sources.json). Raw API and source-code manifests are linked in the research reports.', '']
    for title, sources in groups:
        text.extend([f'## {title}', ''])
        for s in sources:
            date = s.get('publishedDate') or 'publication date unspecified'
            text.append(f'- **{s["id"]}** — [{s["title"]}]({s["url"]}). {s["publisher"]}; {date}; {s["kind"]}.')
        text.append('')
    (ROOT / 'research/SOURCES.md').write_text('\n'.join(text) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
