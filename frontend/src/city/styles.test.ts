import { createMaterials, hex, languageStyle, litChance, luma, mix, pack, STYLES, toHex } from './styles';

describe('colour helpers', () => {
  it('round-trips hex and packs little-endian RGBA with full alpha', () => {
    expect(hex('#344e41')).toEqual([0x34, 0x4e, 0x41]);
    expect(toHex(hex('#0a0b0c'))).toBe('#0a0b0c');
    expect(pack([0x11, 0x22, 0x33])).toBe(0xff332211);
  });

  it('mixes linearly and measures luma', () => {
    expect(mix([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(luma([255, 255, 255])).toBeCloseTo(1, 5);
    expect(luma([0, 0, 0])).toBe(0);
  });

  it('lowers the lit-window chance as a push gets older', () => {
    const chances = [0, 7, 8, 30, 31, 120, 121, 365, 366].map(litChance);
    expect(chances).toEqual([0.72, 0.72, 0.45, 0.45, 0.2, 0.2, 0.08, 0.08, 0.02]);
  });
});

describe('languageStyle', () => {
  it('returns the entry of a known language and maps Jupyter Notebook to Jupyter', () => {
    expect(languageStyle('maquette', 'Rust')).toBe(STYLES.maquette.lang.Rust);
    expect(languageStyle(STYLES.night, 'Jupyter Notebook')).toBe(STYLES.night.lang.Jupyter);
  });

  it('picks an unknown language deterministically from the style entries', () => {
    const a = languageStyle('night', 'Logos');
    expect(languageStyle('night', 'Logos')).toBe(a);
    expect(Object.keys(STYLES.night.lang).map((k) => STYLES.night.lang[k])).toContain(a);
  });
});

describe('createMaterials', () => {
  it('reserves id 0, reuses ids for the same colour and keeps emissive ones apart', () => {
    const m = createMaterials('maquette');
    const a = m.get('#588157');
    expect(a).toBe(1);
    expect(m.get('#588157')).toBe(a);
    const e = m.get('#588157', { emissive: true });
    expect(e).not.toBe(a);
    // an emissive material has the same colour in all four tones
    const tones = m.colors.slice(e * 4, e * 4 + 4);
    expect(new Set(tones).size).toBe(1);
    expect(new Set(m.colors.slice(a * 4, a * 4 + 4)).size).toBe(4);
  });

  it('registers a blinker for a blinking material only', () => {
    const m = createMaterials('night');
    const id = m.get('#ff5a4d', { emissive: true, blink: true });
    expect(m.blinkers).toHaveLength(1);
    expect(m.blinkers[0].n).toBe(id);
    expect(m.blinkers[0].on).not.toBe(m.blinkers[0].off);
  });

  it('allows ids up to 255 and throws on the next one', () => {
    const m = createMaterials('maquette');
    const colour = (i: number) => '#' + ('000000' + i.toString(16)).slice(-6);
    for (let i = 0; i < 255; i++) expect(m.get(colour(i))).toBe(i + 1);
    expect(() => m.get(colour(255))).toThrow(/255/);
  });
});
