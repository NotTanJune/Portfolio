import { hash } from './rng';
import { shortLanguage } from './format';
import { Blinker, RGB, StyleDef, StyleKey } from './types';

export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a: ArrayLike<number>, b: ArrayLike<number>, t: number): RGB =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
export const toHex = (c: ArrayLike<number>): string =>
  '#' + [0, 1, 2].map((i) => (c[i] < 16 ? '0' : '') + c[i].toString(16)).join('');
/** Little-endian RGBA with full alpha, as a Uint32. */
export const pack = (c: ArrayLike<number>): number => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
export const litChance = (days: number): number =>
  days <= 7 ? 0.72 : days <= 30 ? 0.45 : days <= 120 ? 0.2 : days <= 365 ? 0.08 : 0.02;
export const luma = (c: ArrayLike<number>): number => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 255000;

export const STYLES: Record<StyleKey, StyleDef> = {
  maquette: {
    shadow: '#344e41', highlight: '#ffffff',
    ground: { lot: '#cfcabb', road: '#b6b09c', dash: '#dad7cd', grass: '#a3b18a', soil: '#8c8672', lamp: null },
    lang: {
      Rust: { wall: '#588157', roof: '#3a5a40' }, Swift: { wall: '#f0efeb', roof: '#dad7cd' },
      TypeScript: { wall: '#a3b18a', roof: '#588157' }, JavaScript: { wall: '#a3b18a', roof: '#f0efeb' },
      Python: { wall: '#c9c2ad', roof: '#a3b18a' }, Jupyter: { wall: '#c9c2ad', roof: '#588157' },
      'C++': { wall: '#b6b09c', roof: '#f0efeb' }, HTML: { wall: '#f0efeb', roof: '#a3b18a' },
    },
    window: '#344e41', windowLit: '#f6d98b', trimMix: 0.18,
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
    window: '#121a14', windowLit: '#ffd98a', windowLitAlt: '#9fe6ff', trimMix: 0.25,
    props: ['antenna', 'beacon', 'vent'], leaf: '#2f4a33', trunk: '#1c241c',
    cars: ['#3d4f40', '#4a5c4d', '#56505e'], puff: '#4a5c4d', hoverInk: '#f0efeb',
  },
};

/**
 * The colours for a language: the entry for a known one, otherwise a deterministic pick from the
 * style's entries. `Jupyter Notebook` is looked up as `Jupyter`.
 */
export function languageStyle(style: StyleDef | StyleKey, language: string) {
  const S = typeof style === 'string' ? STYLES[style] : style;
  const lang = shortLanguage(language);
  if (S.lang[lang]) return S.lang[lang];
  const entries = Object.keys(S.lang).map((k) => S.lang[k]);
  return entries[hash(lang) % entries.length];
}

export interface MaterialOptions { emissive?: boolean; blink?: boolean }

/** The material table of one scene: 4 packed tones per material, id 0 reserved for empty. */
export interface Materials {
  key: StyleKey;
  style: StyleDef;
  shadow: RGB;
  highlight: RGB;
  colors: number[];
  blinkers: Blinker[];
  /** Id of the material for a colour, created on first use. Throws when ids would pass 255. */
  get(h: string, o?: MaterialOptions): number;
}

export function createMaterials(key: StyleKey): Materials {
  const style = STYLES[key];
  const shadow = hex(style.shadow);
  const highlight = hex(style.highlight);
  const colors: number[] = [0, 0, 0, 0];
  const blinkers: Blinker[] = [];
  const cache: Record<string, number> = {};
  const get = (h: string, o: MaterialOptions = {}): number => {
    const id = h + (o.emissive ? 'e' : '') + (o.blink ? 'b' : '');
    if (cache[id] !== undefined) return cache[id];
    const c = hex(h);
    const n = colors.length / 4;
    // Ids are stored in a Uint8Array, so 255 is the last usable one.
    if (n > 255) throw new Error('Repo city: the material table would exceed 255 entries');
    if (o.emissive) colors.push(pack(c), pack(c), pack(c), pack(c));
    else colors.push(pack(mix(c, highlight, 0.16)), pack(c), pack(mix(c, shadow, 0.2)), pack(mix(c, shadow, 0.42)));
    if (o.blink) blinkers.push({ n, on: pack(c), off: pack(mix(c, shadow, 0.75)) });
    cache[id] = n;
    return n;
  };
  return { key, style, shadow, highlight, colors, blinkers, get };
}

/** Material ids of the ground, shared by the city ground, the lot plate and the parks. */
export interface GroundMaterials { lot: number; road: number; dash: number; grass: number; soil: number; lamp: number }

export function groundMaterials(m: Materials): GroundMaterials {
  const G = m.style.ground;
  return {
    lot: m.get(G.lot), road: m.get(G.road), dash: m.get(G.dash), grass: m.get(G.grass), soil: m.get(G.soil),
    lamp: G.lamp ? m.get(G.lamp, { emissive: true }) : 0,
  };
}
