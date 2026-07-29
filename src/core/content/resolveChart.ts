/**
 * Chart resolution helpers shared by the lesson runner, session runner, and
 * dev seams — fragments play through a synthetic chart so the whole take loop
 * (player, scoring, reducers) stays chart-shaped.
 */
import type { Chart, Fragment, Song } from '@/core/types';
import type { CurriculumLesson } from '@/core/curriculum/types';
import type { ContentService } from './contentService';

export function fragmentAsChart(fragment: Fragment): Chart {
  return {
    id: fragment.id,
    songId: fragment.sourceSongId,
    arrangementLevel: 'simplified',
    // A fragment take exercises the fragment's own skills — never the source
    // song's full list (a Tier-1 stretch cell from a Tier-24 song must not
    // credit swing/dom7 Hands evidence).
    taughtSkills: fragment.skillTags,
    ...fragment.chart,
  };
}

/** Resolve the song + (possibly synthetic, fragment-backed) chart of a lesson. */
export function chartForLesson(
  content: ContentService,
  lesson: CurriculumLesson,
): { song: Song; chart: Chart } | null {
  if (lesson.chartId) {
    const chart = content.getChart(lesson.chartId);
    const song = chart ? content.getSong(chart.songId) : undefined;
    return chart && song ? { song, chart } : null;
  }
  if (lesson.fragmentId) {
    const fragment = content.getFragment(lesson.fragmentId);
    const song = fragment ? content.getSong(fragment.sourceSongId) : undefined;
    if (!fragment || !song) return null;
    return { song, chart: fragmentAsChart(fragment) };
  }
  return null;
}
