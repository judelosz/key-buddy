/**
 * Wires the shipped content JSON into a ContentService instance.
 * Charts are auto-discovered from src/content/charts/*.json via Vite glob, so
 * adding a chart file needs no code change (data-driven content, build-spec §2).
 */
import type { Chart, Fragment, MiniGame, Skill, Song } from '@/core/types';
import { ContentService, type RawContent } from './contentService';
import skills from '@/content/skills.json';
import songs from '@/content/songs.json';
import fragments from '@/content/fragments.json';
import minigames from '@/content/minigames.json';

const chartModules = import.meta.glob<{ default: Chart }>('@/content/charts/*.json', {
  eager: true,
});

const charts: Chart[] = Object.values(chartModules).map((m) => m.default);

export const rawContent: RawContent = {
  skills: skills as Skill[],
  songs: songs as Song[],
  charts,
  fragments: fragments as Fragment[],
  minigames: minigames as MiniGame[],
};

let instance: ContentService | null = null;

/** Singleton, validated on first access. Throws on invalid content. */
export function getContent(): ContentService {
  if (!instance) instance = ContentService.createValidated(rawContent);
  return instance;
}
