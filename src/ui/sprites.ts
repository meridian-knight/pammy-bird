/**
 * Locally drawn pixel art. The agent (Pam the bird) is a 32x32 grid of palette keys (see
 * src/art/agent-grid.js) painted onto a small canvas at a device-pixel scale
 * (integer or fractional, with rounded pixel edges), so it stays crisp at any
 * screen size without the browser resampling it.
 */
import { agentGrid, PALETTE, SPRITE_PX as ART_PX, type Face, type Gaze, type Wing } from '../art/agent-grid';

export const SPRITE_PX: number = ART_PX;
export type { Face, Gaze, Wing };

export interface AgentSpriteOptions {
  wing: Wing;
  face: Face;
  gaze?: Gaze;
}

/**
 * Device-pixel edges of `n` sprite pixels (the agent's SPRITE_PX by default)
 * at `scale` device px per sprite pixel. The scale may be fractional: edges are
 * rounded so the sprite covers exactly `round(n × scale)` pixels and
 * neighbouring widths differ by at most one, which keeps the art crisp without
 * any later resampling. Integer scales give the plain `i × scale` edges.
 */
export function pixelEdges(scale: number, n: number = SPRITE_PX): number[] {
  const edges: number[] = [];
  for (let i = 0; i <= n; i++) edges.push(Math.round(i * scale));
  return edges;
}

/** First and last rows of `grid` that hold any opaque pixel (whole grid if none). */
export function opaqueRows(grid: readonly (readonly string[])[]): { top: number; bottom: number } {
  let top = -1;
  let bottom = -1;
  grid.forEach((row, y) => {
    if (row.some((k) => k !== '.')) {
      if (top < 0) top = y;
      bottom = y;
    }
  });
  return top < 0 ? { top: 0, bottom: grid.length - 1 } : { top, bottom };
}

export function paint(grid: readonly (readonly string[])[], palette: Readonly<Record<string, string>>, scale: number): HTMLCanvasElement {
  // Square grids of any size: the 32x32 agent and the 12x12 backdrop token.
  const n = grid.length;
  const edges = pixelEdges(scale, n);
  const size = edges[n]!;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  grid.forEach((row, y) => {
    row.forEach((key, x) => {
      const colour = palette[key];
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(edges[x]!, edges[y]!, edges[x + 1]! - edges[x]!, edges[y + 1]! - edges[y]!);
    });
  });
  return canvas;
}

export function agentGridFor(opts: AgentSpriteOptions): string[][] {
  return agentGrid({ wing: opts.wing, face: opts.face, gaze: opts.gaze ?? 'centre' });
}

/** The flying agent at `scale` device pixels per sprite pixel. */
export function agentSprite(opts: AgentSpriteOptions, scale: number): HTMLCanvasElement {
  return paint(agentGrid({ wing: opts.wing, face: opts.face, gaze: opts.gaze ?? 'centre' }), PALETTE, scale);
}
