/**
 * Stretch-song selection (doc 01 §2.6, doc 06 §5.3): one aspirational song
 * ~10 tiers up feeds current-skill-sized Boss Challenge fragments into
 * practice — exploration only, never mastery pressure.
 */
import type { Fragment, PlayerState, Song, Tier } from '@/core/types';

export const STRETCH_TIER_OFFSET = 10;
/**
 * A stretch song must sit well beyond the path frontier. Without this floor,
 * fragment-bearing songs a few tiers up (Frankie at Tier 8 for a Tier-4
 * player) hijack the slot from the true deep-end song — and their
 * current-tier-tagged fragments then match nothing, silently killing the
 * stretch segment. Near-future path songs are not "the deep end".
 */
export const STRETCH_MIN_AHEAD = 6;

/** The locked song with fragments whose tier is closest to learningTier + 10
 * (and at least STRETCH_MIN_AHEAD tiers out). */
export function stretchSongFor(
  player: Pick<PlayerState, 'learningTier'>,
  songs: readonly Song[],
  isUnlocked: (songId: string) => boolean,
): Song | null {
  const target: Tier = player.learningTier + STRETCH_TIER_OFFSET;
  const candidates = songs.filter(
    (s) =>
      s.fragmentIds.length > 0 &&
      s.tier >= player.learningTier + STRETCH_MIN_AHEAD &&
      !isUnlocked(s.id),
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
