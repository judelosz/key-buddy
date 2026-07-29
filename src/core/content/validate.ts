/**
 * Content validation — base referential-integrity/shape checks for the
 * original entities plus the curriculum layer (see
 * curriculum/validateCurriculum.ts). Returns human-readable problems
 * (empty = valid).
 */
import type { Chart } from '@/core/types';
import { validateCurriculum } from '@/core/curriculum/validateCurriculum';
import type { RawContent } from './contentService';

/** Last 0-based bar index a chart's notes reach. */
export function chartLastBar(chart: Pick<Chart, 'notes' | 'timeSignature'>): number {
  const maxEnd = Math.max(...chart.notes.map((n) => n.startBeat + n.durationBeats));
  return Math.ceil(maxEnd / chart.timeSignature.beatsPerBar) - 1;
}

/**
 * Song charts must carry phrase-level sections covering every bar exactly
 * once, in order — the substrate for SongMastery section/transition evidence.
 */
function validateChartSections(chart: Chart): string[] {
  const problems: string[] = [];
  if (!chart.sections || chart.sections.length === 0) {
    problems.push(`Chart ${chart.id} has no sections (song charts must be sectioned)`);
    return problems;
  }
  const lastBar = chartLastBar(chart);
  const seen = new Set<string>();
  let expectedStart = 0;
  for (const s of chart.sections) {
    if (seen.has(s.id)) problems.push(`Chart ${chart.id} has duplicate section id ${s.id}`);
    seen.add(s.id);
    if (s.startBar !== expectedStart) {
      problems.push(
        `Chart ${chart.id} section ${s.id} starts at bar ${s.startBar}, expected ${expectedStart} (sections must tile contiguously from bar 0)`,
      );
    }
    if (s.endBar < s.startBar) {
      problems.push(`Chart ${chart.id} section ${s.id} ends before it starts`);
    }
    expectedStart = s.endBar + 1;
  }
  if (expectedStart !== lastBar + 1) {
    problems.push(
      `Chart ${chart.id} sections cover bars 0–${expectedStart - 1} but the chart has bars 0–${lastBar}`,
    );
  }
  return problems;
}

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
    if (song.challengeTier !== undefined) {
      // Challenge songs unlock by learning tier (pure Hands evidence) — a
      // skill list on top would be a second, contradictory gate.
      if (song.requiredSkills.length > 0) {
        problems.push(`Challenge song ${song.id} must have empty requiredSkills`);
      }
      if (song.challengeTier < 2 || song.challengeTier > 30) {
        problems.push(`Challenge song ${song.id} has out-of-range challengeTier ${song.challengeTier}`);
      }
      if (song.chartIds.length === 0) {
        problems.push(`Challenge song ${song.id} needs at least one chart`);
      }
    }
  }

  const songById = new Map(raw.songs.map((s) => [s.id, s]));
  for (const chart of raw.charts) {
    if (!songIds.has(chart.songId)) {
      problems.push(`Chart ${chart.id} references missing song ${chart.songId}`);
    }
    if (chart.taughtSkills !== undefined) {
      const song = songById.get(chart.songId);
      if (chart.taughtSkills.length === 0) {
        problems.push(`Chart ${chart.id} declares an empty taughtSkills override`);
      }
      for (const sid of chart.taughtSkills) {
        if (song && !song.taughtSkills.includes(sid)) {
          problems.push(
            `Chart ${chart.id} teaches ${sid}, which its song ${chart.songId} does not list`,
          );
        }
      }
    }
  }
  // Every song-taught skill must remain teachable by at least one of its
  // charts once overrides exist — otherwise the skill silently goes dead.
  for (const song of raw.songs) {
    const charts = raw.charts.filter((c) => c.songId === song.id);
    if (charts.length === 0) continue;
    const effective = new Set(charts.flatMap((c) => c.taughtSkills ?? song.taughtSkills));
    for (const sid of song.taughtSkills) {
      if (!effective.has(sid)) {
        problems.push(`Song ${song.id} lists taught skill ${sid} but no chart teaches it`);
      }
    }
  }
  for (const chart of raw.charts) {
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
    problems.push(...validateChartSections(chart));
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
