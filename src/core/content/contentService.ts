/**
 * ContentService — loads and validates the static content (skills, songs,
 * charts, fragments, minigames) and exposes the queries other services need
 * (by tier, genre, skill). Pure and testable: construct it with a RawContent
 * bundle; see ./bundled.ts for the wiring that imports the shipped JSON.
 *
 * build-spec §6.10.
 */
import type {
  Chart,
  Fragment,
  Genre,
  MiniGame,
  Skill,
  Song,
  Tier,
} from '@/core/types';

export interface RawContent {
  skills: Skill[];
  songs: Song[];
  charts: Chart[];
  fragments: Fragment[];
  minigames: MiniGame[];
}

export class ContentValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Content failed validation:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentValidationError';
  }
}

/**
 * Referential-integrity + shape checks. Returns a list of human-readable
 * problems (empty = valid). Charts are allowed to be absent for a song's
 * declared chartIds during early build phases; that is reported as a warning
 * problem only when `requireCharts` is true.
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

  return problems;
}

export class ContentService {
  private readonly skillById: Map<string, Skill>;
  private readonly songById: Map<string, Song>;
  private readonly chartById: Map<string, Chart>;

  constructor(private readonly raw: RawContent) {
    this.skillById = new Map(raw.skills.map((s) => [s.id, s]));
    this.songById = new Map(raw.songs.map((s) => [s.id, s]));
    this.chartById = new Map(raw.charts.map((c) => [c.id, c]));
  }

  /** Throws ContentValidationError if the bundle is invalid. */
  static createValidated(raw: RawContent): ContentService {
    const problems = validateContent(raw);
    if (problems.length > 0) throw new ContentValidationError(problems);
    return new ContentService(raw);
  }

  get skills(): readonly Skill[] {
    return this.raw.skills;
  }
  get songs(): readonly Song[] {
    return this.raw.songs;
  }

  getSkill(id: string): Skill | undefined {
    return this.skillById.get(id);
  }
  getSong(id: string): Song | undefined {
    return this.songById.get(id);
  }
  getChart(id: string): Chart | undefined {
    return this.chartById.get(id);
  }

  songsByTier(tier: Tier): Song[] {
    return this.raw.songs.filter((s) => s.tier === tier);
  }
  songsByGenre(genre: Genre): Song[] {
    return this.raw.songs.filter((s) => s.genre === genre);
  }
  skillsByFamily(family: Skill['family']): Skill[] {
    return this.raw.skills.filter((s) => s.family === family);
  }

  /** Songs whose every required skill is in the provided mastered set. */
  unlockedSongs(masteredSkillIds: ReadonlySet<string>): Song[] {
    return this.raw.songs.filter((s) =>
      s.requiredSkills.every((id) => masteredSkillIds.has(id)),
    );
  }
}
