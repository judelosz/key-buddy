/**
 * ContentService — loads and validates the static content (skills, songs,
 * charts, fragments, minigames, and the curriculum layer) and exposes the
 * queries other services need. Pure and testable: construct it with a
 * RawContent bundle; see ./bundled.ts for the wiring that imports the shipped
 * JSON. Validation lives in ./validate.ts + curriculum/validateCurriculum.ts.
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
import type {
  Assessment,
  CurriculumLesson,
  Module,
  TheoryConcept,
  TierGate,
} from '@/core/curriculum/types';
import { ContentValidationError, validateContent } from './validate';

export { ContentValidationError, validateContent };

export interface RawContent {
  skills: Skill[];
  songs: Song[];
  charts: Chart[];
  fragments: Fragment[];
  minigames: MiniGame[];
  modules: Module[];
  lessons: CurriculumLesson[];
  assessments: Assessment[];
  theoryConcepts: TheoryConcept[];
  tierGates: TierGate[];
}

export class ContentService {
  private readonly skillById: Map<string, Skill>;
  private readonly songById: Map<string, Song>;
  private readonly chartById: Map<string, Chart>;
  private readonly fragmentById: Map<string, Fragment>;
  private readonly moduleById: Map<string, Module>;
  private readonly lessonById: Map<string, CurriculumLesson>;
  private readonly assessmentById: Map<string, Assessment>;
  private readonly conceptById: Map<string, TheoryConcept>;
  private readonly gateByTier: Map<number, TierGate>;

  constructor(private readonly raw: RawContent) {
    this.skillById = new Map(raw.skills.map((s) => [s.id, s]));
    this.songById = new Map(raw.songs.map((s) => [s.id, s]));
    this.chartById = new Map(raw.charts.map((c) => [c.id, c]));
    this.fragmentById = new Map(raw.fragments.map((f) => [f.id, f]));
    this.moduleById = new Map(raw.modules.map((m) => [m.id, m]));
    this.lessonById = new Map(raw.lessons.map((l) => [l.id, l]));
    this.assessmentById = new Map(raw.assessments.map((a) => [a.id, a]));
    this.conceptById = new Map(raw.theoryConcepts.map((t) => [t.id, t]));
    this.gateByTier = new Map(raw.tierGates.map((g) => [g.tier, g]));
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
  /** Modules in authored order (tier, then file order). */
  get modules(): readonly Module[] {
    return this.raw.modules;
  }
  get assessments(): readonly Assessment[] {
    return this.raw.assessments;
  }
  get tierGates(): readonly TierGate[] {
    return this.raw.tierGates;
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
  getFragment(id: string): Fragment | undefined {
    return this.fragmentById.get(id);
  }
  getModule(id: string): Module | undefined {
    return this.moduleById.get(id);
  }
  getLesson(id: string): CurriculumLesson | undefined {
    return this.lessonById.get(id);
  }
  getAssessment(id: string): Assessment | undefined {
    return this.assessmentById.get(id);
  }
  getTheoryConcept(id: string): TheoryConcept | undefined {
    return this.conceptById.get(id);
  }
  getTierGate(tier: Tier): TierGate | undefined {
    return this.gateByTier.get(tier);
  }

  /** A module's lessons in path order. */
  lessonsForModule(moduleId: string): CurriculumLesson[] {
    const module = this.moduleById.get(moduleId);
    if (!module) return [];
    return module.lessonIds
      .map((id) => this.lessonById.get(id))
      .filter((l): l is CurriculumLesson => l !== undefined);
  }

  modulesForTier(tier: Tier): Module[] {
    return this.raw.modules.filter((m) => m.tier === tier);
  }

  lessonsTeachingSkill(skillId: string): CurriculumLesson[] {
    return this.raw.lessons.filter((l) => l.skillIds.includes(skillId));
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
