/**
 * Content validation — base referential-integrity/shape checks for the
 * original entities plus the curriculum layer (see
 * curriculum/validateCurriculum.ts). Returns human-readable problems
 * (empty = valid).
 */
import { validateCurriculum } from '@/core/curriculum/validateCurriculum';
import type { RawContent } from './contentService';

export class ContentValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Content failed validation:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentValidationError';
  }
}

/**
 * Charts are allowed to be absent for a song's declared chartIds during early
 * build phases; that is reported only when `requireCharts` is true.
 */
export function validateContent(raw: RawContent, requireCharts = false): string[] {
  const problems: string[] = [];
  const skillIds = new Set(raw.skills.map((s) => s.id));
  const songIds = new Set(raw.songs.map((s) => s.id));
  const chartIds = new Set(raw.charts.map((c) => c.id));

  const dupCheck = (ids: string[], label: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${label} id: ${id}`);
      seen.add(id);
    }
  };
  dupCheck(raw.skills.map((s) => s.id), 'skill');
  dupCheck(raw.songs.map((s) => s.id), 'song');
  dupCheck(raw.charts.map((c) => c.id), 'chart');
  dupCheck(raw.fragments.map((f) => f.id), 'fragment');
  dupCheck(raw.minigames.map((m) => m.id), 'minigame');

  for (const skill of raw.skills) {
    for (const pre of skill.prerequisites) {
      if (!skillIds.has(pre)) {
        problems.push(`Skill ${skill.id} lists missing prerequisite ${pre}`);
      }
    }
    if (skill.tier < 1 || skill.tier > 30) {
      problems.push(`Skill ${skill.id} has out-of-range tier ${skill.tier}`);
    }
  }

  for (const song of raw.songs) {
    for (const req of song.requiredSkills) {
      if (!skillIds.has(req)) {
        problems.push(`Song ${song.id} requires missing skill ${req}`);
      }
    }
    for (const taught of song.taughtSkills) {
      if (!skillIds.has(taught)) {
        problems.push(`Song ${song.id} teaches missing skill ${taught}`);
      }
    }
    if (requireCharts) {
      for (const cid of song.chartIds) {
        if (!chartIds.has(cid)) {
          problems.push(`Song ${song.id} references missing chart ${cid}`);
        }
      }
    }
  }

  for (const chart of raw.charts) {
    if (!songIds.has(chart.songId)) {
      problems.push(`Chart ${chart.id} references missing song ${chart.songId}`);
    }
    if (chart.notes.length === 0) {
      problems.push(`Chart ${chart.id} has no notes`);
    }
    for (const note of chart.notes) {
      if (note.pitches.length === 0) {
        problems.push(`Chart ${chart.id} note ${note.id} has no pitches`);
      }
      if (note.durationBeats <= 0) {
        problems.push(`Chart ${chart.id} note ${note.id} has non-positive duration`);
      }
    }
  }

  for (const fragment of raw.fragments) {
    if (!songIds.has(fragment.sourceSongId)) {
      problems.push(`Fragment ${fragment.id} references missing song ${fragment.sourceSongId}`);
    }
    for (const tag of fragment.skillTags) {
      if (!skillIds.has(tag)) {
        problems.push(`Fragment ${fragment.id} tags missing skill ${tag}`);
      }
    }
    if (fragment.chart.notes.length === 0) {
      problems.push(`Fragment ${fragment.id} has no notes`);
    }
  }

  problems.push(...validateCurriculum(raw));

  return problems;
}
