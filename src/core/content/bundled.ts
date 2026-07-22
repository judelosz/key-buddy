/**
 * Wires the shipped content JSON into a ContentService instance.
 * Charts (src/content/charts/*.json) and lessons (src/content/lessons/*.json,
 * one file per module) are auto-discovered via Vite glob, so adding a content
 * file needs no code change (data-driven content, build-spec §2).
 */
import type { Chart, Fragment, MiniGame, Skill, Song } from '@/core/types';
import type {
  Assessment,
  CurriculumLesson,
  Module,
  TheoryConcept,
  TierGate,
} from '@/core/curriculum/types';
import { ContentService, type RawContent } from './contentService';
import skills from '@/content/skills.json';
import songs from '@/content/songs.json';
import fragments from '@/content/fragments.json';
import minigames from '@/content/minigames.json';
import modules from '@/content/modules.json';
import assessments from '@/content/assessments.json';
import theoryConcepts from '@/content/theoryConcepts.json';
import tierGates from '@/content/tierGates.json';

const chartModules = import.meta.glob<{ default: Chart }>('@/content/charts/*.json', {
  eager: true,
});
const charts: Chart[] = Object.values(chartModules).map((m) => m.default);

const lessonModules = import.meta.glob<{ default: CurriculumLesson[] }>(
  '@/content/lessons/*.json',
  { eager: true },
);
const lessons: CurriculumLesson[] = Object.values(lessonModules).flatMap((m) => m.default);

export const rawContent: RawContent = {
  skills: skills as Skill[],
  songs: songs as Song[],
  charts,
  fragments: fragments as Fragment[],
  minigames: minigames as MiniGame[],
  modules: modules as Module[],
  lessons,
  assessments: assessments as Assessment[],
  theoryConcepts: theoryConcepts as TheoryConcept[],
  tierGates: tierGates as TierGate[],
};

let instance: ContentService | null = null;

/** Singleton, validated on first access. Throws on invalid content. */
export function getContent(): ContentService {
  if (!instance) instance = ContentService.createValidated(rawContent);
  return instance;
}
