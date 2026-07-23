/**
 * Stretch-song selection (doc 01 §2.6, doc 06 §5.3): one aspirational song
 * ~10 tiers up feeds current-skill-sized Boss Challenge fragments into
 * practice — exploration only, never mastery pressure.
 */
import type { Fragment, PlayerState, Song, Tier } from '@/core/types';

export const STRETCH_TIER_OFFSET = 10;

/** The locked song with fragments whose tier is closest to learningTier + 10. */
export function stretchSongFor(
  player: Pick<PlayerState, 'learningTier'>,
  songs: readonly Song[],
  isUnlocked: (songId: string) => boolean,
): Song | null {
  const target: Tier = player.learningTier + STRETCH_TIER_OFFSET;
  const candidates = songs.filter(
    (s) => s.fragmentIds.length > 0 && s.tier > player.learningTier && !isUnlocked(s.id),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, s) =>
    Math.abs(s.tier - target) < Math.abs(best.tier - target) ? s : best,
  );
}

/**
 * A stretch fragment sized to TODAY's skills: its skillTags must intersect the
 * player's current working skills, and recently explored fragments rotate out
 * so the challenge stays fresh.
 */
export function selectStretchFragment(
  stretchSong: Song,
  fragments: readonly Fragment[],
  currentSkillIds: ReadonlySet<string>,
  recentStretchRefIds: ReadonlySet<string>,
  rand: () => number,
): Fragment | null {
  const pool = fragments.filter(
    (f) =>
      f.sourceSongId === stretchSong.id &&
      !recentStretchRefIds.has(f.id) &&
      (f.skillTags.length === 0 || f.skillTags.some((t) => currentSkillIds.has(t))),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}
