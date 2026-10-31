export type Face = 'open' | 'blink' | 'chomp' | 'dizzy';
export type Gaze = 'centre' | 'up' | 'down' | 'left' | 'right';
export type Wing = 0 | 1;

export const SPRITE_PX: number;
export const PALETTE: Readonly<Record<string, string>>;

/** A SPRITE_PX × SPRITE_PX grid of palette keys ('.' is transparent). Pam the bird: 32×32. */
export function agentGrid(opts?: { wing?: Wing; face?: Face; gaze?: Gaze }): string[][];
