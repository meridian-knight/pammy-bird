import { describe, expect, it } from 'vitest';
import { agentGrid, PALETTE, SPRITE_PX } from '../../src/art/agent-grid';
import { TOKEN_PALETTE, tokenGrid } from '../../src/art/token-grid';
import { opaqueRows, pixelEdges } from '../../src/ui/sprites';

const TOKEN_PX = 12;

describe('pixelEdges', () => {
  it('reproduces plain integer scales', () => {
    for (const scale of [1, 2, 3, 4]) {
      const edges = pixelEdges(scale);
      expect(edges).toEqual(Array.from({ length: SPRITE_PX + 1 }, (_, i) => i * scale));
    }
  });

  it('covers exactly round(n × scale) device pixels at fractional scales', () => {
    for (const scale of [46 / 12, 44 / 12, 22 / 12, 15 / 12, 2.5, 7.35]) {
      const edges = pixelEdges(scale);
      expect(edges).toHaveLength(SPRITE_PX + 1);
      expect(edges[0]).toBe(0);
      expect(edges[SPRITE_PX]).toBe(Math.round(SPRITE_PX * scale));
      const widths = edges.slice(1).map((e, i) => e - edges[i]!);
      expect(Math.min(...widths)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
      expect(widths.reduce((a, b) => a + b, 0)).toBe(Math.round(SPRITE_PX * scale));
    }
  });

  it('sizes to any grid, so the 12×12 token still paints at 12', () => {
    expect(pixelEdges(2, TOKEN_PX)).toEqual(Array.from({ length: TOKEN_PX + 1 }, (_, i) => i * 2));
    expect(pixelEdges(1.5, TOKEN_PX)[TOKEN_PX]).toBe(18);
  });
});

describe('agentGrid', () => {
  it('is a SPRITE_PX square (32×32 Pam) whose keys are all in the palette', () => {
    expect(SPRITE_PX).toBe(32);
    for (const wing of [0, 1] as const) {
      for (const face of ['open', 'blink', 'chomp', 'dizzy'] as const) {
        for (const gaze of ['centre', 'up', 'down', 'left', 'right'] as const) {
          const g = agentGrid({ wing, face, gaze });
          expect(g).toHaveLength(SPRITE_PX);
          for (const row of g) {
            expect(row).toHaveLength(SPRITE_PX);
            for (const key of row) expect(key === '.' || key in PALETTE).toBe(true);
          }
        }
      }
    }
  });

  it('token chip is a 12×12 grid of palette keys with a brighter pulse frame', () => {
    for (const frame of [0, 1] as const) {
      const g = tokenGrid(frame);
      expect(g).toHaveLength(TOKEN_PX);
      for (const row of g) {
        expect(row).toHaveLength(TOKEN_PX);
        for (const key of row) expect(key === '.' || key in TOKEN_PALETTE).toBe(true);
      }
    }
    expect(tokenGrid(0)[5]![5]).toBe('K');
    expect(tokenGrid(1)[5]![5]).toBe('y');
  });

  it('flaps with the tail and feet and keeps the eye and beak in place', () => {
    for (const face of ['open', 'blink', 'chomp'] as const) {
      const down = agentGrid({ wing: 0, face });
      const up = agentGrid({ wing: 1, face });
      // Tail lobes (columns 0-5) move between frames.
      const tail = (g: string[][]) => g.slice(8, 20).map((r) => r.slice(0, 6).join(''));
      expect(tail(down)).not.toEqual(tail(up));
      // Feet: wing 0 has them extended, wing 1 tucked (art ends higher).
      expect(opaqueRows(down).bottom).toBeGreaterThan(opaqueRows(up).bottom);
      // Eye and beak (columns 13-31, rows 11-18) are identical in both frames.
      for (let y = 11; y <= 18; y++) expect(down[y]!.slice(13)).toEqual(up[y]!.slice(13));
    }
  });

  it('keeps the hitbox on the drawn body in every state', () => {
    for (const wing of [0, 1] as const) {
      const g = agentGrid({ wing });
      const { top, bottom } = opaqueRows(g);
      expect(top).toBeLessThanOrEqual(10);
      expect(bottom).toBeGreaterThanOrEqual(21);
      for (let y = 10; y <= 21; y++) expect(g[y]!.slice(5, 23).some((k) => k !== '.')).toBe(true);
    }
  });
});
