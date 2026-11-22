import { SQ } from './layout';
import { faceTones } from './scene';
import { hex } from './styles';
import { LifeInstance, LotTarget, Model, Scene, View } from './types';

/**
 * The WebGL2 sprite stack renderer. Every model is a stack of flat slices; each slice is one instanced
 * quad that samples its own cells from an atlas, rotated about the vertical axis by one shared angle.
 *
 * Ids written to the alpha channel of the scene target (used by the hover outline): 1 for ground, trees and
 * life, `buildingIndex + 2` for a building and its emblem. (The software rasteriser uses `buildingIndex + 1`
 * and 0, see raster.ts, so callers convert: a `pick` result N is building N - 1, and its GL id is N + 1.)
 *
 * Callers run `computeLighting` (or `applyBlink` for a card lot) before `draw` or `drawLot`; the renderer
 * only uploads what the scene holds at that moment.
 */

/** Floats per instance: centre x, centre y, z, id + kind, w, d, atlas x, atlas y. */
export const INSTANCE_FLOATS = 8;
const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
const ATLAS_WIDTH = 1024;
const EMBLEM = 16;
const ID_GROUND = 1;

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aItem;   // centre x, centre y, z, id + kind (0 slice, .5 ground top, .25 emblem)
layout(location=2) in vec4 aRect;   // w, d, atlas x, atlas y
uniform vec2 uRot, uView, uCenter, uOrigin;
uniform float uDepth;
out vec2 vUV; flat out float vKind; flat out float vId; flat out vec4 vRect;
void main() {
  vec2 p = aItem.xy - uOrigin + (aCorner - 0.5) * aRect.xy;
  vec2 r = vec2(uRot.x * p.x - uRot.y * p.y, uRot.y * p.x + uRot.x * p.y);
  vec2 s = vec2(uCenter.x + r.x, uCenter.y + r.y * ${SQ.toFixed(2)} - aItem.z);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, -(0.8 * r.y + 0.6 * aItem.z) / uDepth, 1.0);
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

export interface GLRenderer {
  /** Builds the atlas, palette, shadow and emblem textures and the static instance buffer. May be called for both styles' scenes. */
  setScene(scene: Scene): void;
  resize(widthPx: number, heightPx: number): void;
  /** `hoverId` is a GL id (`buildingIndex + 2`) or 0; `artPx` is device pixels per art pixel, the outline width. */
  draw(scene: Scene, theta: number, view: View, opts: { hoverId: number; artPx: number; life: Float32Array | null }): void;
  /** One building on its lot plate, or one park, turning about the plate centre. Used by the Projects cards. */
  drawLot(scene: Scene, target: LotTarget, theta: number, view: View, opts: { life: Float32Array | null }): void;
  /** Deletes every GL object it created. `loseContext` also releases the context itself; only pass it for a canvas you will discard. */
  dispose(opts?: { loseContext?: boolean }): void;
}

/**
 * Converts life instances (cars, smoke, or anything else made of models) to the instance layout `draw`
 * and `drawLot` take: id 1, kind 0, every slice above the first also drawn half a cell lower. A model's
 * `z0` is NOT applied; `z` is its base height. The models' atlas origins are written by `setScene`, so call
 * this only after the scene has been given to a renderer.
 */
export function lifeInstanceData(list: LifeInstance[]): Float32Array {
  let n = 0;
  for (let i = 0; i < list.length; i++) n += list[i].model.H * 2 - 1;
  const out = new Float32Array(n * INSTANCE_FLOATS);
  let o = 0;
  /** One instance of slice `slice` of the model, drawn at height `z` above the instance's base. */
  const put = (li: LifeInstance, slice: number, z: number): void => {
    const m = li.model;
    out[o] = li.x;
    out[o + 1] = li.y;
    out[o + 2] = li.z + z;
    out[o + 3] = ID_GROUND;
    out[o + 4] = m.w;
    out[o + 5] = m.d;
    out[o + 6] = m.ax + slice * m.w;
    out[o + 7] = m.ay;
    o += INSTANCE_FLOATS;
  };
  for (let i = 0; i < list.length; i++) {
    const li = list[i];
    for (let z = 0; z < li.model.H; z++) {
      // The half step copy samples the same slice as the whole step one.
      if (z > 0) put(li, z, z - 0.5);
      put(li, z, z);
    }
  }
  return out;
}

interface PackedModel { sx: number[]; sy: number[] }

/** Shelf packing, deterministic for a given model order. Writes `ax` and `ay`; returns the atlas height. */
function packAtlas(models: Model[], out: PackedModel[]): number {
  let px = 0;
  let py = 0;
  let rowH = 0;
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (m.w > ATLAS_WIDTH) throw new Error('Repo city: a model is wider than the atlas');
    const sx: number[] = [];
    const sy: number[] = [];
    const whole = m.w * m.H;
    if (whole <= ATLAS_WIDTH) {
      if (px + whole > ATLAS_WIDTH) { px = 0; py += rowH; rowH = 0; }
      for (let z = 0; z < m.H; z++) { sx.push(px + z * m.w); sy.push(py); }
      px += whole;
      rowH = Math.max(rowH, m.d);
    } else {
      // Too wide for one row (a very large ground): each slice gets its own place on the shelves.
      for (let z = 0; z < m.H; z++) {
        if (px + m.w > ATLAS_WIDTH) { px = 0; py += rowH; rowH = 0; }
        sx.push(px);
        sy.push(py);
        px += m.w;
        rowH = Math.max(rowH, m.d);
      }
    }
    m.ax = sx[0];
    m.ay = sy[0];
    out.push({ sx, sy });
  }
  return py + rowH;
}

interface SceneRes {
  scene: Scene;
  vao: WebGLVertexArrayObject;
  vaos: Record<number, WebGLVertexArrayObject>;
  ib: WebGLBuffer;
  count: number;
  /** Per building index: first instance and instance count of its body. */
  bFirst: number[];
  bCount: number[];
  /** Index of the first emblem instance; building `i`'s emblem is `emb0 + i`. */
  emb0: number;
  depth: number;
  hoverInk: number[];
  atlas: WebGLTexture;
  pal: WebGLTexture;
  shadow: WebGLTexture;
  emb: WebGLTexture;
  palBytes: Uint8Array;
  palRows: number;
}

/**
 * Creates the renderer on `canvas`, or returns null when WebGL2 is missing or the shaders do not build
 * (the failure is logged once). Must be given a canvas that has no 2D context.
 */
export function createGLRenderer(canvas: HTMLCanvasElement): GLRenderer | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: true }) as WebGL2RenderingContext | null;
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;
  const g: WebGL2RenderingContext = gl;

  const shader = (type: number, text: string): WebGLShader => {
    const s = g.createShader(type);
    if (!s) throw new Error('could not create a shader');
    g.shaderSource(s, text);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
      const log = g.getShaderInfoLog(s);
      g.deleteShader(s);
      throw new Error(log || 'shader compile failed');
    }
    return s;
  };
  const program = (v: string, f: string): WebGLProgram => {
    const p = g.createProgram();
    if (!p) throw new Error('could not create a program');
    const vs = shader(g.VERTEX_SHADER, v);
    const fs = shader(g.FRAGMENT_SHADER, f);
    g.attachShader(p, vs);
    g.attachShader(p, fs);
    g.linkProgram(p);
    g.deleteShader(vs);
    g.deleteShader(fs);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) {
      const log = g.getProgramInfoLog(p);
      g.deleteProgram(p);
      throw new Error(log || 'program link failed');
    }
    return p;
  };

  let p1: WebGLProgram;
  let p2: WebGLProgram;
  try {
    p1 = program(VS, FS);
    try {
      p2 = program(VS2, FS2);
    } catch (e) {
      g.deleteProgram(p1);
      throw e;
    }
  } catch (e) {
    console.warn('[repo city] WebGL2 shaders failed, using the 2D fallback:', e instanceof Error ? e.message : e);
    return null;
  }

  const U1 = (n: string) => g.getUniformLocation(p1, n);
  const U2 = (n: string) => g.getUniformLocation(p2, n);
  g.useProgram(p1);
  g.uniform1i(U1('uAtlas'), 0);
  g.uniform1i(U1('uPal'), 1);
  g.uniform1i(U1('uShadow'), 2);
  g.uniform1i(U1('uEmb'), 4);
  g.useProgram(p2);
  g.uniform1i(U2('uScene'), 3);
  g.pixelStorei(g.UNPACK_ALIGNMENT, 1);

  const uRot = U1('uRot');
  const uView = U1('uView');
  const uCenter = U1('uCenter');
  const uOrigin = U1('uOrigin');
  const uDepth = U1('uDepth');
  const uTones = U1('uTones');
  const uHover = U2('uHover');
  const uK = U2('uK');
  const uHoverInk = U2('uHoverInk');

  const textures: WebGLTexture[] = [];
  const buffers: WebGLBuffer[] = [];
  const arrays: WebGLVertexArrayObject[] = [];

  const makeTexture = (
    unit: number, ifmt: number, w: number, h: number, fmt: number, data: ArrayBufferView | null,
  ): WebGLTexture => {
    const t = g.createTexture();
    if (!t) throw new Error('could not create a texture');
    textures.push(t);
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(g.TEXTURE_2D, t);
    g.texImage2D(g.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, g.UNSIGNED_BYTE, data);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return t;
  };
  const freeTexture = (t: WebGLTexture): void => {
    g.deleteTexture(t);
    const i = textures.indexOf(t);
    if (i >= 0) textures.splice(i, 1);
  };
  const makeBuffer = (): WebGLBuffer => {
    const b = g.createBuffer();
    if (!b) throw new Error('could not create a buffer');
    buffers.push(b);
    return b;
  };
  const makeVAO = (): WebGLVertexArrayObject => {
    const v = g.createVertexArray();
    if (!v) throw new Error('could not create a vertex array');
    arrays.push(v);
    return v;
  };

  const corner = makeBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, corner);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW);
  const emptyVAO = makeVAO();

  /** A vertex array over `buf` whose instanced attributes start `start` instances in (WebGL2 has no base instance). */
  const instVAO = (buf: WebGLBuffer, start: number): WebGLVertexArrayObject => {
    const vao = makeVAO();
    g.bindVertexArray(vao);
    g.bindBuffer(g.ARRAY_BUFFER, corner);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.enableVertexAttribArray(1);
    g.vertexAttribPointer(1, 4, g.FLOAT, false, INSTANCE_BYTES, start * INSTANCE_BYTES);
    g.vertexAttribDivisor(1, 1);
    g.enableVertexAttribArray(2);
    g.vertexAttribPointer(2, 4, g.FLOAT, false, INSTANCE_BYTES, start * INSTANCE_BYTES + 16);
    g.vertexAttribDivisor(2, 1);
    g.bindVertexArray(null);
    return vao;
  };

  // The dynamic buffer: life instances, and the plate or park of a lot.
  let lifeCap = 512;
  const lifeBuf = makeBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, lifeBuf);
  g.bufferData(g.ARRAY_BUFFER, lifeCap * INSTANCE_BYTES, g.DYNAMIC_DRAW);
  const lifeVAO = instVAO(lifeBuf, 0);

  const res: { maquette?: SceneRes; night?: SceneRes } = {};
  const fbo = g.createFramebuffer();
  let sceneTex: WebGLTexture | null = null;
  let depthRB: WebGLRenderbuffer | null = null;
  const tones = new Int32Array(16);
  g.depthFunc(g.LEQUAL);
  g.clearColor(0, 0, 0, 0);

  const freeScene = (r: SceneRes): void => {
    freeTexture(r.atlas);
    freeTexture(r.pal);
    freeTexture(r.shadow);
    freeTexture(r.emb);
    g.deleteBuffer(r.ib);
    const bi = buffers.indexOf(r.ib);
    if (bi >= 0) buffers.splice(bi, 1);
    const drop = (v: WebGLVertexArrayObject): void => {
      g.deleteVertexArray(v);
      const i = arrays.indexOf(v);
      if (i >= 0) arrays.splice(i, 1);
    };
    drop(r.vao);
    Object.keys(r.vaos).forEach((k) => drop(r.vaos[Number(k)]));
  };

  const setScene = (scene: Scene): void => {
    const old = res[scene.key];
    if (old) freeScene(old);

    // Pack order: ground, items, then every life model, the plate and the parks.
    const models: Model[] = [scene.ground];
    scene.items.forEach((it) => models.push(it.model));
    const lifeStart = models.length;
    scene.cars.forEach((c) => c.forEach((o) => o.forEach((m) => models.push(m))));
    scene.puffs.forEach((m) => models.push(m));
    models.push(scene.plate);
    scene.parks.forEach((m) => models.push(m));
    const packed: PackedModel[] = [];
    const AH = packAtlas(models, packed);
    for (let i = lifeStart; i < models.length; i++) {
      // A life model's slices are addressed from `ax`, so each must sit in one row.
      if (models[i].w * models[i].H > ATLAS_WIDTH) throw new Error('Repo city: a life model is wider than the atlas');
    }

    const data = new Uint8Array(ATLAS_WIDTH * AH * 2);
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const pk = packed[i];
      for (let z = 0; z < m.H; z++) {
        for (let y = 0; y < m.d; y++) {
          for (let x = 0; x < m.w; x++) {
            const c = (z * m.d + y) * m.w + x;
            const o = ((pk.sy[z] + y) * ATLAS_WIDTH + pk.sx[z] + x) * 2;
            data[o] = m.mat[c];
            data[o + 1] = m.mask[c];
          }
        }
      }
    }

    const inst: number[] = [];
    const bFirst: number[] = [];
    const bCount: number[] = [];
    const addBody = (m: Model, x: number, y: number, id: number, pk: PackedModel): void => {
      for (let z = 0; z < m.H; z++) {
        const top = m.isGround && z === m.H - 1 ? 0.5 : 0;
        // Without the half step copy, one cell wide features (antennas, trunks) render as dotted lines.
        if (z > 0) inst.push(x, y, z + m.z0 - 0.5, id, m.w, m.d, pk.sx[z], pk.sy[z]);
        inst.push(x, y, z + m.z0, id + top, m.w, m.d, pk.sx[z], pk.sy[z]);
      }
    };
    addBody(scene.ground, 0, 0, ID_GROUND, packed[0]);
    let b = 0;
    scene.items.forEach((it, i) => {
      const first = inst.length / INSTANCE_FLOATS;
      addBody(it.model, it.x, it.y, it.repo ? 2 + b : ID_GROUND, packed[1 + i]);
      if (it.repo) {
        bFirst[b] = first;
        bCount[b] = inst.length / INSTANCE_FLOATS - first;
        b++;
      }
    });

    const nb = scene.buildings.length;
    const emb0 = inst.length / INSTANCE_FLOATS;
    const emb = new Uint8Array(EMBLEM * EMBLEM * Math.max(1, nb) * 4);
    scene.buildings.forEach((it, i) => {
      for (let y = 0; y < EMBLEM; y++) {
        emb.set(scene.emblems[i].subarray(y * EMBLEM * 4, (y + 1) * EMBLEM * 4), (y * EMBLEM * nb + i * EMBLEM) * 4);
      }
      // A building with no roof keeps its slot (so indices line up) as a zero sized quad.
      const s = it.roof ? 8 : 0;
      inst.push(it.roof ? it.roof.x : 0, it.roof ? it.roof.y : 0, it.roof ? it.roof.z : 0, i + 2 + 0.25, s, s, i * EMBLEM, 0);
    });

    const ib = makeBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, ib);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array(inst), g.STATIC_DRAW);
    const palBytes = new Uint8Array(scene.colors.buffer, scene.colors.byteOffset, scene.colors.byteLength);
    const palRows = scene.colors.length / 4;
    const diag = Math.hypot(scene.GW, scene.GD);
    res[scene.key] = {
      scene,
      vao: instVAO(ib, 0),
      vaos: {},
      ib,
      count: inst.length / INSTANCE_FLOATS,
      bFirst,
      bCount,
      emb0,
      depth: Math.max(400, diag + scene.maxTop),
      hoverInk: hex(scene.style.hoverInk).map((v) => v / 255),
      atlas: makeTexture(0, g.RG8, ATLAS_WIDTH, AH, g.RG, data),
      pal: makeTexture(1, g.RGBA8, 4, palRows, g.RGBA, palBytes),
      shadow: makeTexture(2, g.R8, scene.GW, scene.GD, g.RED, scene.shadowMask),
      emb: makeTexture(4, g.RGBA8, EMBLEM * Math.max(1, nb), EMBLEM, g.RGBA, emb),
      palBytes,
      palRows,
    };
  };

  const resFor = (scene: Scene): SceneRes => {
    let r = res[scene.key];
    if (!r || r.scene !== scene) {
      setScene(scene);
      r = res[scene.key] as SceneRes;
    }
    return r;
  };

  const vaoAt = (r: SceneRes, start: number): WebGLVertexArrayObject => {
    let v = r.vaos[start];
    if (!v) {
      v = instVAO(r.ib, start);
      r.vaos[start] = v;
    }
    return v;
  };

  /** Binds the scene target and uploads what changes per frame: the palette (beacons blink) and the shadows. */
  const begin = (r: SceneRes, theta: number, view: View, ox: number, oy: number, withShadow: boolean): void => {
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.viewport(0, 0, canvas.width, canvas.height);
    g.enable(g.DEPTH_TEST);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.useProgram(p1);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, r.atlas);
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, r.pal);
    g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, 4, r.palRows, g.RGBA, g.UNSIGNED_BYTE, r.palBytes);
    g.activeTexture(g.TEXTURE2);
    g.bindTexture(g.TEXTURE_2D, r.shadow);
    if (withShadow) g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, r.scene.GW, r.scene.GD, g.RED, g.UNSIGNED_BYTE, r.scene.shadowMask);
    g.activeTexture(g.TEXTURE4);
    g.bindTexture(g.TEXTURE_2D, r.emb);
    g.uniform2f(uRot, Math.cos(theta), Math.sin(theta));
    g.uniform2f(uView, view.BW, view.BH);
    g.uniform2f(uCenter, view.cx, view.cy);
    g.uniform2f(uOrigin, ox, oy);
    g.uniform1f(uDepth, r.depth);
    g.uniform1iv(uTones, tones);
  };

  const drawLife = (data: Float32Array | null): void => {
    if (!data || data.length === 0) return;
    const n = data.length / INSTANCE_FLOATS;
    g.bindBuffer(g.ARRAY_BUFFER, lifeBuf);
    if (n > lifeCap) {
      while (lifeCap < n) lifeCap *= 2;
      g.bufferData(g.ARRAY_BUFFER, lifeCap * INSTANCE_BYTES, g.DYNAMIC_DRAW);
    }
    g.bufferSubData(g.ARRAY_BUFFER, 0, data);
    g.bindVertexArray(lifeVAO);
    g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, n);
  };

  /** The second pass: copies the scene target to the canvas, inking the hover outline. */
  const finish = (hoverId: number, artPx: number, ink: number[]): void => {
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, canvas.width, canvas.height);
    g.disable(g.DEPTH_TEST);
    g.clear(g.COLOR_BUFFER_BIT);
    g.useProgram(p2);
    g.activeTexture(g.TEXTURE3);
    g.bindTexture(g.TEXTURE_2D, sceneTex);
    g.uniform1i(uHover, hoverId);
    g.uniform1i(uK, artPx);
    g.uniform3f(uHoverInk, ink[0], ink[1], ink[2]);
    g.bindVertexArray(emptyVAO);
    g.drawArrays(g.TRIANGLES, 0, 3);
  };

  return {
    setScene,
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
      if (sceneTex) freeTexture(sceneTex);
      if (depthRB) g.deleteRenderbuffer(depthRB);
      sceneTex = makeTexture(3, g.RGBA8, w, h, g.RGBA, null);
      depthRB = g.createRenderbuffer();
      g.bindRenderbuffer(g.RENDERBUFFER, depthRB);
      g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT24, w, h);
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, sceneTex, 0);
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, depthRB);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    },
    draw(scene, theta, view, opts) {
      const r = resFor(scene);
      tones.set(scene.tones);
      begin(r, theta, view, 0, 0, true);
      g.bindVertexArray(r.vao);
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, r.count);
      drawLife(opts.life);
      finish(opts.hoverId, Math.max(1, Math.round(opts.artPx)), r.hoverInk);
    },
    drawLot(scene, target, theta, view, opts) {
      const r = resFor(scene);
      const it = target.kind === 'building' ? scene.buildings[target.index] : null;
      tones.set(faceTones(theta));
      begin(r, theta, view, it ? it.x : 0, it ? it.y : 0, false);
      // The plate (or park) goes first through the dynamic buffer at z = -2, which is its z0, so it is not applied again.
      const base: Model = it ? scene.plate : scene.parks[target.kind === 'park' ? target.park : 0];
      drawLife(lifeInstanceData([{ model: base, x: it ? it.x : 0, y: it ? it.y : 0, z: base.z0 }]));
      if (it && target.kind === 'building') {
        g.bindVertexArray(vaoAt(r, r.bFirst[target.index]));
        g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, r.bCount[target.index]);
        g.bindVertexArray(vaoAt(r, r.emb0 + target.index));
        g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, 1);
      }
      drawLife(opts.life);
      finish(0, 1, r.hoverInk);
    },
    dispose(opts) {
      (['maquette', 'night'] as const).forEach((k) => {
        const r = res[k];
        if (r) freeScene(r);
        res[k] = undefined;
      });
      if (sceneTex) freeTexture(sceneTex);
      sceneTex = null;
      if (depthRB) g.deleteRenderbuffer(depthRB);
      depthRB = null;
      if (fbo) g.deleteFramebuffer(fbo);
      textures.forEach((t) => g.deleteTexture(t));
      textures.length = 0;
      arrays.forEach((v) => g.deleteVertexArray(v));
      arrays.length = 0;
      buffers.forEach((b) => g.deleteBuffer(b));
      buffers.length = 0;
      g.deleteProgram(p1);
      g.deleteProgram(p2);
      if (opts && opts.loseContext) {
        const ext = g.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    },
  };
}
