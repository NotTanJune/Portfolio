/* Repo city, in-page mockup. Injected into the real production build by server.js.
   Adapted from plans/assets/005-repo-city/spike.html with the plan's changes applied:
   no dithering, hover outline only, wider footprints, rooftop emblems (procedural placeholders),
   cars, vent smoke and beacons on an 8 Hz clock.
   Home: the rotating city with a row of four animated hint vignettes under it.
   Projects: no city; each card shows its own repo's building (or a park) on a corner lot. */
(async () => {
'use strict';
const RAW = await (await fetch('/__city/repos.json')).json();
const NOW = Date.now();
const REPOS = RAW.map(r => ({
  name: r.n, lang: r.l === 'Jupyter Notebook' ? 'Jupyter' : r.l, size: r.s, stars: r.st, url: r.u,
  days: Math.max(0, Math.floor((NOW - Date.parse(r.p)) / 864e5)),
})).sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));

/* ---------- helpers ---------- */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
const toHex = (c) => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
const pack = (c) => (255 << 24 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0;
const litChance = (days) => days <= 7 ? .72 : days <= 30 ? .45 : days <= 120 ? .2 : days <= 365 ? .08 : .02;
const luma = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 255000;

const SQ = 0.6, LOT = 16, ROAD = 5, PITCH = LOT + ROAD;
const COLS = Math.max(4, Math.ceil(Math.sqrt(REPOS.length * 1.25))), ROWS = Math.max(3, Math.ceil((REPOS.length + 2) / COLS));
const GW = COLS * LOT + (COLS + 1) * ROAD, GD = ROWS * LOT + (ROWS + 1) * ROAD;

const STYLES = {
  maquette: {
    shadow: '#344e41', highlight: '#ffffff',
    ground: { lot: '#cfcabb', road: '#b6b09c', dash: '#dad7cd', grass: '#a3b18a', soil: '#8c8672', lamp: null },
    lang: {
      Rust: { wall: '#588157', roof: '#3a5a40' }, Swift: { wall: '#f0efeb', roof: '#dad7cd' },
      TypeScript: { wall: '#a3b18a', roof: '#588157' }, JavaScript: { wall: '#a3b18a', roof: '#f0efeb' },
      Python: { wall: '#c9c2ad', roof: '#a3b18a' }, Jupyter: { wall: '#c9c2ad', roof: '#588157' },
      'C++': { wall: '#b6b09c', roof: '#f0efeb' }, HTML: { wall: '#f0efeb', roof: '#a3b18a' },
    },
    window: '#344e41', windowLit: '#f6d98b', trimMix: .18,
    props: ['antenna', 'vent'], leaf: '#588157', trunk: '#6b5f45',
    cars: ['#f0efeb', '#3a5a40', '#f6d98b'], puff: '#f0efeb', hoverInk: '#1a2419',
  },
  night: {
    shadow: '#070b08', highlight: '#5b7a66',
    ground: { lot: '#202c22', road: '#141c15', dash: '#3d4f40', grass: '#243524', soil: '#0f1810', lamp: '#ffd98a' },
    lang: {
      Rust: { wall: '#2b3a30', rim: '#ff7a45' }, Swift: { wall: '#30403a', rim: '#ff5d73' },
      TypeScript: { wall: '#27363a', rim: '#4da3ff' }, JavaScript: { wall: '#2f3a2c', rim: '#ffe14d' },
      Python: { wall: '#27363a', rim: '#5fe0b7' }, Jupyter: { wall: '#33392b', rim: '#ffa24d' },
      'C++': { wall: '#2b3338', rim: '#c59cff' }, HTML: { wall: '#33323a', rim: '#ff8fd0' },
    },
    window: '#121a14', windowLit: '#ffd98a', windowLitAlt: '#9fe6ff', trimMix: .25,
    props: ['antenna', 'beacon', 'vent'], leaf: '#2f4a33', trunk: '#1c241c',
    cars: ['#3d4f40', '#4a5c4d', '#56505e'], puff: '#4a5c4d', hoverInk: '#f0efeb',
  },
};
const langStyle = (S, lang) => { if (S.lang[lang]) return S.lang[lang]; const v = Object.values(S.lang); return v[hash(lang) % v.length]; };

/* ---------- voxel model builder (the spike's builder plus the v.edge flag) ---------- */
function buildModel(w, d, H, kindFn, paint) {
  const n = w * d, kind = new Uint8Array(H * n), mat = new Uint8Array(H * n), mask = new Uint8Array(H * n);
  for (let z = 0; z < H; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) kind[(z * d + y) * w + x] = kindFn(x, y, z) | 0;
  const at = (x, y, z) => (x < 0 || y < 0 || x >= w || y >= d || z >= H) ? 0 : kind[(z * d + y) * w + x];
  const v = {};
  for (let z = 0; z < H; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const i = (z * d + y) * w + x, k = kind[i];
    if (!k) continue;
    let m = 0;
    if (!at(x - 1, y, z) || !at(x - 2, y, z)) m |= 1;
    if (!at(x + 1, y, z) || !at(x + 2, y, z)) m |= 2;
    if (!at(x, y - 1, z) || !at(x, y - 2, z)) m |= 4;
    if (!at(x, y + 1, z) || !at(x, y + 2, z)) m |= 8;
    v.kind = k; v.x = x; v.y = y; v.z = z; v.mask = m; v.top = !at(x, y, z + 1);
    v.single = m === 1 || m === 2 || m === 4 || m === 8;
    v.edge = !at(x - 1, y, z) || !at(x + 1, y, z) || !at(x, y - 1, z) || !at(x, y + 1, z);
    v.t = (m & 3) ? y : x; v.tLen = (m & 3) ? d : w;
    mat[i] = paint(v); mask[i] = v.mask;
  }
  return { w, d, H, mat, mask, z0: 0 };
}

function proceduralEmblem(name, c) {
  const px = new Uint8Array(16 * 16 * 4);
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const mc = Math.min(col, 6 - col);
    if (!((mc === 3 && row === 3) || hash(name + ':' + mc + ':' + row) % 100 < 50)) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const o = ((1 + row * 2 + dy) * 16 + 1 + col * 2 + dx) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  return px;
}

/* ---------- scene ---------- */
function makeScene(key) {
  const S = STYLES[key], shadow = hex(S.shadow), highlight = hex(S.highlight);
  const colors = [0, 0, 0, 0], blinkers = [], cache = new Map();
  const M = (h, o = {}) => {
    const id = h + (o.emissive ? 'e' : '') + (o.blink ? 'b' : '');
    if (cache.has(id)) return cache.get(id);
    const c = hex(h), n = colors.length / 4;
    if (o.emissive) colors.push(pack(c), pack(c), pack(c), pack(c));
    else colors.push(pack(mix(c, highlight, .16)), pack(c), pack(mix(c, shadow, .2)), pack(mix(c, shadow, .42)));
    if (o.blink) blinkers.push({ n, on: pack(c), off: pack(mix(c, shadow, .75)) });
    cache.set(id, n);
    return n;
  };

  const G = S.ground;
  const gm = { lot: M(G.lot), road: M(G.road), dash: M(G.dash), grass: M(G.grass), soil: M(G.soil), lamp: G.lamp ? M(G.lamp, { emissive: true }) : 0 };
  const lots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) lots.push({ c, r, x: ROAD + c * PITCH, y: ROAD + r * PITCH });
  const order = lots.slice().sort((a, b) => {
    const da = Math.hypot(a.c - (COLS - 1) / 2, (a.r - (ROWS - 1) / 2) * 1.15), db = Math.hypot(b.c - (COLS - 1) / 2, (b.r - (ROWS - 1) / 2) * 1.15);
    return da - db || hash('lot' + a.c + a.r) - hash('lot' + b.c + b.r);
  });
  const parks = new Set(order.slice(REPOS.length));

  const ground = buildModel(GW, GD, 3, () => 1, (v) => {
    if (v.z < 2) return gm.soil;
    v.mask = 0;
    const cx = v.x % PITCH, cy = v.y % PITCH, onX = cx < ROAD, onY = cy < ROAD;
    if (onX || onY) {
      if (gm.lamp && onX && onY && cx === 2 && cy === 2) return gm.lamp;
      if (onX && !onY && cx === 2 && (v.y % 4) < 2) return gm.dash;
      if (onY && !onX && cy === 2 && (v.x % 4) < 2) return gm.dash;
      return gm.road;
    }
    const lot = lots[Math.floor(v.y / PITCH) * COLS + Math.floor(v.x / PITCH)];
    return parks.has(lot) ? gm.grass : gm.lot;
  });
  ground.z0 = -2; ground.isGround = true;

  /* buildings: decide every spec first so two vents can be guaranteed */
  const TYPES = ['tower', 'step', 'ell'];
  const specs = REPOS.map((repo, i) => {
    const R = rng(hash(repo.name));
    const type = TYPES[Math.floor(R() * 3)];
    const lg = Math.log10(repo.size + 1), h = Math.round(6 + 1.25 * lg * lg);
    let w = 11 + Math.floor(R() * 4); const d = 11 + Math.floor(R() * 4);
    if (type === 'ell') w = 14;
    const prop = h > 14 && R() < .6 ? S.props[Math.floor(R() * S.props.length)] : (repo.stars > 1 ? 'antenna' : null);
    return { repo, lot: order[i], type, h, w, d, prop };
  });
  const vents = specs.filter(s => s.prop === 'vent').length;
  if (vents < 2) specs.filter(s => !s.prop).sort((a, b) => b.h - a.h).slice(0, 2 - vents).forEach(s => { s.prop = 'vent'; });

  const items = [], emblems = [];
  const winDark = M(S.window), winLit = M(S.windowLit, { emissive: true }), winLitAlt = S.windowLitAlt ? M(S.windowLitAlt, { emissive: true }) : winLit;
  const metal = M(key === 'night' ? '#4a5c4d' : '#6f7469'), chimney = M(S.window);
  const beacon = M('#ff5a4d', { emissive: true, blink: key === 'night' });

  for (const { repo, lot, type, h, w, d, prop } of specs) {
    const L = langStyle(S, repo.lang);
    const H = h + (prop ? 6 : 0);
    const wallC = hex(L.wall), roofC = L.roof ? hex(L.roof) : mix(wallC, shadow, .35);
    const wall = M(L.wall), trim = M(toHex(mix(wallC, shadow, S.trimMix))), roof = M(toHex(roofC));
    const rim = L.rim ? M(L.rim, { emissive: true }) : trim;
    const pLit = litChance(repo.days), seed = hash(repo.name);
    const inset = type === 'step' ? 1 : 0, ellW = 9, podium = Math.max(4, Math.round(h * .42)), stepZ = h * .6;
    const rx0 = inset, ry0 = inset, rx1 = type === 'ell' ? ellW : w - inset, ry1 = d - inset;   // top roof, in cells
    const pcx = rx0 + 1, pcy = ry0 + 1;                                                           // prop corner

    const kindFn = (x, y, z) => {
      if (z >= h) {
        const pz = z - h;
        if (prop === 'antenna') return (x === pcx && y === pcy && pz < 5) ? (pz === 4 ? 4 : 3) : 0;
        if (prop === 'beacon') return (x === pcx && y === pcy && pz < 4) ? (pz === 3 ? 4 : 3) : 0;
        if (prop === 'vent') return (x >= pcx && x < pcx + 2 && y >= pcy && y < pcy + 2 && pz < 3) ? 2 : 0;
        return 0;
      }
      if (type === 'ell') return (z < podium || x < ellW) ? 1 : 0;
      const ins = (type === 'step' && z > stepZ) ? 1 : 0;
      return (x >= ins && y >= ins && x < w - ins && y < d - ins) ? 1 : 0;
    };
    const paint = (v) => {
      if (v.kind === 3) return metal;
      if (v.kind === 4) return beacon;
      if (v.kind === 2) return chimney;
      if (v.mask === 0) return roof;
      if (v.top) { if (v.edge) return rim; v.mask = 0; return roof; }   // one-cell rim leaves the roof free for the emblem
      if (v.z < 2) return trim;
      const floor = Math.floor(v.z / 4);
      if (v.single && (v.z % 4 === 1 || v.z % 4 === 2) && v.t % 2 === 1 && v.t > 0 && v.t < v.tLen - 1) {
        const hv = hash(seed + ':' + v.mask + ':' + floor + ':' + v.t) / 4294967296;
        if (hv < pLit) return (hv * 97 % 1) < .22 ? winLitAlt : winLit;
        return winDark;
      }
      return wall;
    };
    const model = buildModel(w, d, H, kindFn, paint);
    const gx = lot.x + Math.floor((LOT - w) / 2), gy = lot.y + Math.floor((LOT - d) / 2);
    const ox = gx - GW / 2, oy = gy - GD / 2;                    // model origin in city units
    const rw = rx1 - rx0, rd = ry1 - ry0;
    // the emblem slides away from the prop corner when the roof has room for it
    const ex = (rx0 + rx1) / 2 + Math.max(0, Math.min(1.5, (rw - 9) / 2)), ey = (ry0 + ry1) / 2 + Math.max(0, Math.min(1.5, (rd - 9) / 2));
    const embC = L.rim ? mix(hex(L.rim), [255, 255, 255], .6) : (luma(roofC) > .55 ? hex('#344e41') : hex('#f0efeb'));
    emblems.push(proceduralEmblem(repo.name, embC));
    items.push({
      model, x: ox + w / 2, y: oy + d / 2, gx, gy, w, d, h, top: H, repo,
      roof: { x: ox + ex, y: oy + ey, z: h - 1 + .3 },
      vent: prop === 'vent' ? { x: ox + pcx + 1, y: oy + pcy + 1, z: h + 3 } : null,
    });
  }

  const leaf = M(S.leaf), trunk = M(S.trunk);
  for (const lot of parks) {
    const R = rng(hash('park' + lot.c + lot.r)), n = 2 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const r = 2 + Math.floor(R() * 2), w = r * 2 + 1, H = r * 2 + 4;
      const model = buildModel(w, w, H, (x, y, z) => {
        if (z < 3) return (x === r && y === r) ? 2 : 0;
        return Math.hypot(x - r, y - r, (z - 3 - r) * 1.05) <= r + .1 ? 1 : 0;
      }, (v) => v.kind === 2 ? trunk : leaf);
      const gx = lot.x + 1 + Math.floor(R() * (LOT - w - 2)), gy = lot.y + 1 + Math.floor(R() * (LOT - w - 2));
      items.push({ model, x: gx + w / 2 - GW / 2, y: gy + w / 2 - GD / 2, gx: gx + r - 1, gy: gy + r - 1, w: 3, d: 3, h: H - 2, top: H, repo: null, roof: null, vent: null });
    }
  }

  /* life models: cars[colour][orientation 0=x 1=y][direction 0=-1 1=+1], three puff sizes */
  const head = key === 'night' ? M('#ffe9b0', { emissive: true }) : 0, tail = key === 'night' ? M('#ff5a4d', { emissive: true }) : 0;
  const cars = S.cars.map((col) => {
    const body = M(col);
    return [0, 1].map((ori) => [0, 1].map((dir) => buildModel(ori ? 2 : 4, ori ? 4 : 2, 2,
      (x, y, z) => { const a = ori ? y : x; return z === 0 || a === 1 || a === 2 ? 1 : 0; },
      (v) => {
        const a = ori ? v.y : v.x, front = dir ? 3 : 0;
        if (v.top) v.mask = 0;
        if (v.z === 1) return winDark;
        if (head && a === front) return head;
        if (tail && a === 3 - front) return tail;
        return body;
      })));
  });
  const puffM = M(S.puff);
  const puffs = [[2, 2, 2], [3, 3, 2], [2, 2, 1]].map(([w, d, H]) => buildModel(w, d, H, () => 1, (v) => { if (v.top) v.mask = 0; return puffM; }));

  /* lot plate for a single building, and six park models for cards with no public repo */
  const PLN = 18, kerb = (x, y) => x === 0 || y === 0 || x === PLN - 1 || y === PLN - 1;
  const plate = buildModel(PLN, PLN, 3, () => 1, (v) => { if (v.z < 2) return gm.soil; v.mask = 0; return kerb(v.x, v.y) ? gm.road : gm.lot; });
  const night = key === 'night';
  const pm = { water: M(night ? '#1f3d47' : '#9dbfb8'), stone: M(night ? '#4a5c4d' : '#b6b09c'), wood: trunk, leaf,
    flowerA: M(night ? '#b89a5a' : '#f6d98b'), flowerB: M(night ? '#7d8c84' : '#f0efeb') };
  // kinds: 1 plate, 2 wood, 3 leaf, 4 stone, 5 flower
  const tree = (x, y, zz, cx, cy, r) => (zz < 3 && x === cx && y === cy) ? 2 : (zz >= 2 && Math.hypot(x - cx, y - cy, (zz - 2 - r) * 1.05) <= r + .1) ? 3 : 0;
  const shrub = (x, y, zz, cx, cy) => Math.hypot(x - cx, y - cy, zz - .5) <= 1.5 ? 3 : 0;
  const any = (...k) => { for (const v of k) if (v) return v; return 0; };
  const inPond = (x, y) => ((x - 10) / 4.6) ** 2 + ((y - 9) / 3.3) ** 2 <= 1;
  const inBed = (x, y) => y >= 3 && y <= 14 && ((x >= 3 && x <= 7) || (x >= 10 && x <= 14));
  const ring = (x, y) => Math.max(Math.abs(x - 8.5), Math.abs(y - 8.5));
  const PARKS = [
    { name: 'grove', H: 13, top: () => gm.grass,
      solid: (x, y, zz) => any(tree(x, y, zz, 6, 6, 3), tree(x, y, zz, 12, 9, 2), tree(x, y, zz, 6, 13, 2)) },
    { name: 'pond', H: 11, top: (x, y) => inPond(x, y) ? pm.water : gm.grass,
      solid: (x, y, zz) => any(tree(x, y, zz, 4, 4, 2), (zz === 0 && ((x === 5 && y === 10) || (x === 6 && y === 11) || (x === 14 && y === 5))) ? 4 : 0) },
    { name: 'path', H: 13, top: (x, y) => (y === 8 || y === 9) ? gm.lot : gm.grass,
      solid: (x, y, zz) => any(tree(x, y, zz, 12, 4, 3), tree(x, y, zz, 4, 13, 2), (zz === 0 && y === 6 && x >= 5 && x <= 7) ? 2 : 0) },
    { name: 'garden', H: 9, top: (x, y) => inBed(x, y) ? gm.soil : (x === 8 || x === 9) ? gm.lot : gm.grass,
      solid: (x, y, zz) => any((zz === 0 && inBed(x, y) && (x + y) % 2 === 0) ? 5 : 0, shrub(x, y, zz, 8.5, 2), shrub(x, y, zz, 8.5, 15)) },
    { name: 'fountain', H: 8, top: (x, y) => ring(x, y) < 2 ? pm.water : ring(x, y) < 5 ? gm.lot : gm.grass,
      solid: (x, y, zz) => any((zz === 0 && ring(x, y) >= 2 && ring(x, y) < 3) ? 4 : 0, (zz < 3 && ring(x, y) < 1) ? 4 : 0,
        shrub(x, y, zz, 3, 3), shrub(x, y, zz, 14, 3), shrub(x, y, zz, 3, 14), shrub(x, y, zz, 14, 14)) },
    { name: 'orchard', H: 11, top: () => gm.grass,
      solid: (x, y, zz) => any(tree(x, y, zz, 5, 5, 2), tree(x, y, zz, 12, 5, 2), tree(x, y, zz, 5, 12, 2), tree(x, y, zz, 12, 12, 2),
        (zz === 0 && !kerb(x, y) && hash('f' + x + ':' + y) % 100 < 7) ? 5 : 0) },
  ];
  const parkModels = PARKS.map((p) => buildModel(PLN, PLN, p.H, (x, y, z) => z < 3 ? 1 : p.solid(x, y, z - 3), (v) => {
    if (v.kind === 2) return pm.wood;
    if (v.kind === 3) return pm.leaf;
    if (v.kind === 4) { if (v.top) v.mask = 0; return pm.stone; }
    if (v.kind === 5) { v.mask = 0; return hash('c' + v.x + ':' + v.y) % 2 ? pm.flowerA : pm.flowerB; }
    if (v.z < 2) return gm.soil;
    v.mask = 0;
    return kerb(v.x, v.y) ? gm.road : p.top(v.x, v.y);
  }));
  let maxTop = 0; for (const it of items) maxTop = Math.max(maxTop, it.top);
  return { key, S, colors: new Uint32Array(colors), blinkers, ground, items, emblems, cars, puffs, maxTop, plate, parks: parkModels,
    buildings: items.filter(it => it.repo), shadowMask: new Uint8Array(GW * GD), tones: new Uint8Array(16) };
}

/* ---------- per-frame lighting: face tones, ground shadows, beacon blink ---------- */
const NORMALS = [[-1, 0], [1, 0], [0, -1], [0, 1]], LIGHT = [-0.99, 0.14];
function computeLighting(sc, theta, tick) {
  const cos = Math.cos(theta), sin = Math.sin(theta), faceTone = [], faceCam = [];
  for (const [nx, ny] of NORMALS) {
    const rx = cos * nx - sin * ny, ry = sin * nx + cos * ny, b = rx * LIGHT[0] + ry * LIGHT[1];
    faceTone.push(b > .3 ? 1 : b > -.45 ? 2 : 3); faceCam.push(ry);
  }
  for (let m = 1; m < 16; m++) { let best = -9, t = 2; for (let f = 0; f < 4; f++) if (m & (1 << f) && faceCam[f] > best) { best = faceCam[f]; t = faceTone[f]; } sc.tones[m] = t; }
  const sm = sc.shadowMask; sm.fill(0);
  const sdx = cos * -LIGHT[0] + sin * -LIGHT[1], sdy = -sin * -LIGHT[0] + cos * -LIGHT[1];
  for (const it of sc.items) {
    const len = Math.round(it.h * .5);
    for (let t = 1; t <= len; t++) {
      const ox = Math.round(it.gx + sdx * t), oy = Math.round(it.gy + sdy * t);
      for (let y = Math.max(0, oy); y < Math.min(GD, oy + it.d); y++) for (let x = Math.max(0, ox); x < Math.min(GW, ox + it.w); x++) sm[y * GW + x] = 1;
    }
  }
  for (const b of sc.blinkers) { const c = (tick % 12) < 6 ? b.on : b.off; sc.colors[b.n * 4] = sc.colors[b.n * 4 + 1] = sc.colors[b.n * 4 + 2] = sc.colors[b.n * 4 + 3] = c; }
}

/* ---------- small life: a pure function of the tick ---------- */
function lifeInstances(sc, tick) {
  const out = [], nCars = Math.min(8, Math.max(3, Math.round(sc.buildings.length / 4)));
  for (let k = 0; k < nCars; k++) {
    const R = rng(hash('car' + k)), horiz = R() < .5, line = Math.floor(R() * ((horiz ? ROWS : COLS) + 1));
    const lane = R() < .5 ? -1 : 1, offset = Math.floor(R() * 400), col = Math.floor(R() * 3);
    const length = horiz ? GW : GD, span = length + 8;
    const pos = (((offset + tick * lane) % span) + span) % span - 4;
    if (pos < 2 || pos > length - 2) continue;
    const across = line * PITCH + (lane < 0 ? 1 : 4);
    out.push({ m: sc.cars[col][horiz ? 0 : 1][lane > 0 ? 1 : 0], x: (horiz ? pos : across) - GW / 2, y: (horiz ? across : pos) - GD / 2, z: 0 });
  }
  for (const it of sc.buildings) {
    if (!it.vent) continue;
    const ph = hash(it.repo.name) % 24;
    for (let j = 0; j < 3; j++) {
      const age = (tick + j * 8 + ph) % 24;
      out.push({ m: sc.puffs[age < 8 ? 0 : age < 16 ? 1 : 2], x: it.vent.x + Math.floor(age / 8), y: it.vent.y, z: it.vent.z + 1 + Math.floor(age / 2) });
    }
  }
  return out;
}

/* ---------- view ---------- */
const RAD = Math.hypot(GW, GD) / 2;
function topNeed(sc) {      // tallest reach above the plate centre at any angle
  let need = RAD * SQ;
  for (const it of sc.items) need = Math.max(need, (Math.hypot(it.x, it.y) + Math.hypot(it.w, it.d) / 2) * SQ + it.top + (it.vent ? 14 : 0));
  return need;
}
function viewFor(a, b) {
  const cy = Math.ceil(Math.max(topNeed(a), topNeed(b))) + 4, BW = Math.ceil(RAD * 2) + 6;
  return { BW, BH: Math.ceil(cy + RAD * SQ + 6), cx: BW / 2, cy };
}

/* ---------- WebGL2 ---------- */
const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aItem;   // centre x, centre y, z, id + kind (0 slice, .5 ground top, .25 emblem)
layout(location=2) in vec4 aRect;   // w, d, atlas x, atlas y
uniform vec2 uRot, uView, uCenter, uOrigin;
out vec2 vUV; flat out float vKind; flat out float vId; flat out vec4 vRect;
void main() {
  vec2 p = aItem.xy - uOrigin + (aCorner - 0.5) * aRect.xy;
  vec2 r = vec2(uRot.x * p.x - uRot.y * p.y, uRot.y * p.x + uRot.x * p.y);
  vec2 s = vec2(uCenter.x + r.x, uCenter.y + r.y * ${SQ.toFixed(2)} - aItem.z);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, -(0.8 * r.y + 0.6 * aItem.z) / 400.0, 1.0);
  vId = floor(aItem.w); vKind = fract(aItem.w); vRect = aRect;
  vUV = aRect.zw + aCorner * ((vKind > 0.2 && vKind < 0.3) ? vec2(16.0) : aRect.xy);
}`;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uAtlas, uPal, uShadow, uEmb;
uniform int uTones[16];
in vec2 vUV; flat in float vKind; flat in float vId; flat in vec4 vRect;
out vec4 o;
void main() {
  ivec2 org = ivec2(vRect.zw);
  if (vKind > 0.2 && vKind < 0.3) {
    vec4 e = texelFetch(uEmb, clamp(ivec2(floor(vUV)), org, org + ivec2(15)), 0);
    if (e.a < 0.5) discard;
    o = vec4(e.rgb, vId / 255.0); return;
  }
  ivec2 tc = clamp(ivec2(floor(vUV)), org, org + ivec2(vRect.xy) - 1);
  vec4 t = texelFetch(uAtlas, tc, 0);
  int mat = int(t.r * 255.0 + 0.5);
  if (mat == 0) discard;
  int tone = vKind > 0.4 ? (texelFetch(uShadow, tc - org, 0).r > 0.0 ? 3 : 0) : uTones[int(t.g * 255.0 + 0.5)];
  o = vec4(texelFetch(uPal, ivec2(tone, mat), 0).rgb, vId / 255.0);
}`;
const VS2 = `#version 300 es
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS2 = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uScene; uniform int uHover, uK; uniform vec3 uHoverInk;
out vec4 o;
int idAt(ivec2 p) { ivec2 sz = textureSize(uScene, 0); if (p.x < 0 || p.y < 0 || p.x >= sz.x || p.y >= sz.y) return 0; return int(texelFetch(uScene, p, 0).a * 255.0 + 0.5); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uScene, p, 0);
  int id = int(c.a * 255.0 + 0.5);
  bool hov = false;
  if (uHover > 0 && id != uHover) for (int i = 0; i < 4; i++) {
    ivec2 off = i == 0 ? ivec2(uK, 0) : i == 1 ? ivec2(0, uK) : i == 2 ? ivec2(-uK, 0) : ivec2(0, -uK);
    if (idAt(p + off) == uHover) hov = true;
  }
  if (hov) o = vec4(uHoverInk, 1.0); else if (id == 0) o = vec4(0.0); else o = vec4(c.rgb, 1.0);
}`;

function makeGL(canvas, scenes) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true });
  if (!gl) return null;
  const sh = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const p1 = program(VS, FS), p2 = program(VS2, FS2);
  const U1 = (n) => gl.getUniformLocation(p1, n), U2 = (n) => gl.getUniformLocation(p2, n);
  gl.useProgram(p1); gl.uniform1i(U1('uAtlas'), 0); gl.uniform1i(U1('uPal'), 1); gl.uniform1i(U1('uShadow'), 2); gl.uniform1i(U1('uEmb'), 4);
  gl.useProgram(p2); gl.uniform1i(U2('uScene'), 3);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const tex = (unit, ifmt, w, h, fmt, data) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    return t;
  };
  const corner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, corner); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const emptyVAO = gl.createVertexArray();
  const instVAO = (buf, start = 0) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corner); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, start * 32); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, start * 32 + 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    return vao;
  };
  const LIFE_MAX = 512;
  const lifeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lifeBuf); gl.bufferData(gl.ARRAY_BUFFER, LIFE_MAX * 32, gl.DYNAMIC_DRAW);
  const lifeVAO = instVAO(lifeBuf), lifeData = new Float32Array(LIFE_MAX * 8);

  const res = {};
  for (const key in scenes) {
    const sc = scenes[key];
    let b = 0;
    const entries = [{ m: sc.ground, x: 0, y: 0, id: 1 }, ...sc.items.map((it) => ({ m: it.model, x: it.x, y: it.y, id: it.repo ? 2 + b++ : 1, it }))];
    const lifeModels = [].concat(...sc.cars.map(c => [].concat(...c)), sc.puffs, [sc.plate], sc.parks);
    const all = entries.concat(lifeModels.map(m => ({ m, life: true })));
    const AW = 1024; let px = 0, py = 0, rowH = 0;
    for (const e of all) { const tw = e.m.w * e.m.H; if (px + tw > AW) { px = 0; py += rowH; rowH = 0; } e.m.ax = px; e.m.ay = py; px += tw; rowH = Math.max(rowH, e.m.d); }
    const AH = py + rowH, data = new Uint8Array(AW * AH * 2), inst = [];
    for (const e of all) {
      const m = e.m; e.i0 = inst.length / 8;
      for (let z = 0; z < m.H; z++) {
        for (let y = 0; y < m.d; y++) for (let x = 0; x < m.w; x++) { const i = (z * m.d + y) * m.w + x, o = ((m.ay + y) * AW + m.ax + z * m.w + x) * 2; data[o] = m.mat[i]; data[o + 1] = m.mask[i]; }
        if (e.life) continue;
        const top = (m.isGround && z === m.H - 1) ? .5 : 0;
        if (z > 0) inst.push(e.x, e.y, z + m.z0 - .5, e.id, m.w, m.d, m.ax + z * m.w, m.ay);
        inst.push(e.x, e.y, z + m.z0, e.id + top, m.w, m.d, m.ax + z * m.w, m.ay);
      }
      e.n = inst.length / 8 - e.i0;
    }
    const range = new Map(); for (const e of entries) if (e.it) range.set(e.it, { i0: e.i0, n: e.n });
    const emb0 = inst.length / 8;
    const emb = new Uint8Array(16 * 16 * sc.buildings.length * 4);
    sc.buildings.forEach((it, i) => {
      for (let y = 0; y < 16; y++) emb.set(sc.emblems[i].subarray(y * 64, y * 64 + 64), (y * 16 * sc.buildings.length + i * 16) * 4);
      inst.push(it.roof.x, it.roof.y, it.roof.z, i + 2 + .25, 8, 8, i * 16, 0);
    });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inst), gl.STATIC_DRAW);
    res[key] = { vao: instVAO(ib), count: inst.length / 8, ib, range, emb0, vaos: new Map(),
      atlas: tex(0, gl.RG8, AW, AH, gl.RG, data),
      pal: tex(1, gl.RGBA8, 4, sc.colors.length / 4, gl.RGBA, new Uint8Array(sc.colors.buffer)),
      shadow: tex(2, gl.R8, GW, GD, gl.RED, sc.shadowMask),
      emb: tex(4, gl.RGBA8, 16 * sc.buildings.length, 16, gl.RGBA, emb) };
  }
  const fbo = gl.createFramebuffer(); let sceneTex = null, depthRB = null;
  const uRot = U1('uRot'), uView = U1('uView'), uCenter = U1('uCenter'), uTones = U1('uTones'), uOrigin = U1('uOrigin');
  const uHover = U2('uHover'), uK = U2('uK'), uHoverInk = U2('uHoverInk');
  gl.depthFunc(gl.LEQUAL); gl.clearColor(0, 0, 0, 0);
  const px1 = new Uint8Array(4);
  return {
    gl,
    resize(w, h) {
      canvas.width = w; canvas.height = h;
      if (sceneTex) gl.deleteTexture(sceneTex); if (depthRB) gl.deleteRenderbuffer(depthRB);
      sceneTex = tex(3, gl.RGBA8, w, h, gl.RGBA, null);
      depthRB = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depthRB); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRB);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    /* returns the id under o.pick (device pixels), or -1 when no pick was asked for */
    draw(key, theta, view, o) {
      const sc = scenes[key], r = setup(key, theta, view, 0, 0, new Int32Array(sc.tones));
      gl.bindVertexArray(r.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, r.count);
      drawLife(o.life);
      let picked = -1;
      if (o.pick) { gl.readPixels(o.pick[0], canvas.height - 1 - o.pick[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); picked = px1[3]; }
      finish(o);
      return picked;
    },
    /* one building on its lot plate, or one park model, rotated about the plate centre */
    drawOne(key, target, theta, view, o) {
      const sc = scenes[key], it = target.item;
      const r = setup(key, theta, view, it ? it.x : 0, it ? it.y : 0, tonesOf(theta));
      drawLife([{ m: it ? sc.plate : sc.parks[target.park], x: it ? it.x : 0, y: it ? it.y : 0, z: -2 }]);
      if (it) {
        const rg = r.range.get(it);
        gl.bindVertexArray(vaoAt(r, rg.i0)); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rg.n);
        gl.bindVertexArray(vaoAt(r, r.emb0 + sc.buildings.indexOf(it))); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
      }
      drawLife(o.life);
      finish(o);
    },
  };
  function vaoAt(r, start) { let v = r.vaos.get(start); if (!v) { v = instVAO(r.ib, start); r.vaos.set(start, v); } return v; }
  function setup(key, theta, view, ox, oy, tones) {
    const sc = scenes[key], r = res[key];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(p1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.atlas);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.pal);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, sc.colors.length / 4, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(sc.colors.buffer));
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, r.shadow);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GD, gl.RED, gl.UNSIGNED_BYTE, sc.shadowMask);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, r.emb);
    gl.uniform2f(uRot, Math.cos(theta), Math.sin(theta)); gl.uniform2f(uView, view.BW, view.BH); gl.uniform2f(uCenter, view.cx, view.cy);
    gl.uniform2f(uOrigin, ox, oy);
    gl.uniform1iv(uTones, tones);
    return r;
  }
  function drawLife(list) {
    let n = 0;
    for (const li of list) {
      const m = li.m;
      for (let z = 0; z < m.H && n < LIFE_MAX - 2; z++) {
        if (z > 0) { lifeData.set([li.x, li.y, li.z + z - .5, 1, m.w, m.d, m.ax + z * m.w, m.ay], n * 8); n++; }
        lifeData.set([li.x, li.y, li.z + z, 1, m.w, m.d, m.ax + z * m.w, m.ay], n * 8); n++;
      }
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, lifeBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, lifeData, 0, n * 8);
    gl.bindVertexArray(lifeVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  }
  function finish(o) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(uHover, o.hover); gl.uniform1i(uK, o.k); gl.uniform3fv(uHoverInk, o.hoverInk);
    gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
function tonesOf(theta) {
  const cos = Math.cos(theta), sin = Math.sin(theta), faceTone = [], faceCam = [], out = new Int32Array(16);
  for (const [nx, ny] of NORMALS) {
    const rx = cos * nx - sin * ny, ry = sin * nx + cos * ny, b = rx * LIGHT[0] + ry * LIGHT[1];
    faceTone.push(b > .3 ? 1 : b > -.45 ? 2 : 3); faceCam.push(ry);
  }
  for (let m = 1; m < 16; m++) { let best = -9, t = 2; for (let f = 0; f < 4; f++) if (m & (1 << f) && faceCam[f] > best) { best = faceCam[f]; t = faceTone[f]; } out[m] = t; }
  return out;
}

/* ---------- page styles ---------- */
const css = document.createElement('style');
css.textContent = `
.repo-city { position: relative; display: flex; justify-content: center; width: 100%; }
.repo-city__canvas { display: block; }
.repo-city__label { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); white-space: nowrap; pointer-events: none;
  font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.78rem; line-height: 1.2; padding: 5px 8px 4px;
  border: 2px solid #1a2419; border-radius: 0; background: #f0efeb; color: #1a2419; z-index: 2; }
.repo-city__label span { color: #4d6650; }
.repo-city__label::after { content: ''; position: absolute; left: 50%; top: 100%; width: 2px; height: 8px; margin: 2px 0 0 -1px; background: #1a2419; }
:root[data-theme="dark"] .repo-city__label { background: #1a2419; color: #f0efeb; border-color: #f0efeb; }
:root[data-theme="dark"] .repo-city__label span { color: #a3b18a; }
:root[data-theme="dark"] .repo-city__label::after { background: #f0efeb; }
.repo-city-hint { list-style: none; margin: 16px auto 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; max-width: 680px; }
.repo-city-hint li { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
  font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.75rem; line-height: 1.35; color: #1a2419; }
.repo-city-hint canvas { display: block; width: 132px; height: 90px; image-rendering: pixelated; }
.repo-city-hint span { display: block; color: #4d6650; }
:root[data-theme="dark"] .repo-city-hint li { color: #f0efeb; }
:root[data-theme="dark"] .repo-city-hint span { color: #a3b18a; }
.rc-cv { display: block; }
.rc-lot { position: absolute; left: 14px; bottom: 12px; overflow: hidden; pointer-events: none; }
.rc-lot .rc-cv { position: absolute; left: 0; bottom: 0; }
.rc-cap { position: absolute; bottom: 26px; pointer-events: none; font-family: 'Silkscreen', 'Courier New', monospace; font-size: 0.72rem; line-height: 1.45; color: #1a2419; }
.rc-cap span { display: block; color: #4d6650; }
:root[data-theme="dark"] .rc-cap { color: #f0efeb; }
:root[data-theme="dark"] .rc-cap span { color: #a3b18a; }
@media (max-width: 640px) { .repo-city-hint { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 8px; } }
@media (max-width: 359px) { .rc-cap { display: none; } }`;
document.head.appendChild(css);
const font = document.createElement('link'); font.rel = 'stylesheet'; font.href = 'https://fonts.googleapis.com/css2?family=Silkscreen&display=swap';
document.head.appendChild(font);

/* phones and tablets get their own instructions; ?touch forces them on a desktop for review (mock only) */
const IS_TOUCH = matchMedia('(hover: none)').matches || /[?&]touch\b/.test(location.search);

/* ---------- one mounted city ---------- */
const scenes = { maquette: makeScene('maquette'), night: makeScene('night') };
const view = viewFor(scenes.maquette, scenes.night);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const themeKey = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'night' : 'maquette';

function mount(host, mode, onSelect) {
  const root = document.createElement('div'); root.className = 'repo-city repo-city--' + mode;
  const canvas = document.createElement('canvas'); canvas.className = 'repo-city__canvas';
  const label = document.createElement('div'); label.className = 'repo-city__label'; label.hidden = true;
  root.append(canvas, label); host.appendChild(root);
  let glv = null;
  try { glv = makeGL(canvas, scenes); } catch (e) { console.error('[repo-city mock]', e); }
  if (!glv) { root.textContent = 'WebGL2 is not available in this browser.'; return; }
  root.dataset.renderer = 'webgl2'; root.dataset.buildings = String(scenes.maquette.buildings.length);

  let scale = 1, dpr = 1, kpx = 1;
  const fit = () => {
    const w = host.clientWidth, narrow = w < 768;
    const maxH = mode === 'ambient' ? (narrow ? 360 : 520) : (narrow ? 300 : 400);
    scale = Math.min(w / view.BW, maxH / view.BH);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    kpx = Math.max(1, Math.round(scale * dpr));
    canvas.style.width = view.BW * scale + 'px'; canvas.style.height = view.BH * scale + 'px';
    glv.resize(Math.round(view.BW * scale * dpr), Math.round(view.BH * scale * dpr));
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(host);

  let theta = .62, hover = 0, paused = false, pointer = null, onScreen = true, last = performance.now(), lifeMs = 0;
  const io = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }); io.observe(root);
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; lastType = e.pointerType; pointer = [Math.floor((e.clientX - canvas.getBoundingClientRect().left) * dpr), Math.floor((e.clientY - canvas.getBoundingClientRect().top) * dpr)]; paused = true; });
  /* touch: the first tap selects a building and shows its tag, a second tap on it opens it, a tap on the ground clears */
  let lastType = 'mouse', touchSel = 0;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) * dpr), Math.floor((e.clientY - r.top) * dpr)]; };
  canvas.addEventListener('pointerdown', (e) => { lastType = e.pointerType; if (e.pointerType === 'touch') { pointer = at(e); paused = true; } });
  canvas.addEventListener('pointerleave', () => { if (lastType === 'touch') return; pointer = null; paused = false; hover = 0; });
  canvas.addEventListener('click', () => {
    const it = hover ? scenes[themeKey()].buildings[hover - 2] : null;
    if (lastType === 'touch') {
      if (!it) { touchSel = 0; pointer = null; paused = false; hover = 0; return; }
      if (touchSel !== hover) { touchSel = hover; return; }
    }
    if (!it) return;
    if (onSelect && onSelect(it.repo)) return;
    window.open(it.repo.url, '_blank', 'noopener');
  });

  function frame(now) {
    if (!canvas.isConnected) { ro.disconnect(); io.disconnect(); const ext = glv.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (!onScreen || document.visibilityState !== 'visible') return;
    if (!reduce) { lifeMs += dt; if (!paused) theta += dt * (Math.PI * 2 / 48000); }
    const key = themeKey(), sc = scenes[key], tick = Math.floor(lifeMs / 125);
    computeLighting(sc, theta, tick);
    const picked = glv.draw(key, theta, view, { hover, k: kpx, hoverInk: hex(sc.S.hoverInk).map(v => v / 255), life: reduce ? [] : lifeInstances(sc, tick), pick: pointer });
    if (picked >= 0) hover = picked >= 2 ? picked : 0;
    canvas.style.cursor = hover ? 'pointer' : 'default';
    const it = hover ? sc.buildings[hover - 2] : null;
    label.hidden = !it;
    if (it) {
      const r = it.repo, age = r.days === 0 ? 'today' : r.days < 60 ? r.days + 'd ago' : Math.round(r.days / 30) + 'mo ago';
      const html = r.name + ' <span>· ' + r.lang + ' · pushed ' + age + '</span>';
      if (label.innerHTML !== html) label.innerHTML = html;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const sx = view.cx + cos * it.x - sin * it.y, sy = view.cy + (sin * it.x + cos * it.y) * SQ;
      const half = label.offsetWidth / 2, left = canvas.offsetLeft + sx * scale;
      label.style.left = Math.max(half, Math.min(root.clientWidth - half, left)) + 'px';
      label.style.top = (canvas.offsetTop + (sy - it.top) * scale - 12) + 'px';
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- interaction hint: four pixel vignettes on the same 8 Hz clock ---------- */
const HINT_PAL = {
  maquette: { ink: '#1a2419', paper: '#f0efeb', wall: '#588157', side: '#3a5a40', roof: '#a3b18a', rim: null,
    wallB: '#c9c2ad', sideB: '#a39c85', roofB: '#f0efeb', rimB: null, win: '#344e41', lit: '#f6d98b', ground: '#b6b09c', spark: '#1a2419', muted: '#4d6650' },
  night: { ink: '#f0efeb', paper: '#1a2419', wall: '#30403a', side: '#1f2b24', roof: '#3d4f40', rim: '#4da3ff',
    wallB: '#33392b', sideB: '#22271d', roofB: '#454d3a', rimB: '#ffa24d', win: '#121a14', lit: '#ffd98a', ground: '#3d4f40', spark: '#ffd98a', muted: '#a3b18a' },
};
const ARROW = ['X.......', 'XX......', 'XoX.....', 'XooX....', 'XoooX...', 'XooooX..', 'XoooooX.', 'XooooXXX', 'XoXoX...', 'XX.XoX..', 'X..XoX..', '....XX..'];
const HAND = ['....XX.......', '...XooX......', '...XooX......', '...XooX......', '...XooXXX....', '...XooXooXXX.', 'XX.XooXooXooX',
  'XoXXooooooooX', 'XooXooooooooX', '.XooooooooooX', '.XooooooooooX', '..XooooooooX.', '..XooooooooX.', '...XXXXXXXX..'];
const OPEN = ['XXXX..XXX', 'X......XX', 'X.....X.X', 'X....X...', 'X...X...X', 'X.......X', 'X.......X', 'X.......X', 'XXXXXXXXX'];
function hintSprite(ctx, map, x, y, ink, fill) {
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { if (row[i] === '.') continue; ctx.fillStyle = row[i] === 'X' ? ink : fill; ctx.fillRect(x + i, y + j, 1, 1); } });
}
function hintTower(ctx, P, x, base, w, h, o) {
  o = o || {};
  const top = base - h, wall = o.alt ? P.wallB : P.wall, side = o.alt ? P.sideB : P.side, roof = o.alt ? P.roofB : P.roof, rim = o.alt ? P.rimB : P.rim;
  const shape = (dx, dy, solid) => {
    ctx.fillStyle = solid || wall; ctx.fillRect(x + dx, top + dy, w, h);
    ctx.fillStyle = solid || side; for (let j = 1; j <= 3; j++) ctx.fillRect(x + w - 1 + j + dx, top - j + dy, 1, h);
    ctx.fillStyle = solid || roof; for (let i = 1; i <= 3; i++) ctx.fillRect(x + i + dx, top - i + dy, w, 1);
  };
  if (o.outline) for (const d of [[-1, 0], [1, 0], [0, -1], [0, 1]]) shape(d[0], d[1], P.ink);
  shape(0, 0, null);
  if (rim) { ctx.fillStyle = rim; ctx.fillRect(x, top, w, 1); for (let j = 1; j <= 3; j++) ctx.fillRect(x + w - 1 + j, top - j, 1, 1); }
  for (let r = 0, y = base - 3; y >= top + 1; r++, y -= 3) for (let c = 0; c < 2; c++) {
    ctx.fillStyle = o.lit && o.lit(r, c) ? P.lit : P.win; ctx.fillRect(x + (c ? w - 3 : 1), y, 2, 2);
  }
}
const hintGround = (ctx, P) => { ctx.fillStyle = P.ground; ctx.fillRect(3, 26, 38, 1); };
const step = (a, b, k) => Math.round(a + (b - a) * k);
/* shared pieces of the first two vignettes */
const hintTag = (ctx, P) => {
  ctx.fillStyle = P.ink; ctx.fillRect(8, 1, 20, 7); ctx.fillRect(18, 8, 1, 2);
  ctx.fillStyle = P.paper; ctx.fillRect(9, 2, 18, 5);
  ctx.fillStyle = P.ink; ctx.fillRect(11, 4, 5, 1);
  ctx.fillStyle = P.muted; ctx.fillRect(18, 4, 3, 1); ctx.fillRect(22, 4, 3, 1);
};
const hintRipple = (ctx, P, cx, cy, r) => {   // a one-pixel ring around the fingertip
  ctx.fillStyle = P.spark;
  for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r * .7), 1, 1); }
};
const LIT = (r, c) => (r + c) % 2 === 0;
const HINTS = [
  { text: ['Hover', 'names the repo'], touch: ['Tap', 'names the repo'], still: 14,
    draw(ctx, P, t, touch) {
      hintGround(ctx, P);
      if (touch) {   // a finger comes in, taps once, the name tag pops, the finger leaves
        const on = t >= 8 && t < 27, down = t >= 6 && t < 9;
        const k = t < 6 ? t / 6 : t < 12 ? 1 : Math.max(0, 1 - (t - 12) / 6);
        hintTower(ctx, P, 14, 26, 8, 13, { outline: on, lit: LIT });
        if (on) hintTag(ctx, P);
        if (t >= 6 && t < 10) hintRipple(ctx, P, 19.5, 18, 3 + (t - 6) * 2);
        if (t < 18) hintSprite(ctx, HAND, step(30, 15, k), step(31, 17, k) + (down ? 1 : 0), P.ink, P.paper);
        return;
      }
      const on = t >= 8 && t < 24, k = t < 8 ? t / 8 : t < 24 ? 1 : 1 - (t - 24) / 8;
      hintTower(ctx, P, 14, 26, 8, 13, { outline: on, lit: LIT });
      if (on) hintTag(ctx, P);
      hintSprite(ctx, ARROW, step(37, 19, k), step(27, 17, k), P.ink, P.paper);
    } },
  { text: ['Click', 'opens it on GitHub'], touch: ['Tap again', 'opens it on GitHub'], still: 16,
    draw(ctx, P, t, touch) {
      const down = t >= 8 && t < 11;
      hintGround(ctx, P);
      hintTower(ctx, P, 14, 26, 8, 13, { outline: true, lit: LIT });
      if (touch) {   // the tag from the first tap is still up; the second tap opens the repo
        hintTag(ctx, P);
        if (t >= 8 && t < 12) hintRipple(ctx, P, 19.5, 18, 3 + (t - 8) * 2);
      } else if (down) { ctx.fillStyle = P.spark; ctx.fillRect(19, 12, 2, 3); ctx.fillRect(16, 15, 1, 1); ctx.fillRect(15, 14, 1, 1); ctx.fillRect(23, 15, 1, 1); ctx.fillRect(24, 14, 1, 1); }
      if (t >= 11 && t < 28) hintSprite(ctx, OPEN, 30, (touch ? 14 : 9) - Math.min(4, t - 11), P.ink, P.paper);
      hintSprite(ctx, HAND, 15, 17 + (down ? 1 : 0), P.ink, P.paper);
    } },
  { text: ['Taller', 'more code'], still: 31,
    draw(ctx, P, t) {
      hintGround(ctx, P);
      hintTower(ctx, P, 4, 26, 7, 5, { alt: true });
      hintTower(ctx, P, 16, 26, 7, 10, { alt: true });
      hintTower(ctx, P, 28, 26, 7, 11 + Math.min(6, Math.floor(t / 4)));
    } },
  { text: ['Lit windows', 'pushed lately'], still: 31,
    draw(ctx, P, t) {
      const n = Math.floor(t / 3);
      hintGround(ctx, P);
      hintTower(ctx, P, 7, 26, 8, 12, { alt: true });
      hintTower(ctx, P, 24, 26, 8, 15, { lit: (r, c) => r * 2 + c < n });
    } },
];
function mountHint(host) {
  const touch = IS_TOUCH;
  const list = document.createElement('ul'); list.className = 'repo-city-hint';
  const tiles = HINTS.map((h) => {
    const li = document.createElement('li'), cv = document.createElement('canvas'), cap = document.createElement('div');
    cv.width = 44; cv.height = 30; cv.setAttribute('aria-hidden', 'true');
    const text = touch && h.touch ? h.touch : h.text;
    cap.append(text[0]); const sub = document.createElement('span'); sub.textContent = text[1]; cap.append(sub);
    li.append(cv, cap); list.append(li);
    return { h, ctx: cv.getContext('2d') };
  });
  host.appendChild(list);
  let seen = true, lastKey = '';
  const io = new IntersectionObserver((es) => { seen = es[0].isIntersecting; }); io.observe(list);
  function frame(now) {
    if (!list.isConnected) { io.disconnect(); return; }
    requestAnimationFrame(frame);
    if (!seen || document.visibilityState !== 'visible') return;
    const tick = Math.floor(now / 125), key = themeKey() + ':' + (reduce ? 0 : tick);
    if (key === lastKey) return; lastKey = key;
    const P = HINT_PAL[themeKey()];
    tiles.forEach((tile, i) => {
      tile.ctx.clearRect(0, 0, 44, 30);
      tile.h.draw(tile.ctx, P, reduce ? tile.h.still : (tick + i * 8) % 32, touch);
    });
  }
  requestAnimationFrame(frame);
}

/* ---------- find the plan's insertion points in the live React DOM ---------- */
const childOf = (ancestor, node) => { while (node && node.parentElement !== ancestor) node = node.parentElement; return node; };
const mobile = () => window.innerWidth < 768;

/* ---------- Projects page: each card shows its repo's building on a corner lot ---------- */
const PLATE = 18, RADP = Math.hypot(PLATE, PLATE) / 2, LOT_K = 2;
const fmtAge = (d) => d === 0 ? 'today' : d < 60 ? d + 'd ago' : Math.round(d / 30) + 'mo ago';
const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
function puffsFor(sc, it, tick) {
  if (!it.vent) return [];
  const out = [], ph = hash(it.repo.name) % 24;
  for (let j = 0; j < 3; j++) {
    const age = (tick + j * 8 + ph) % 24;
    out.push({ m: sc.puffs[age < 8 ? 0 : age < 16 ? 1 : 2], x: it.vent.x + Math.floor(age / 8), y: it.vent.y, z: it.vent.z + 1 + Math.floor(age / 2) });
  }
  return out;
}
/* shared view for every lot: wide enough for the plate, tall enough for the tallest building and its smoke */
function lotView() {
  let need = RADP * SQ;
  for (const key in scenes) {
    for (const it of scenes[key].buildings) need = Math.max(need, Math.hypot(it.w, it.d) / 2 * SQ + it.top + (it.vent ? 14 : 0));
    for (const m of scenes[key].parks) need = Math.max(need, RADP * SQ + m.H - 3);
  }
  const cy = Math.ceil(need) + 2, BW = Math.ceil(RADP * 2) + 4;
  return { BW, BH: Math.ceil(cy + RADP * SQ + 5), cx: BW / 2, cy };
}

const PARK_OFFSET = Number(new URLSearchParams(location.search).get('po') || 0);   // mock only: shift which park variant comes first
function mountCards() {
  const off = document.createElement('canvas');
  let glc = null;
  try { glc = makeGL(off, scenes); } catch (e) { console.error('[repo-city mock]', e); }
  if (!glc) return { destroy() {} };
  const view1 = lotView(), dpr = Math.min(window.devicePixelRatio || 1, 2), CW = view1.BW * LOT_K, CH = view1.BH * LOT_K;
  glc.resize(Math.round(CW * dpr), Math.round(CH * dpr));
  /* CSS height of the visible part of a lot: from the highest point of its content to the bottom of the canvas */
  const lotHeight = (d) => {
    const it = d.idx >= 0 ? scenes.maquette.buildings[d.idx] : null;
    const reach = it ? Math.hypot(it.w, it.d) / 2 * SQ + it.top : RADP * SQ + scenes.maquette.parks[d.park].H - 3;
    return CH - Math.floor((view1.cy - reach) * LOT_K) + 4;
  };

  const decos = new Map(), parkOf = new Map();
  const lookup = (card) => {
    const title = card.querySelector('h3').textContent, a = card.querySelector('a[href*="github.com/"]');
    const name = a ? a.getAttribute('href').replace(/\/+$/, '').split('/').pop().toLowerCase() : '';
    const idx = name ? scenes.maquette.buildings.findIndex(b => b.repo.name.toLowerCase() === name) : -1;
    if (idx < 0 && !parkOf.has(title)) parkOf.set(title, (parkOf.size + PARK_OFFSET) % scenes.maquette.parks.length);   // each park card takes the next variant
    return { title, idx, park: idx < 0 ? parkOf.get(title) : -1 };
  };
  function apply(d) {
    const r = d.idx >= 0 ? scenes.maquette.buildings[d.idx].repo : null, lotH = lotHeight(d);
    d.lot.style.height = lotH + 'px';
    d.footer.style.minHeight = Math.max(36, lotH - 12) + 'px'; d.footer.style.alignItems = 'flex-end';
    d.cap.innerHTML = r ? r.lang + '<span>pushed ' + fmtAge(r.days) + '</span>' : '';
  }
  function make(card) {
    const d = Object.assign({ card, speed: 1, hover: false, undo: [] }, lookup(card));
    d.theta = .62 + (hash(d.title) % 628) / 100;
    const cv = mk('canvas', 'rc-cv'); cv.width = off.width; cv.height = off.height; cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
    cv.setAttribute('aria-hidden', 'true');
    d.cv = cv; d.ctx = cv.getContext('2d');
    const enter = () => { d.hover = true; }, leave = () => { d.hover = false; };
    card.addEventListener('mouseenter', enter); card.addEventListener('mouseleave', leave);
    d.footer = Array.from(card.children).filter(c => !/^rc-/.test(c.className || '')).pop();
    d.lot = mk('div', 'rc-lot'); d.lot.style.width = CW + 'px'; d.lot.append(cv);
    d.cap = mk('div', 'rc-cap'); d.cap.style.left = (14 + CW + 8) + 'px';
    card.append(d.lot, d.cap);
    d.undo.push(() => { card.removeEventListener('mouseenter', enter); card.removeEventListener('mouseleave', leave);
      d.lot.remove(); d.cap.remove(); d.footer.style.minHeight = ''; d.footer.style.alignItems = 'center'; });
    apply(d);
    decos.set(card, d);
  }

  let nextSync = 0;
  function sync(now) {
    if (now < nextSync) return; nextSync = now + 200;
    const first = Array.from(document.querySelectorAll('h3')).map(h => h.parentElement && h.parentElement.parentElement)
      .find(c => c && c.parentElement && getComputedStyle(c.parentElement).display === 'grid');
    const cards = first ? Array.from(first.parentElement.children).filter(c => c.querySelector(':scope > div > h3')) : [];
    for (const c of cards) {
      const d = decos.get(c);
      if (!d) make(c);
      else if (d.title !== c.querySelector('h3').textContent) { Object.assign(d, lookup(c)); apply(d); }
    }
    for (const [c, d] of decos) if (!c.isConnected) { d.undo.forEach(f => f()); decos.delete(c); }
  }

  let alive = true, last = performance.now(), lifeMs = 0;
  function frame(now) {
    if (!alive) return;
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (document.visibilityState !== 'visible') return;
    lifeMs += dt; sync(now);
    const key = themeKey(), sc = scenes[key], tick = Math.floor(lifeMs / 125), vh = window.innerHeight;
    for (const b of sc.blinkers) { const c = (tick % 12) < 6 ? b.on : b.off; sc.colors[b.n * 4] = sc.colors[b.n * 4 + 1] = sc.colors[b.n * 4 + 2] = sc.colors[b.n * 4 + 3] = c; }
    for (const d of decos.values()) {
      const rect = d.lot.getBoundingClientRect(), visible = rect.bottom > -40 && rect.top < vh + 40;
      d.speed += ((d.hover ? 5 : 1) - d.speed) * Math.min(1, dt / 240);
      if (!reduce) d.theta += dt * (Math.PI * 2 / 26000) * d.speed;
      if (!visible) continue;
      const it = d.idx >= 0 ? sc.buildings[d.idx] : null;
      glc.drawOne(key, { item: it, park: d.park }, d.theta, view1, { hover: 0, k: 1, hoverInk: [0, 0, 0], life: reduce || !it ? [] : puffsFor(sc, it, tick) });
      d.ctx.clearRect(0, 0, d.cv.width, d.cv.height); d.ctx.drawImage(off, 0, 0);
    }
    if (sheet) {   // mock only: ?parksheet shows all six parks enlarged
      const x = sheet.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = getComputedStyle(document.body).backgroundColor; x.fillRect(0, 0, sheet.width, sheet.height);
      sc.parks.forEach((m, i) => {
        glc.drawOne(key, { item: null, park: i }, .62 + lifeMs / 4000, view1, { hover: 0, k: 1, hoverInk: [0, 0, 0], life: [] });
        x.drawImage(off, 0, off.height - 70 * LOT_K * dpr, off.width, 70 * LOT_K * dpr, i * 190, 0, 180, 420);
      });
    }
  }
  const sheet = /parksheet/.test(location.search) ? mk('canvas') : null;
  if (sheet) { sheet.width = 1140; sheet.height = 420; sheet.style.cssText = 'position:fixed;left:16px;top:100px;z-index:99999;border:1px dashed #588157'; document.body.append(sheet); }
  requestAnimationFrame(frame);
  return { destroy() {
    if (sheet) sheet.remove();
    alive = false;
    for (const d of decos.values()) d.undo.forEach(f => f());
    decos.clear();
    const ext = glc.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
  } };
}

let cardsCtl = null;
function tryMount() {
  const onProjects = location.pathname.replace(/\/$/, '') === '/projects';
  if (!onProjects && cardsCtl) { cardsCtl.destroy(); cardsCtl = null; }
  if (onProjects) { if (!cardsCtl && document.querySelector('h3')) cardsCtl = mountCards(); return; }
  if (document.querySelector('.repo-city-host')) return;
  const host = document.createElement('div'); host.className = 'repo-city-host';
  if (location.pathname === '/') {
    const h2 = Array.from(document.querySelectorAll('h2')).find(h => /Some Things I.ve Built/.test(h.textContent));
    const section = h2 && h2.closest('section'); if (!section) return;
    host.style.cssText = `margin-bottom:${mobile() ? 40 : 60}px;min-height:${mobile() ? 300 : 440}px`;
    childOf(section, h2).after(host);
    mount(host, 'ambient', null);
    mountHint(host);
  }
}
let queued = false;
new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; tryMount(); }); }).observe(document.body, { childList: true, subtree: true });
tryMount();
})();
