/**
 * Piano key geometry shared by the on-screen keyboard and the falling-notes
 * visualizer, so a falling note drops exactly onto its key. Both compute the
 * same rects from the same pitch range; widths are expressed against a caller-
 * supplied total (use 100 for CSS %, or a pixel width for canvas).
 */
import { isBlackKey } from './music';

export interface KeyRect {
  pitch: number;
  x: number; // left edge, in the same unit as `totalWidth`
  width: number;
  black: boolean;
}

export function whitePitches(low: number, high: number): number[] {
  const out: number[] = [];
  for (let p = low; p <= high; p++) if (!isBlackKey(p)) out.push(p);
  return out;
}

/**
 * Rects for every key in [low, high]. White keys tile edge-to-edge; black keys
 * are 62% as wide and centered on the boundary between their two white
 * neighbours (matching a real keyboard and the on-screen layout).
 */
export function keyRects(low: number, high: number, totalWidth: number): KeyRect[] {
  const whites = whitePitches(low, high);
  const w = whites.length > 0 ? totalWidth / whites.length : totalWidth;
  const whiteIndex = new Map<number, number>();
  whites.forEach((p, i) => whiteIndex.set(p, i));

  const rects: KeyRect[] = [];
  for (let p = low; p <= high; p++) {
    if (!isBlackKey(p)) {
      const i = whiteIndex.get(p)!;
      rects.push({ pitch: p, x: i * w, width: w, black: false });
    } else {
      // A sharp sits above the natural one semitone below it.
      const owner = whiteIndex.get(p - 1);
      if (owner === undefined) continue;
      const bw = w * 0.62;
      rects.push({ pitch: p, x: (owner + 1) * w - bw / 2, width: bw, black: true });
    }
  }
  return rects;
}

export function keyRectMap(low: number, high: number, totalWidth: number): Map<number, KeyRect> {
  return new Map(keyRects(low, high, totalWidth).map((r) => [r.pitch, r]));
}

/** Expand a pitch span to whole octaves (C..B) so the keyboard reads cleanly. */
export function octaveRange(minPitch: number, maxPitch: number): { low: number; high: number } {
  const low = Math.floor(minPitch / 12) * 12; // C at or below
  const high = Math.floor(maxPitch / 12) * 12 + 11; // B at or above
  return { low, high };
}
