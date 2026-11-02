/**
 * The scrolling scene behind the stacks: Melbourne at dusk, in 8-bit pixels
 * (one world unit per art pixel, the same grain as Pam). Far to near: a sky
 * in stepped colour bands with stars, the city skyline (Rialto, Eureka Tower,
 * Flinders Street Station, St Paul's Cathedral, the Arts Centre spire), a row
 * of terrace roofs with chimney smoke, faint haze, and the street with its
 * tram tracks and a passing W-class tram. Pure layout builders (unit-tested,
 * seeded, never the game rng) plus a class that pre-renders the static tiles
 * per resize and draws the parallax layers each frame. Scrolling layers derive
 * their position from the renderer's scroll distance, so pausing and reduced
 * motion freeze them for free. Nothing blinks: window lights only drift slowly
 * in brightness (the owner found hard on/off lights made a skyline look like
 * it was dropping in and out).
 */
import { seededRng } from '../game/rng';
import type { WorldFit } from './sizing';

export type Landmark = 'block' | 'rialto' | 'eureka' | 'station' | 'stpauls' | 'artscentre';

/** One skyline shape: `h` is its tallest point above the ground line, in world units. */
export interface Building {
  kind: Landmark;
  x: number;
  w: number;
  h: number;
}

/** A lit window: tile coordinates in world units, plus its slow brightness drift. */
export interface WindowLight {
  x: number;
  y: number;
  /** Drift phase (0..1) and period in seconds. */
  phase: number;
  period: number;
}

export interface Terrace {
  x: number;
  w: number;
  /** Roof height above the ground line. */
  h: number;
  gable: boolean;
  /** Chimney offset from `x`, or null for none. */
  chimney: number | null;
  smoke: boolean;
}

export interface HazeSpot {
  x: number;
  y: number;
}

export const SKYLINE_TILE_W = 240;
export const ROOFS_TILE_W = 480;
export const GROUND_TILE_W = 48;
/** Scroll distance between two passes of the tram, and its speed against the street. */
export const TRAM_LOOP = 1600;
export const TRAM_SPEED = 1.4;
export const TRAM_W = 46;
export const TRAM_H = 16;
export const LIGHT_MIN = 0.35;
export const LIGHT_MAX = 0.65;
export const LIGHT_PERIOD_MIN = 5;
export const LIGHT_PERIOD_MAX = 9;

/** Scene palette: dusk-tinted silhouettes, dim lights, nothing as bright as Pam's yellow. */
const P = {
  far: '#121127',
  farEdge: '#1f1d3a',
  glass: '#18203c',
  glassEdge: '#28345c',
  gold: '#8e7032',
  goldDark: '#6a5226',
  red: '#6a2832',
  station: '#2c2030',
  stationLit: '#432c36',
  arch: '#6e5236',
  dome: '#1d3836',
  domeLit: '#2e5450',
  clock: '#c8b88a',
  stone: '#302c48',
  stoneLit: '#4c4770',
  spire: '#3b3566',
  spireLit: '#6a5fb0',
  tip: '#e0dcc8',
  window: '#d4a050',
  star: '#5d5a86',
  starBright: '#b0abd6',
  moon: '#d9d3b6',
  roof: '#0c0b18',
  roofEdge: '#24203a',
  chimney: '#16132a',
  smoke: '#4a4668',
  haze: '#221f38',
  road: '#17161f',
  kerb: '#4a4a5e',
  kerbJoint: '#2e2e3c',
  kerbLine: '#9c9ab2',
  gutter: '#0e0d16',
  rail: '#7a7a8e',
  railShadow: '#2a2a38',
  pitcher: '#22212e',
  tramGreen: '#2f5a3e',
  tramGreenDark: '#24452f',
  tramCream: '#c9b27a',
  tramGold: '#7a5a2a',
  tramRoof: '#3c4a3c',
  tramWindow: '#141824',
  tramWindowLit: '#8a6a3a',
  tramUnder: '#151520',
  tramWheel: '#3a3a46',
};

/**
 * The 240-wide skyline, left to right. Shapes may overlap; later ones draw in
 * front. Heights stay well under the play band's upper half.
 */
export const SKYLINE: readonly Building[] = [
  { kind: 'block', x: 0, w: 14, h: 46 },
  { kind: 'rialto', x: 16, w: 22, h: 88 },
  { kind: 'eureka', x: 42, w: 14, h: 118 },
  { kind: 'block', x: 58, w: 13, h: 64 },
  { kind: 'station', x: 64, w: 88, h: 58 },
  { kind: 'stpauls', x: 154, w: 32, h: 76 },
  { kind: 'artscentre', x: 190, w: 24, h: 110 },
  { kind: 'block', x: 214, w: 12, h: 54 },
  { kind: 'block', x: 227, w: 13, h: 72 },
];

/** Lit windows on the plain towers (2×2 windows on a 4×5 grid), seeded. */
export function buildWindows(seed: number, groundY: number): WindowLight[] {
  const rng = seededRng(seed);
  const lights: WindowLight[] = [];
  for (const b of SKYLINE) {
    if (b.kind !== 'block' && b.kind !== 'rialto' && b.kind !== 'eureka') continue;
    const top = groundY - b.h + (b.kind === 'eureka' ? 18 : b.kind === 'rialto' ? 10 : 4);
    for (let y = top; y + 2 <= groundY - 4; y += 5) {
      for (let x = b.x + 2; x + 2 <= b.x + b.w - 2; x += 4) {
        if (rng() >= 0.3) continue;
        lights.push({
          x,
          y,
          phase: rng(),
          period: LIGHT_PERIOD_MIN + rng() * (LIGHT_PERIOD_MAX - LIGHT_PERIOD_MIN),
        });
      }
    }
  }
  return lights;
}

/** Steady glow with a slow drift: never off, never a step. */
export function lightLevel(now: number, light: WindowLight, reduced = false): number {
  if (reduced) return (LIGHT_MIN + LIGHT_MAX) / 2;
  const wave = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (now / 1000 / light.period + light.phase));
  return LIGHT_MIN + (LIGHT_MAX - LIGHT_MIN) * wave;
}

/** A 480-wide row of terrace roofs standing on the ground line. */
export function buildTerraces(seed: number): Terrace[] {
  const rng = seededRng(seed);
  const row: Terrace[] = [];
  let x = 0;
  while (x < ROOFS_TILE_W - 12) {
    const w = Math.min(12 + Math.floor(rng() * 9), ROOFS_TILE_W - x); // 12..20
    const h = 10 + Math.floor(rng() * 13); // 10..22
    const hasChimney = rng() < 0.55;
    row.push({
      x,
      w,
      h,
      gable: rng() < 0.4,
      chimney: hasChimney ? 2 + Math.floor(rng() * (w - 6)) : null,
      smoke: hasChimney && rng() < 0.5,
    });
    x += w;
  }
  return row;
}

/** Faint haze specks in a 240-wide tile, clear of the ground. */
export function buildHaze(seed: number, count = 14): HazeSpot[] {
  const rng = seededRng(seed);
  const spots: HazeSpot[] = [];
  for (let i = 0; i < count; i++) {
    spots.push({ x: (i + rng() * 0.8) * (SKYLINE_TILE_W / count), y: 12 + rng() * 230 });
  }
  return spots;
}

/** Where the tram's left edge is (world x) at a scroll distance; off screen most of the time. */
export function tramX(scrollX: number, worldW: number): number {
  const p = (scrollX * TRAM_SPEED + 260) % TRAM_LOOP;
  return worldW + 40 - p;
}

/** Phase of day: top, middle and horizon colours (all dark; the glow sits low). */
export interface SkyPhase {
  name: string;
  top: string;
  mid: string;
  glow: string;
  stars: boolean;
  moon: boolean;
}
export const SKY_PHASES: readonly SkyPhase[] = [
  { name: 'dusk', top: '#141230', mid: '#2a1d45', glow: '#7a3a4c', stars: true, moon: false },
  { name: 'night', top: '#0b0b1c', mid: '#14152c', glow: '#2a2440', stars: true, moon: true },
  { name: 'dawn', top: '#16183a', mid: '#24223f', glow: '#8a5048', stars: false, moon: false },
  { name: 'day', top: '#17213c', mid: '#1e2944', glow: '#4a5070', stars: false, moon: false },
];

export function skyPhaseAt(score: number): number {
  return Math.floor(score / 10) % SKY_PHASES.length;
}

/** `a` blended toward `b` by `t` (0..1), as #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** The sky's stepped bands: start (fraction of the ground line) and colour, top to bottom. */
export function skyBands(phase: SkyPhase): { from: number; colour: string }[] {
  return [
    { from: 0, colour: phase.top },
    { from: 0.28, colour: mixHex(phase.top, phase.mid, 0.5) },
    { from: 0.48, colour: phase.mid },
    { from: 0.68, colour: mixHex(phase.mid, phase.glow, 0.33) },
    { from: 0.8, colour: mixHex(phase.mid, phase.glow, 0.66) },
    { from: 0.9, colour: phase.glow },
  ];
}

type Rect = (x: number, y: number, w: number, h: number, colour: string) => void;

export class Backdrop {
  private fit: WorldFit | null = null;
  private skies: HTMLCanvasElement[] = [];
  private skylineTile: HTMLCanvasElement | null = null;
  private roofsTile: HTMLCanvasElement | null = null;
  private groundTile: HTMLCanvasElement | null = null;
  private tram: HTMLCanvasElement | null = null;
  readonly windows: WindowLight[];
  readonly terraces: Terrace[];
  readonly haze: HazeSpot[];
  private readonly stars: { x: number; y: number; bright: boolean }[];

  constructor(
    private readonly worldW: number,
    private readonly worldH: number,
    private readonly groundY: number,
  ) {
    this.windows = buildWindows(7, groundY);
    this.terraces = buildTerraces(11);
    this.haze = buildHaze(3);
    const rng = seededRng(5);
    this.stars = Array.from({ length: 36 }, () => ({
      x: Math.floor(rng() * worldW),
      y: 4 + Math.floor(rng() * 130),
      bright: rng() < 0.2,
    }));
  }

  /** Re-renders every static tile for a new canvas size. */
  resize(fit: WorldFit): void {
    this.fit = fit;
    const s = fit.scale;
    this.skies = SKY_PHASES.map((p) => this.makeSky(p, s));
    this.skylineTile = this.makeSkyline(s);
    this.roofsTile = this.makeRoofs(s);
    this.groundTile = this.makeGround(s);
    this.tram = this.makeTram(s);
  }

  private X(x: number): number {
    return this.fit!.offsetX + Math.round(x * this.fit!.scale);
  }

  private Y(y: number): number {
    return this.fit!.offsetY + Math.round(y * this.fit!.scale);
  }

  /** A tile canvas of `w × h` world units at scale `s`, drawn through a rect helper. */
  private tile(w: number, h: number, s: number, draw: (rect: Rect) => void): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const ctx = c.getContext('2d');
    if (ctx) {
      const rect: Rect = (x, y, rw, rh, colour) => {
        const x0 = Math.round(x * s);
        const y0 = Math.round(y * s);
        ctx.fillStyle = colour;
        ctx.fillRect(x0, y0, Math.round((x + rw) * s) - x0, Math.round((y + rh) * s) - y0);
      };
      draw(rect);
    }
    return c;
  }

  /** Stepped bands with a two-row checker dither at each step, then stars and the moon. */
  private makeSky(phase: SkyPhase, s: number): HTMLCanvasElement {
    return this.tile(this.worldW, this.worldH, s, (rect) => {
      const bands = skyBands(phase);
      bands.forEach((band, i) => {
        const y0 = Math.round(band.from * this.groundY);
        const y1 = i + 1 < bands.length ? Math.round(bands[i + 1]!.from * this.groundY) : this.worldH;
        rect(0, y0, this.worldW, y1 - y0, band.colour);
        if (i > 0) {
          const prev = bands[i - 1]!.colour;
          for (let y = y0; y < y0 + 2; y++) for (let x = (y - y0) % 2; x < this.worldW; x += 2) rect(x, y, 1, 1, prev);
        }
      });
      if (phase.stars) for (const st of this.stars) rect(st.x, st.y, 1, 1, st.bright ? P.starBright : P.star);
      if (phase.moon) {
        // A crescent: a disc with an offset disc of sky taken out of it.
        const [cx, cy, r] = [196, 34, 8];
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            const inMoon = x * x + y * y <= r * r;
            const inBite = (x - 4) * (x - 4) + (y + 2) * (y + 2) <= (r - 1) * (r - 1);
            if (inMoon && !inBite) rect(cx + x, cy + y, 1, 1, P.moon);
          }
        }
      }
    });
  }

  private makeSkyline(s: number): HTMLCanvasElement {
    const G = this.groundY;
    return this.tile(SKYLINE_TILE_W, G, s, (rect) => {
      for (const b of SKYLINE) {
        const top = G - b.h;
        switch (b.kind) {
          case 'block':
            rect(b.x, top, b.w, b.h, P.far);
            rect(b.x, top, b.w, 1, P.farEdge);
            rect(b.x, top, 1, b.h, P.farEdge);
            if (b.h > 60) rect(b.x + (b.w >> 1), top - 5, 1, 5, P.farEdge);
            break;
          case 'rialto': {
            // Two blue-glass towers with stepped crowns.
            const tower = (x: number, w: number, h: number): void => {
              const t = G - h;
              rect(x, t + 6, w, h - 6, P.glass);
              rect(x + 1, t + 3, w - 2, 3, P.glass);
              rect(x + 3, t, w - 6, 3, P.glass);
              rect(x, t + 6, 1, h - 6, P.glassEdge);
              rect(x + 3, t, 1, 3, P.glassEdge);
            };
            tower(b.x, 12, b.h);
            tower(b.x + 12, 10, b.h - 8);
            break;
          }
          case 'eureka':
            // Dark glass shaft under the gold crown, with the red stripe.
            rect(b.x, top + 14, b.w, b.h - 14, P.far);
            rect(b.x, top + 14, 1, b.h - 14, P.farEdge);
            rect(b.x + 1, top, b.w - 2, 2, P.gold);
            rect(b.x, top + 2, b.w, 12, P.gold);
            for (let y = top + 4; y < top + 14; y += 3) rect(b.x, y, b.w, 1, P.goldDark);
            rect(b.x + 10, top + 4, 2, 52, P.red);
            break;
          case 'station': {
            // Flinders Street Station: clock tower, arched facade, green dome.
            const x0 = b.x;
            const tt = G - b.h;
            rect(x0 + 2, tt + 6, 10, b.h - 6, P.station);
            rect(x0 + 3, tt + 3, 8, 3, P.stationLit);
            rect(x0 + 5, tt, 4, 3, P.stationLit);
            rect(x0 + 6, tt - 4, 1, 4, P.stationLit);
            rect(x0 + 5, tt + 10, 4, 4, P.clock);
            rect(x0 + 6, tt + 11, 1, 2, P.station);
            rect(x0 + 7, tt + 12, 1, 1, P.station);
            rect(x0 + 2, tt + 6, 1, b.h - 6, P.stationLit);
            rect(x0 + 12, G - 30, 76, 30, P.station);
            rect(x0 + 12, G - 30, 76, 1, P.stationLit);
            for (let ax = x0 + 15; ax + 3 <= x0 + 86; ax += 6) {
              rect(ax, G - 24, 3, 6, P.arch);
              rect(ax + 1, G - 25, 1, 1, P.arch);
            }
            for (let ax = x0 + 18; ax + 4 <= x0 + 86; ax += 12) rect(ax, G - 12, 4, 8, P.arch);
            // Dome on its drum, lantern and finial.
            const cx = x0 + 44;
            rect(cx - 10, G - 40, 20, 10, P.stationLit);
            for (let wx = cx - 7; wx < cx + 8; wx += 5) rect(wx, G - 37, 2, 4, P.arch);
            const r = 10;
            for (let dy = 0; dy < r; dy++) {
              const half = Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)));
              rect(cx - half, G - 41 - dy, 2 * half, 1, P.dome);
              rect(cx - half, G - 41 - dy, 2, 1, P.domeLit);
            }
            rect(cx - 2, G - 41 - r - 3, 4, 3, P.stationLit);
            rect(cx, G - 41 - r - 6, 1, 3, P.stationLit);
            rect(x0 + 84, G - 36, 4, 6, P.stationLit);
            break;
          }
          case 'stpauls': {
            // St Paul's Cathedral: three Gothic spires over the nave.
            const x0 = b.x;
            rect(x0 + 2, G - 30, 28, 30, P.stone);
            rect(x0 + 2, G - 30, 28, 1, P.stoneLit);
            const spire = (cx: number, baseY: number, rows: number, width: number): void => {
              for (let i = 0; i < rows; i++) {
                const w = Math.max(1, Math.round(width * (1 - i / rows)));
                rect(cx - w / 2, baseY - i - 1, w, 1, P.stone);
              }
              rect(cx - width / 2, baseY - rows, 1, rows, P.stoneLit);
            };
            rect(x0 + 13, G - 52, 6, 22, P.stone);
            rect(x0 + 13, G - 52, 1, 22, P.stoneLit);
            spire(x0 + 16, G - 52, 24, 6);
            rect(x0 + 3, G - 42, 5, 12, P.stone);
            spire(x0 + 5.5, G - 42, 12, 5);
            rect(x0 + 24, G - 42, 5, 12, P.stone);
            spire(x0 + 26.5, G - 42, 12, 5);
            // Lit lancet windows along the nave and in the towers, and a rose window.
            for (const wx of [x0 + 6, x0 + 10, x0 + 21, x0 + 25]) rect(wx, G - 22, 2, 6, P.arch);
            for (const wx of [x0 + 5, x0 + 26]) rect(wx, G - 38, 1, 4, P.arch);
            rect(x0 + 15, G - 46, 2, 6, P.arch);
            rect(x0 + 14, G - 27, 4, 4, P.arch);
            rect(x0 + 15, G - 26, 2, 2, P.stone);
            break;
          }
          case 'artscentre': {
            // Arts Centre: a lattice spire with rings on a round base.
            const cx = b.x + 12;
            const apex = G - b.h + 10;
            const base = G - 14;
            rect(b.x + 2, G - 14, 20, 14, P.stone);
            rect(b.x + 4, G - 16, 16, 2, P.stone);
            for (let y = apex; y < base; y++) {
              const hw = Math.floor((9 * (y - apex)) / (base - apex));
              for (let x = cx - hw + 1; x < cx + hw; x++) {
                if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) rect(x, y, 1, 1, P.spire);
              }
              rect(cx - hw, y, 1, 1, P.spireLit);
              rect(cx + hw, y, 1, 1, P.spireLit);
              if ((y - apex) % 20 === 19) rect(cx - hw, y, 2 * hw + 1, 1, P.spireLit);
            }
            rect(cx, apex - 10, 1, 10, P.spireLit);
            rect(cx, apex - 11, 1, 1, P.tip);
            break;
          }
        }
      }
    });
  }

  private makeRoofs(s: number): HTMLCanvasElement {
    const G = this.groundY;
    return this.tile(ROOFS_TILE_W, G, s, (rect) => {
      for (const t of this.terraces) {
        const top = G - t.h;
        rect(t.x, top, t.w, t.h, P.roof);
        if (t.gable) {
          // A pitched roof stepping up to a ridge.
          const steps = Math.floor(t.w / 4);
          for (let i = 0; i < steps; i++) rect(t.x + 2 * i, top - i, t.w - 4 * i, 1, P.roof);
          for (let i = 0; i < steps; i++) rect(t.x + 2 * i, top - i, 2, 1, P.roofEdge);
        } else {
          // A Victorian parapet with a small pediment.
          rect(t.x, top, t.w, 1, P.roofEdge);
          rect(t.x + (t.w >> 1) - 2, top - 2, 4, 2, P.roof);
          rect(t.x + (t.w >> 1) - 2, top - 2, 4, 1, P.roofEdge);
        }
        if (t.chimney !== null) {
          rect(t.x + t.chimney, top - 6, 3, 6, P.chimney);
          rect(t.x + t.chimney - 1, top - 7, 5, 1, P.roofEdge);
        }
        rect(t.x, top, 1, t.h, P.roofEdge);
      }
    });
  }

  private makeGround(s: number): HTMLCanvasElement {
    const h = this.worldH - this.groundY;
    return this.tile(GROUND_TILE_W, h, s, (rect) => {
      rect(0, 0, GROUND_TILE_W, h, P.road);
      // Bluestone kerb with joints, the gutter, then two tram rails over bluestone pitchers.
      rect(0, 2, GROUND_TILE_W, 3, P.kerb);
      for (const jx of [11, 23, 35, 47]) rect(jx, 2, 1, 3, P.kerbJoint);
      rect(0, 5, GROUND_TILE_W, 1, P.gutter);
      for (const ry of [10, 19]) {
        rect(0, ry, GROUND_TILE_W, 1, P.rail);
        rect(0, ry + 1, GROUND_TILE_W, 1, P.railShadow);
      }
      for (let bx = 0; bx < GROUND_TILE_W; bx += 6) {
        rect(bx, 13, 5, 2, P.pitcher);
        rect((bx + 3) % GROUND_TILE_W, 16, 5, 2, P.pitcher);
      }
    });
  }

  /** A green-and-gold W-class tram in side view, TRAM_W × TRAM_H units. */
  private makeTram(s: number): HTMLCanvasElement {
    return this.tile(TRAM_W, TRAM_H, s, (rect) => {
      rect(6, 0, 34, 1, P.tramRoof);
      rect(3, 1, 40, 1, P.tramRoof);
      rect(1, 2, 44, 6, P.tramCream);
      rect(3, 2, 6, 2, P.tramWindow);
      rect(4, 2, 4, 1, P.tramCream);
      for (let wx = 11; wx + 3 <= 42; wx += 5) rect(wx, 3, 3, 4, wx % 2 === 0 ? P.tramWindowLit : P.tramWindow);
      rect(0, 8, TRAM_W, 1, P.tramGold);
      rect(0, 9, TRAM_W, 4, P.tramGreen);
      rect(14, 9, 3, 4, P.tramGreenDark);
      rect(29, 9, 3, 4, P.tramGreenDark);
      rect(2, 13, 42, 1, P.tramUnder);
      for (const bx of [6, 32]) {
        rect(bx, 14, 8, 2, P.tramUnder);
        rect(bx + 1, 14, 2, 2, P.tramWheel);
        rect(bx + 5, 14, 2, 2, P.tramWheel);
      }
    });
  }

  /** Sky bands, crossfading from `prevPhase` to `phase` by `blend` (0..1). */
  drawSky(ctx: CanvasRenderingContext2D, phase: number, prevPhase: number, blend: number): void {
    if (!this.fit) return;
    const x = this.fit.offsetX;
    const y = this.fit.offsetY;
    if (blend < 1 && prevPhase !== phase) {
      ctx.drawImage(this.skies[prevPhase]!, x, y);
      ctx.globalAlpha = blend;
      ctx.drawImage(this.skies[phase]!, x, y);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(this.skies[phase]!, x, y);
    }
  }

  /** The city skyline with steadily glowing windows. */
  drawSkyline(ctx: CanvasRenderingContext2D, scrollX: number, now: number, reduced: boolean): void {
    if (!this.fit || !this.skylineTile) return;
    const s = this.fit.scale;
    const shift = (scrollX * 0.15) % SKYLINE_TILE_W;
    const y = this.fit.offsetY;
    const px = Math.max(1, Math.round(2 * s));
    ctx.fillStyle = P.window;
    for (const k of [0, 1]) {
      const x = this.fit.offsetX + Math.round((k * SKYLINE_TILE_W - shift) * s);
      ctx.drawImage(this.skylineTile, x, y);
      for (const w of this.windows) {
        ctx.globalAlpha = lightLevel(now, w, reduced);
        ctx.fillRect(x + Math.round(w.x * s), y + Math.round(w.y * s), px, px);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Terrace roofs at a middle depth, with smoke rising slowly from some chimneys. */
  drawRoofs(ctx: CanvasRenderingContext2D, scrollX: number, now: number, reduced: boolean): void {
    if (!this.fit || !this.roofsTile) return;
    const s = this.fit.scale;
    const shift = (scrollX * 0.45) % ROOFS_TILE_W;
    const puff = Math.max(1, Math.round(2 * s));
    ctx.fillStyle = P.smoke;
    for (const k of [0, 1]) {
      const ox = k * ROOFS_TILE_W - shift;
      ctx.drawImage(this.roofsTile, this.X(ox), this.fit.offsetY);
      for (const t of this.terraces) {
        if (!t.smoke || t.chimney === null) continue;
        const cx = ox + t.x + t.chimney + 1;
        const cy = this.groundY - t.h - 8;
        for (let i = 0; i < 3; i++) {
          // Each puff rises 18 units over 4 s and fades; reduced motion holds them still.
          const k01 = reduced ? i / 3 : ((now / 4000 + i / 3 + t.x / 97) % 1 + 1) % 1;
          ctx.globalAlpha = 0.45 * (1 - k01);
          ctx.fillRect(this.X(cx + k01 * 5), this.Y(cy - k01 * 18), puff, puff);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Near haze: sparse faint specks. */
  drawHaze(ctx: CanvasRenderingContext2D, scrollX: number): void {
    if (!this.fit) return;
    const shift = (scrollX * 0.7) % SKYLINE_TILE_W;
    ctx.fillStyle = P.haze;
    for (const k of [0, 1]) {
      for (const h of this.haze) {
        const x0 = this.X(k * SKYLINE_TILE_W + h.x - shift);
        const y0 = this.Y(h.y);
        ctx.fillRect(x0, y0, this.X(k * SKYLINE_TILE_W + h.x - shift + 4) - x0, this.Y(h.y + 1) - y0);
      }
    }
  }

  /** The street: kerb, rails and the occasional tram, scrolling with the stacks, under the kerb line. */
  drawGround(ctx: CanvasRenderingContext2D, scrollX: number): void {
    if (!this.fit || !this.groundTile) return;
    const s = this.fit.scale;
    const gx = this.fit.offsetX;
    const gy = this.Y(this.groundY);
    const shift = scrollX % GROUND_TILE_W;
    const n = Math.ceil(this.worldW / GROUND_TILE_W) + 2;
    for (let k = -1; k < n; k++) {
      ctx.drawImage(this.groundTile, gx + Math.round((k * GROUND_TILE_W - shift) * s), gy);
    }
    const tx = tramX(scrollX, this.worldW);
    if (this.tram && tx < this.worldW && tx + TRAM_W > 0) ctx.drawImage(this.tram, this.X(tx), this.Y(this.groundY + 3));
    ctx.fillStyle = P.kerbLine;
    ctx.fillRect(gx, gy, this.fit.worldPxW, Math.max(1, this.Y(this.groundY + 2) - gy));
  }
}
