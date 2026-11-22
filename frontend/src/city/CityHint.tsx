import React, { useEffect, useRef, useState } from 'react';
import './CityHint.css';
import { currentStyle, isTouchDevice, observeTheme, prefersReducedMotion } from './env';
import { StyleKey } from './types';

/**
 * Four pixel vignettes under the city. They tell a visitor what hovering, clicking (or tapping), height
 * and lit windows mean, and they must describe exactly what RepoCity does. Each one is a pure function of
 * a step `t` from 0 to 31 on the same 8 ticks per second clock as the cars.
 */

interface Palette {
  ink: string; paper: string; wall: string; side: string; roof: string; rim: string | null;
  wallB: string; sideB: string; roofB: string; rimB: string | null;
  win: string; lit: string; ground: string; spark: string; muted: string;
}

const HINT_PAL: Record<StyleKey, Palette> = {
  maquette: {
    ink: '#1a2419', paper: '#f0efeb', wall: '#588157', side: '#3a5a40', roof: '#a3b18a', rim: null,
    wallB: '#c9c2ad', sideB: '#a39c85', roofB: '#f0efeb', rimB: null,
    win: '#344e41', lit: '#f6d98b', ground: '#b6b09c', spark: '#1a2419', muted: '#4d6650',
  },
  night: {
    ink: '#f0efeb', paper: '#1a2419', wall: '#30403a', side: '#1f2b24', roof: '#3d4f40', rim: '#4da3ff',
    wallB: '#33392b', sideB: '#22271d', roofB: '#454d3a', rimB: '#ffa24d',
    win: '#121a14', lit: '#ffd98a', ground: '#3d4f40', spark: '#ffd98a', muted: '#a3b18a',
  },
};

const ARROW = ['X.......', 'XX......', 'XoX.....', 'XooX....', 'XoooX...', 'XooooX..', 'XoooooX.', 'XooooXXX', 'XoXoX...', 'XX.XoX..', 'X..XoX..', '....XX..'];
const HAND = [
  '....XX.......', '...XooX......', '...XooX......', '...XooX......', '...XooXXX....', '...XooXooXXX.', 'XX.XooXooXooX',
  'XoXXooooooooX', 'XooXooooooooX', '.XooooooooooX', '.XooooooooooX', '..XooooooooX.', '..XooooooooX.', '...XXXXXXXX..',
];
const OPEN = ['XXXX..XXX', 'X......XX', 'X.....X.X', 'X....X...', 'X...X...X', 'X.......X', 'X.......X', 'X.......X', 'XXXXXXXXX'];

type Ctx = CanvasRenderingContext2D;

function sprite(ctx: Ctx, map: string[], x: number, y: number, ink: string, fill: string): void {
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      ctx.fillStyle = row[i] === 'X' ? ink : fill;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}

interface TowerOpts { alt?: boolean; outline?: boolean; lit?: (row: number, col: number) => boolean }

function tower(ctx: Ctx, P: Palette, x: number, base: number, w: number, h: number, o: TowerOpts): void {
  const top = base - h;
  const wall = o.alt ? P.wallB : P.wall;
  const side = o.alt ? P.sideB : P.side;
  const roof = o.alt ? P.roofB : P.roof;
  const rim = o.alt ? P.rimB : P.rim;
  const shape = (dx: number, dy: number, solid: string | null): void => {
    ctx.fillStyle = solid || wall;
    ctx.fillRect(x + dx, top + dy, w, h);
    ctx.fillStyle = solid || side;
    for (let j = 1; j <= 3; j++) ctx.fillRect(x + w - 1 + j + dx, top - j + dy, 1, h);
    ctx.fillStyle = solid || roof;
    for (let i = 1; i <= 3; i++) ctx.fillRect(x + i + dx, top - i + dy, w, 1);
  };
  if (o.outline) {
    const around = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let i = 0; i < around.length; i++) shape(around[i][0], around[i][1], P.ink);
  }
  shape(0, 0, null);
  if (rim) {
    ctx.fillStyle = rim;
    ctx.fillRect(x, top, w, 1);
    for (let j = 1; j <= 3; j++) ctx.fillRect(x + w - 1 + j, top - j, 1, 1);
  }
  for (let r = 0, y = base - 3; y >= top + 1; r++, y -= 3) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = o.lit && o.lit(r, c) ? P.lit : P.win;
      ctx.fillRect(x + (c ? w - 3 : 1), y, 2, 2);
    }
  }
}

const ground = (ctx: Ctx, P: Palette): void => {
  ctx.fillStyle = P.ground;
  ctx.fillRect(3, 26, 38, 1);
};
const lerp = (a: number, b: number, k: number): number => Math.round(a + (b - a) * k);

/** The name tag shared by the first two vignettes. */
const tag = (ctx: Ctx, P: Palette): void => {
  ctx.fillStyle = P.ink;
  ctx.fillRect(8, 1, 20, 7);
  ctx.fillRect(18, 8, 1, 2);
  ctx.fillStyle = P.paper;
  ctx.fillRect(9, 2, 18, 5);
  ctx.fillStyle = P.ink;
  ctx.fillRect(11, 4, 5, 1);
  ctx.fillStyle = P.muted;
  ctx.fillRect(18, 4, 3, 1);
  ctx.fillRect(22, 4, 3, 1);
};

/** A one pixel ring around the fingertip. */
const ripple = (ctx: Ctx, P: Palette, cx: number, cy: number, r: number): void => {
  ctx.fillStyle = P.spark;
  for (let a = 0; a < 24; a++) {
    const an = (a / 24) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r * 0.7), 1, 1);
  }
};

const LIT = (r: number, c: number): boolean => (r + c) % 2 === 0;

interface Hint {
  text: [string, string];
  touch?: [string, string];
  /** The step drawn when motion is reduced. */
  still: number;
  draw(ctx: Ctx, P: Palette, t: number, touch: boolean): void;
}

const HINTS: Hint[] = [
  {
    text: ['Hover', 'names the repo'], touch: ['Tap', 'names the repo'], still: 14,
    draw(ctx, P, t, touch) {
      ground(ctx, P);
      if (touch) {
        // A finger comes in, taps once, the name tag pops, the finger leaves.
        const on = t >= 8 && t < 27;
        const down = t >= 6 && t < 9;
        const k = t < 6 ? t / 6 : t < 12 ? 1 : Math.max(0, 1 - (t - 12) / 6);
        tower(ctx, P, 14, 26, 8, 13, { outline: on, lit: LIT });
        if (on) tag(ctx, P);
        if (t >= 6 && t < 10) ripple(ctx, P, 19.5, 18, 3 + (t - 6) * 2);
        if (t < 18) sprite(ctx, HAND, lerp(30, 15, k), lerp(31, 17, k) + (down ? 1 : 0), P.ink, P.paper);
        return;
      }
      const on = t >= 8 && t < 24;
      const k = t < 8 ? t / 8 : t < 24 ? 1 : 1 - (t - 24) / 8;
      tower(ctx, P, 14, 26, 8, 13, { outline: on, lit: LIT });
      if (on) tag(ctx, P);
      sprite(ctx, ARROW, lerp(37, 19, k), lerp(27, 17, k), P.ink, P.paper);
    },
  },
  {
    text: ['Click', 'opens it on GitHub'], touch: ['Tap again', 'opens it on GitHub'], still: 16,
    draw(ctx, P, t, touch) {
      const down = t >= 8 && t < 11;
      ground(ctx, P);
      tower(ctx, P, 14, 26, 8, 13, { outline: true, lit: LIT });
      if (touch) {
        // The tag from the first tap is still up; the second tap opens the repo.
        tag(ctx, P);
        if (t >= 8 && t < 12) ripple(ctx, P, 19.5, 18, 3 + (t - 8) * 2);
      } else if (down) {
        ctx.fillStyle = P.spark;
        ctx.fillRect(19, 12, 2, 3);
        ctx.fillRect(16, 15, 1, 1);
        ctx.fillRect(15, 14, 1, 1);
        ctx.fillRect(23, 15, 1, 1);
        ctx.fillRect(24, 14, 1, 1);
      }
      if (t >= 11 && t < 28) sprite(ctx, OPEN, 30, (touch ? 14 : 9) - Math.min(4, t - 11), P.ink, P.paper);
      sprite(ctx, HAND, 15, 17 + (down ? 1 : 0), P.ink, P.paper);
    },
  },
  {
    text: ['Taller', 'more code'], still: 31,
    draw(ctx, P, t) {
      ground(ctx, P);
      tower(ctx, P, 4, 26, 7, 5, { alt: true });
      tower(ctx, P, 16, 26, 7, 10, { alt: true });
      tower(ctx, P, 28, 26, 7, 11 + Math.min(6, Math.floor(t / 4)), {});
    },
  },
  {
    text: ['Lit windows', 'pushed lately'], still: 31,
    draw(ctx, P, t) {
      const n = Math.floor(t / 3);
      ground(ctx, P);
      tower(ctx, P, 7, 26, 8, 12, { alt: true });
      tower(ctx, P, 24, 26, 8, 15, { lit: (r, c) => r * 2 + c < n });
    },
  },
];

const CLOCK_MS = 125;

/** The row of four vignettes. Mouse devices and touch devices get their own wording for the first two. */
const CityHint: React.FC = () => {
  const [touch] = useState<boolean>(() => isTouchDevice());
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const ctxs: Array<Ctx | null> = HINTS.map((_, i) => {
      const cv = canvases.current[i];
      return cv ? cv.getContext('2d') : null;
    });
    // No 2D context (jsdom): the markup is the whole hint.
    if (!ctxs[0]) return undefined;
    const reduce = prefersReducedMotion();
    let seen = true;
    let lastKey = '';
    let raf = 0;

    const draw = (now: number): void => {
      const style = currentStyle();
      const tick = Math.floor(now / CLOCK_MS);
      const key = style + ':' + (reduce ? 0 : tick);
      if (key === lastKey) return;
      lastKey = key;
      const P = HINT_PAL[style];
      HINTS.forEach((h, i) => {
        const ctx = ctxs[i];
        if (!ctx) return;
        ctx.clearRect(0, 0, 44, 30);
        h.draw(ctx, P, reduce ? h.still : (tick + i * 8) % 32, touch);
      });
    };
    const wants = (): boolean => seen && document.visibilityState === 'visible';
    const frame = (now: number): void => {
      raf = 0;
      if (!wants()) return;
      draw(now);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const start = (): void => {
      if (!raf && wants()) raf = requestAnimationFrame(frame);
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((entries) => {
        seen = entries[entries.length - 1].isIntersecting;
        start();
      });
      io.observe(list);
    }
    const unobserveTheme = observeTheme(() => { lastKey = ''; start(); });
    document.addEventListener('visibilitychange', start);
    start();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      unobserveTheme();
      document.removeEventListener('visibilitychange', start);
    };
  }, [touch]);

  return (
    <ul className="repo-city-hint" ref={listRef}>
      {HINTS.map((h, i) => {
        const text = touch && h.touch ? h.touch : h.text;
        return (
          <li key={h.text[0]}>
            <canvas
              width={44}
              height={30}
              aria-hidden="true"
              ref={(el) => { canvases.current[i] = el; }}
            />
            <div>{text[0]}<span>{text[1]}</span></div>
          </li>
        );
      })}
    </ul>
  );
};

export default CityHint;
