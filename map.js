import { DOCTRINES } from './rules.js';

// Star positions are transformed uniformly from CCP position2D. Never move a star to fit a label.
const NS = 'http://www.w3.org/2000/svg';
const HULL_POWER = new Map(DOCTRINES.map(doctrine => [doctrine.id, doctrine.power]));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const COLORS = { caldari: '#70b6e8', gallente: '#72bd99' };
function element(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createMap(container, snapshot, callbacks = {}) {
  const xs = snapshot.systems.map(s => s.position2D.x);
  const ys = snapshot.systems.map(s => s.position2D.y);
  const scale = Math.min(1460 / (Math.max(...xs) - Math.min(...xs)), 1080 / (Math.max(...ys) - Math.min(...ys)));
  const positions = new Map(snapshot.systems.map(s => [s.id, {
    x: 90 + (s.position2D.x - Math.min(...xs)) * scale,
    y: 90 + (Math.max(...ys) - s.position2D.y) * scale
  }]));
  const svg = element('svg', { viewBox: '0 0 1640 1260', role: 'group', 'aria-label': 'Caldari Gallente strategic starmap', class: 'warzone-map' });
  const defs = element('defs');
  const glow = element('radialGradient', { id: 'star-glow' });
  glow.append(element('stop', { offset: 0, 'stop-color': '#a3c9e0', 'stop-opacity': .6 }), element('stop', { offset: 1, 'stop-color': '#a3c9e0', 'stop-opacity': 0 }));
  defs.append(glow); svg.append(defs);
  const regionLayer = element('g', { class: 'constellation-layer' });
  const edgeLayer = element('g', { class: 'gate-layer' });
  const routeLayer = element('g', { class: 'route-layer', 'pointer-events': 'none' });
  const starLayer = element('g', { class: 'star-layer' });
  const fleetLinkLayer = element('g', { class: 'map-fleet-link-layer', 'pointer-events': 'none' });
  const fleetLayer = element('g', { class: 'map-fleet-layer' });
  const labelLayer = element('g', { class: 'map-label-layer', 'pointer-events': 'none' });
  svg.append(regionLayer, edgeLayer, routeLayer, fleetLinkLayer, starLayer, fleetLayer, labelLayer);
  container.replaceChildren(svg);
  let box = { x: 0, y: 0, w: 1640, h: 1260 }, latest = null, selection = {}, hovered = null;
  const nodes = new Map(), edges = [], labels = new Map(), pointers = new Map();
  let fleetMarkers = [];
  let moved = false, pinchDistance = null, clickTimer = null;
  const groups = new Map();
  for (const system of snapshot.systems) {
    if (!groups.has(system.constellation)) groups.set(system.constellation, []);
    groups.get(system.constellation).push(positions.get(system.id));
  }
  for (const [name, points] of groups) {
    const x = points.reduce((n, p) => n + p.x, 0) / points.length;
    const y = Math.min(...points.map(p => p.y)) - 34;
    regionLayer.append(element('text', { x, y, 'text-anchor': 'middle', class: 'constellation-label' }, name.toUpperCase()));
  }
  for (const [a, b] of snapshot.edges) {
    const p = positions.get(a), q = positions.get(b);
    const line = element('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'map-gate', 'data-edge': `${a}-${b}` });
    edgeLayer.append(line); edges.push({ a, b, line });
  }
  for (const system of snapshot.systems) {
    const p = positions.get(system.id);
    const group = element('g', { transform: `translate(${p.x} ${p.y})`, class: 'map-system', 'data-system-id': system.id, role: 'button', tabindex: 0, 'aria-label': system.name });
    group.append(element('title'), element('circle', { r: 16, class: 'star-hit', fill: 'transparent' }), element('circle', { r: 21, fill: 'url(#star-glow)', class: 'star-glow' }), element('circle', { r: 11, class: 'star-front' }), element('circle', { r: 17, class: 'star-selection' }), element('circle', { r: 5, class: 'star-core' }), element('path', { d: 'M0 -25 L4 -20 L0 -15 L-4 -20Z', class: 'star-objective' }));
    group.addEventListener('click', event => { if (!moved) { event.stopPropagation(); callbacks.onSelectSystem?.(system.id); } });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callbacks.onSelectSystem?.(system.id); }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        const candidates = system.neighbors.map(id => ({ id, p: positions.get(id) }));
        const axis = ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 'x' : 'y';
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        candidates.sort((a, b) => direction * (b.p[axis] - a.p[axis]));
        if (candidates[0]) nodes.get(candidates[0].id).focus();
      }
    });
    group.addEventListener('pointerenter', () => { hovered = system.id; layoutLabels(); });
    group.addEventListener('pointerleave', () => { hovered = null; layoutLabels(); });
    group.addEventListener('focus', () => { hovered = system.id; layoutLabels(); });
    group.addEventListener('blur', () => { hovered = null; layoutLabels(); });
    const label = element('text', { class: 'map-system-label', x: p.x + 13, y: p.y - 11 }, system.name);
    labelLayer.append(label); labels.set(system.id, label); starLayer.append(group); nodes.set(system.id, group);
  }
  const point = (x, y) => {
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const matrix = svg.getScreenCTM();
    return matrix ? p.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  function apply() {
    box.x = Math.max(-box.w * .7, Math.min(1640 - box.w * .3, box.x));
    box.y = Math.max(-box.h * .7, Math.min(1260 - box.h * .3, box.y));
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    container.dataset.zoom = String(Math.round(1640 / box.w * 100));
    layoutLabels();
  }
  function zoom(factor, origin = { x: box.x + box.w / 2, y: box.y + box.h / 2 }) {
    const width = Math.max(240, Math.min(2200, box.w * factor));
    factor = width / box.w;
    box = { x: origin.x - (origin.x - box.x) * factor, y: origin.y - (origin.y - box.y) * factor, w: width, h: box.h * factor };
    apply();
  }
  function fit() { box = { x: 0, y: 0, w: 1640, h: 1260 }; apply(); }
  function focus(id, width = 680) {
    const p = positions.get(Number(id)); if (!p) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(.55, Math.min(2.4, rect.width / Math.max(rect.height, 1)));
    box = { x: p.x - width / 2, y: p.y - width / ratio / 2, w: width, h: width / ratio };
    apply();
  }
  function layoutLabels() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = Math.min(rect.width / box.w, rect.height / box.h);
    const font = Math.min(20, Math.max(9, 11 / Math.max(px, .4)));
    const taken = layoutFleetMarkers(px, font);
    const query = (selection.query || '').trim().toLowerCase();
    const objectiveIds = new Set(latest?.objective?.targetIds || []);
    const ordered = [...snapshot.systems].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
    function score(s) {
      return (s.id === selection.selectedSystemId ? 1000 : 0) + (s.id === hovered ? 900 : 0) + (query && s.name.toLowerCase().includes(query) ? 700 : 0) + (objectiveIds.has(s.id) ? 100 : 0) + (s.id === latest?.player?.stagingId ? 80 : 0) + (latest?.fleets?.some(f => f.ownerId === 'player' && f.systemId === s.id) ? 50 : 0);
    }
    for (const s of ordered) {
      const label = labels.get(s.id), p = positions.get(s.id), priority = score(s);
      label.style.fontSize = `${font}px`;
      const inView = p.x > box.x - 40 && p.x < box.x + box.w + 40 && p.y > box.y - 30 && p.y < box.y + box.h + 30;
      if (!inView || (query && !s.name.toLowerCase().includes(query) && priority < 700)) { label.style.display = 'none'; continue; }
      const width = s.name.length * font * .6;
      const candidates = [[13, -11], [13, font + 10], [-width - 13, -11], [-width - 13, font + 10]];
      let chosen = null;
      for (const [dx, dy] of candidates) {
        const b = { x: p.x + dx - 3, y: p.y + dy - font, w: width + 6, h: font + 4 };
        if (!taken.some(t => b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y)) { chosen = { b, dx, dy }; break; }
      }
      if (!chosen && priority >= 700) chosen = { b: { x: p.x + 13, y: p.y - font - 11, w: width, h: font }, dx: 13, dy: -11 };
      if (chosen) { taken.push(chosen.b); label.setAttribute('x', p.x + chosen.dx); label.setAttribute('y', p.y + chosen.dy); label.style.display = ''; label.classList.toggle('priority', priority >= 80); }
      else label.style.display = 'none';
    }
  }
  function layoutFleetMarkers(px, font) {
    const unit = 1 / Math.max(.1, px), width = 50 * unit, height = 28 * unit;
    const taken = [], stars = [], importantLabels = [];
    const targets = new Set(latest?.objective?.targetIds || []);
    for (const system of snapshot.systems) {
      const p = positions.get(system.id);
      const radius = Math.max(8 * unit, system.id === selection.selectedSystemId ? 20 : 9);
      stars.push({ x: p.x - radius, y: p.y - radius, w: radius * 2, h: radius * 2 });
      if (system.id === selection.selectedSystemId || system.id === hovered || system.id === latest?.player?.stagingId || targets.has(system.id)) importantLabels.push({ x: p.x + 10, y: p.y - 11 - font, w: system.name.length * font * .6 + 6, h: font + 5 });
    }
    const sorted = [...fleetMarkers].sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.player) - Number(a.player) || a.systemId - b.systemId);
    for (const marker of sorted) {
      const p = positions.get(marker.systemId);
      const inView = p.x >= box.x - 100 * unit && p.x <= box.x + box.w + 100 * unit && p.y >= box.y - 100 * unit && p.y <= box.y + box.h + 100 * unit;
      marker.node.style.display = marker.line.style.display = inView ? '' : 'none';
      if (!inView) continue;
      let best = null;
      for (const radius of [35, 53, 76, 104, 135]) for (let step = 0; step < 12; step++) {
        const angle = Math.PI / 4 + step * Math.PI / 6;
        const center = { x: p.x + Math.cos(angle) * radius * unit, y: p.y + Math.sin(angle) * radius * unit };
        const b = { x: center.x - width / 2, y: center.y - height / 2, w: width, h: height };
        const padded = { x: b.x - 4 * unit, y: b.y - 4 * unit, w: b.w + 8 * unit, h: b.h + 8 * unit };
        const offscreen = b.x < box.x || b.y < box.y || b.x + b.w > box.x + box.w || b.y + b.h > box.y + box.h;
        const cost = stars.filter(star => overlaps(padded, star)).length * 5000 + taken.filter(occupied => overlaps(padded, occupied)).length * 10000 + importantLabels.filter(label => overlaps(padded, label)).length * 600 + Number(offscreen) * 1500 + radius + step * .05;
        if (!best || cost < best.cost) best = { b, padded, center, cost };
      }
      marker.node.setAttribute('transform', `translate(${best.b.x} ${best.b.y}) scale(${unit})`);
      const dx = p.x - best.center.x, dy = p.y - best.center.y;
      const fraction = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2));
      marker.line.setAttribute('x1', p.x); marker.line.setAttribute('y1', p.y);
      marker.line.setAttribute('x2', best.center.x + dx * fraction); marker.line.setAttribute('y2', best.center.y + dy * fraction);
      taken.push(best.padded);
    }
    return taken;
  }
  function render(state, opts = {}) {
    latest = state; selection = opts;
    const query = (opts.query || '').toLowerCase().trim();
    const targets = new Set(state.objective?.targetIds || []);
    for (const [id, group] of nodes) {
      const s = state.systems[id];
      const frontline = s.neighbors.some(n => state.systems[n].occupier !== s.occupier);
      group.style.setProperty('--star-color', COLORS[s.occupier]);
      group.classList.toggle('selected', id === opts.selectedSystemId);
      group.classList.toggle('frontline', frontline);
      group.classList.toggle('pending', Boolean(s.hubPending));
      group.classList.toggle('objective', targets.has(id));
      group.classList.toggle('staging', id === state.player.stagingId);
      group.classList.toggle('dimmed', Boolean(query && !s.name.toLowerCase().includes(query)));
      group.classList.toggle('layer-muted', opts.layer === 'frontline' && !frontline);
      group.querySelector('title').textContent = `${s.name} · ${s.occupier === 'caldari' ? 'Caldari' : 'Gallente'} · ${Math.min(100, s.vp / s.threshold * 100).toFixed(1)}% contested${id === state.player.stagingId ? ' · Staging' : ''}`;
      group.setAttribute('aria-pressed', String(id === opts.selectedSystemId));
    }
    for (const edge of edges) {
      const border = state.systems[edge.a].occupier !== state.systems[edge.b].occupier;
      edge.line.classList.toggle('border-gate', border);
      edge.line.classList.toggle('supply-gate', opts.layer === 'supply' && (edge.a === state.player.stagingId || edge.b === state.player.stagingId));
    }
    const selectedFleet = state.fleets.find(f => f.id === opts.selectedFleetId);
    routeLayer.replaceChildren();
    if (selectedFleet) {
      const target = selectedFleet.order?.targetId;
      if (target && positions.has(target)) {
        const route = routeBetween(state, selectedFleet.systemId, target);
        if (route.length > 1) routeLayer.append(element('polyline', { points: route.map(id => { const p = positions.get(id); return `${p.x},${p.y}`; }).join(' '), class: 'fleet-route' }));
      }
    }
    fleetLayer.replaceChildren(); fleetLinkLayer.replaceChildren(); fleetMarkers = [];
    const visible = opts.visibleFleets || state.fleets.filter(f => f.faction === state.faction);
    const perSystem = new Map();
    for (const f of visible) if (f.ships > 0) { if (!perSystem.has(f.systemId)) perSystem.set(f.systemId, []); perSystem.get(f.systemId).push(f); }
    for (const [id, fleets] of perSystem) {
      const systemId = Number(id); if (!positions.has(systemId)) continue;
      const sorted = [...fleets].sort((a, b) => Number(b.id === opts.selectedFleetId) - Number(a.id === opts.selectedFleetId) || Number(b.ownerId === 'player') - Number(a.ownerId === 'player') || (HULL_POWER.get(b.doctrineId) || 0) - (HULL_POWER.get(a.doctrineId) || 0) || b.ships - a.ships || a.id.localeCompare(b.id));
      const representative = sorted[0], total = fleets.reduce((sum, f) => sum + f.ships, 0), player = fleets.some(f => f.ownerId === 'player'), selected = fleets.some(f => f.id === opts.selectedFleetId);
      const contested = new Set(fleets.map(f => f.faction)).size > 1, systemName = state.systems[systemId].name;
      const details = `${systemName} · ${total} observed ships in ${fleets.length} formation${fleets.length === 1 ? '' : 's'}${contested ? ' · opposing fleets present' : ''}\n${sorted.map(f => `${f.name} · ${f.ships} ships · ${f.faction === 'caldari' ? 'Caldari' : 'Gallente'}${f.ownerId === 'player' ? ' · your corporation' : ''}`).join('\n')}`;
      const g = element('g', { class: `map-fleet-token aggregate${player ? ' player' : ''}${selected ? ' selected' : ''}${contested ? ' contested' : ''}${query && !systemName.toLowerCase().includes(query) ? ' dimmed' : ''}`, 'data-map-fleet': representative.id, 'data-fleet-system': systemId, 'data-formation-count': fleets.length, role: 'button', tabindex: 0, 'aria-label': `${systemName}, ${total} observed ships, ${fleets.length} formations${player ? `. Select ${representative.name}` : ''}` });
      g.style.setProperty('--fleet-color', COLORS[representative.faction]);
      g.append(element('title', {}, details), element('rect', { x: 0, y: 0, width: 50, height: 28, rx: 2 }), element('image', { href: `assets/ships/${representative.doctrineId}.png`, x: 2, y: 3, width: 23, height: 22 }), element('text', { x: 46, y: 15, 'text-anchor': 'end', class: 'fleet-ship-total' }, total), element('text', { x: 46, y: 24, 'text-anchor': 'end', class: 'fleet-formation-total' }, `${fleets.length} F`));
      if (contested) g.append(element('path', { d: 'M44 0 L50 0 L50 6Z', class: 'fleet-contact-flag' }));
      const line = element('line', { class: `fleet-system-link${selected ? ' selected' : ''}`, 'data-fleet-link': systemId });
      line.style.setProperty('--fleet-color', COLORS[representative.faction]);
      const choose = event => {
        event.stopPropagation();
        if (!moved || event.type === 'keydown') { callbacks.onSelectSystem?.(systemId); if (representative.ownerId === 'player') callbacks.onSelectFleet?.(representative.id); }
      };
      g.addEventListener('click', choose);
      g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(event); } });
      fleetLinkLayer.append(line); fleetLayer.append(g); fleetMarkers.push({ systemId, node: g, line, selected, player });
    }
    layoutLabels();
  }
  svg.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(Math.max(-200, Math.min(200, event.deltaY)) * .0018), point(event.clientX, event.clientY)); }, { passive: false });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    clearTimeout(clickTimer); if (!pointers.size) moved = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); pinchDistance = null;
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const old = pointers.get(event.pointerId), next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);
    if (Math.hypot(next.x - old.x, next.y - old.y) > 2) { moved = true; svg.setPointerCapture(event.pointerId); }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) zoom(pinchDistance / distance, point((a.x + b.x) / 2, (a.y + b.y) / 2));
      pinchDistance = distance;
    } else if (moved) {
      const a = point(old.x, old.y), b = point(next.x, next.y);
      box.x += a.x - b.x; box.y += a.y - b.y; apply();
    }
  });
  const release = event => { pointers.delete(event.pointerId); pinchDistance = null; if (!pointers.size) clickTimer = setTimeout(() => { moved = false; }, 30); };
  svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release); svg.addEventListener('lostpointercapture', release);
  const observer = new ResizeObserver(layoutLabels); observer.observe(container);
  return { render, fit, focus, zoom, destroy() { observer.disconnect(); clearTimeout(clickTimer); container.replaceChildren(); } };
}

export function routeBetween(state, from, to) {
  if (!state.systems[from] || !state.systems[to]) return [];
  const parent = new Map([[from, null]]), queue = [from];
  for (const id of queue) {
    if (id === to) break;
    for (const n of state.systems[id].neighbors) if (!parent.has(n)) { parent.set(n, id); queue.push(n); }
  }
  if (!parent.has(to)) return [];
  const route = []; for (let id = to; id !== null; id = parent.get(id)) route.push(id);
  return route.reverse();
}
