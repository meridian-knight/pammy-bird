import { describe, expect, it } from 'vitest';
import { GROUND_Y, WORLD_W } from '../../src/game/config';
import {
  buildHaze,
  buildTerraces,
  buildWindows,
  LIGHT_MAX,
  LIGHT_MIN,
  LIGHT_PERIOD_MAX,
  LIGHT_PERIOD_MIN,
  lightLevel,
  mixHex,
  ROOFS_TILE_W,
  SKY_PHASES,
  skyBands,
  skyPhaseAt,
  SKYLINE,
  SKYLINE_TILE_W,
  TRAM_LOOP,
  TRAM_SPEED,
  TRAM_W,
  tramX,
} from '../../src/ui/backdrop';

describe('Melbourne skyline', () => {
  it('keeps every landmark inside the tile and out of the play band’s upper half', () => {
    const kinds = new Set(SKYLINE.map((b) => b.kind));
    for (const k of ['rialto', 'eureka', 'station', 'stpauls', 'artscentre'] as const) expect(kinds.has(k)).toBe(true);
    for (const b of SKYLINE) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(SKYLINE_TILE_W);
      expect(GROUND_Y - b.h).toBeGreaterThan(160); // never climbs into the play band's upper half
    }
  });

  it('lights windows deterministically, inside their towers, with slow drift periods', () => {
    const lights = buildWindows(7, GROUND_Y);
    expect(lights).toEqual(buildWindows(7, GROUND_Y));
    expect(lights).not.toEqual(buildWindows(8, GROUND_Y));
    expect(lights.length).toBeGreaterThan(10);
    for (const l of lights) {
      const tower = SKYLINE.find((b) => l.x >= b.x && l.x + 2 <= b.x + b.w && ['block', 'rialto', 'eureka'].includes(b.kind));
      expect(tower).toBeDefined();
      expect(l.y).toBeGreaterThanOrEqual(GROUND_Y - tower!.h);
      expect(l.y + 2).toBeLessThanOrEqual(GROUND_Y);
      expect(l.period).toBeGreaterThanOrEqual(LIGHT_PERIOD_MIN);
      expect(l.period).toBeLessThanOrEqual(LIGHT_PERIOD_MAX);
    }
  });
});

describe('lightLevel', () => {
  it('glows steadily: always lit, never a step, constant under reduced motion', () => {
    for (const light of buildWindows(7, GROUND_Y).slice(0, 12)) {
      let prev = lightLevel(0, light);
      for (let ms = 16; ms <= 20000; ms += 16) {
        const level = lightLevel(ms, light);
        expect(level).toBeGreaterThanOrEqual(LIGHT_MIN);
        expect(level).toBeLessThanOrEqual(LIGHT_MAX);
        expect(Math.abs(level - prev)).toBeLessThan(0.01);
        prev = level;
      }
      expect(lightLevel(1234, light, true)).toBe(lightLevel(9876, light, true));
    }
  });
});

describe('terraces and haze', () => {
  it('fill the roof tile edge to edge with low roofs, deterministically', () => {
    const row = buildTerraces(11);
    expect(row).toEqual(buildTerraces(11));
    expect(row[0]!.x).toBe(0);
    for (let i = 0; i < row.length; i++) {
      const t = row[i]!;
      expect(t.h).toBeGreaterThanOrEqual(10);
      expect(t.h).toBeLessThanOrEqual(22);
      expect(t.x + t.w).toBeLessThanOrEqual(ROOFS_TILE_W);
      if (i > 0) expect(t.x).toBe(row[i - 1]!.x + row[i - 1]!.w);
      if (t.chimney !== null) expect(t.chimney + 3).toBeLessThanOrEqual(t.w);
      if (t.smoke) expect(t.chimney).not.toBeNull();
    }
  });

  it('keeps haze inside its tile and clear of the ground', () => {
    for (const h of buildHaze(3)) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThan(SKYLINE_TILE_W);
      expect(h.y + 1).toBeLessThan(GROUND_Y);
    }
  });
});

describe('tram', () => {
  it('is off screen most of the time and crosses the whole street when it passes', () => {
    let visible = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const x = tramX((i / n) * (TRAM_LOOP / TRAM_SPEED), WORLD_W);
      if (x < WORLD_W && x + TRAM_W > 0) visible++;
    }
    expect(visible / n).toBeGreaterThan(0.1);
    expect(visible / n).toBeLessThan(0.3);
  });
});

describe('sky phases', () => {
  it('advance every 10 points and cycle', () => {
    expect(skyPhaseAt(0)).toBe(0);
    expect(skyPhaseAt(9)).toBe(0);
    expect(skyPhaseAt(10)).toBe(1);
    expect(skyPhaseAt(25)).toBe(2);
    expect(skyPhaseAt(30)).toBe(3);
    expect(skyPhaseAt(40)).toBe(0);
    expect(SKY_PHASES).toHaveLength(4);
  });

  it('stay dark above the horizon so the stacks keep their contrast', () => {
    const lum = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3;
    };
    for (const p of SKY_PHASES) {
      expect(lum(p.top)).toBeLessThan(40);
      expect(lum(p.mid)).toBeLessThan(48);
      expect(lum(p.glow)).toBeLessThan(100);
    }
  });

  it('are drawn in a few stepped bands that run from the top colour to the horizon glow', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    for (const p of SKY_PHASES) {
      const bands = skyBands(p);
      expect(bands).toHaveLength(6);
      expect(bands[0]!.colour).toBe(p.top);
      expect(bands[bands.length - 1]!.colour).toBe(p.glow);
      for (let i = 1; i < bands.length; i++) expect(bands[i]!.from).toBeGreaterThan(bands[i - 1]!.from);
    }
  });
});
