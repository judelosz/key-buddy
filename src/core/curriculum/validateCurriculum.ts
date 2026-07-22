/**
 * Author-time validation for the curriculum layer (doc 06 §9): referential
 * integrity, prerequisite cycles, lesson-order feasibility, complete tier
 * gates, boss playability, scouting caps, exercise coherence, and mode/assist
 * policy. Returns human-readable problems (empty = valid).
 */
import type { Skill } from '@/core/types';
import type { RawContent } from '@/core/content/contentService';
import type { Module } from './types';

/** Assists that count as visual scaffolding — forbidden in independent+ modes. */
const VISUAL_ASSISTS = ['falling-notes', 'note-names'] as const;

/** Fields doc 06 §9 requires on any skill that a Module claims as core. */
export function isCurriculumSkill(s: Skill): boolean {
  return (
    s.arc !== undefined &&
    s.strand !== undefined &&
    s.outcome !== undefined &&
    s.moduleId !== undefined &&
    s.assessment !== undefined
  );
}

/** DFS cycle check over an id → prerequisite-ids graph. */
function findCycle(ids: string[], prereqsOf: (id: string) => string[]): string[] | null {
  const visiting = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    if (done.has(id)) return null;
    if (visiting.has(id)) return [...stack.slice(stack.indexOf(id)), id];
    visiting.add(id);
    stack.push(id);
    for (const pre of prereqsOf(id)) {
      const cycle = visit(pre);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    done.add(id);
    return null;
  };

  for (const id of ids) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

/** Transitive prerequisite module ids of a module (excluding itself). */
function transitivePrereqModules(module: Module, moduleById: Map<string, Module>): Set<string> {
  const out = new Set<string>();
  const queue = [...module.prerequisiteModuleIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const m = moduleById.get(id);
    if (m) queue.push(...m.prerequisiteModuleIds);
  }
  return out;
}

export function validateCurriculum(raw: RawContent): string[] {
  const problems: string[] = [];
  const skillById = new Map(raw.skills.map((s) => [s.id, s]));
  const songById = new Map(raw.songs.map((s) => [s.id, s]));
  const chartIds = new Set(raw.charts.map((c) => c.id));
  const fragmentById = new Map(raw.fragments.map((f) => [f.id, f]));
  const moduleById = new Map(raw.modules.map((m) => [m.id, m]));
  const lessonById = new Map(raw.lessons.map((l) => [l.id, l]));
  const assessmentById = new Map(raw.assessments.map((a) => [a.id, a]));
  const conceptById = new Map(raw.theoryConcepts.map((t) => [t.id, t]));

  const dupCheck = (ids: string[], label: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate ${label} id: ${id}`);
      seen.add(id);
    }
  };
  dupCheck(raw.modules.map((m) => m.id), 'module');
  dupCheck(raw.lessons.map((l) => l.id), 'lesson');
  dupCheck(raw.assessments.map((a) => a.id), 'assessment');
  dupCheck(raw.theoryConcepts.map((t) => t.id), 'theory concept');
  dupCheck(raw.tierGates.map((g) => `tier-${g.tier}`), 'tier gate');

  // ── Prerequisite cycles ────────────────────────────────────────────────────
  const skillCycle = findCycle(
    raw.skills.map((s) => s.id),
    (id) => skillById.get(id)?.prerequisites ?? [],
  );
  if (skillCycle) problems.push(`Skill prerequisite cycle: ${skillCycle.join(' → ')}`);

  const moduleCycle = findCycle(
    raw.modules.map((m) => m.id),
    (id) => moduleById.get(id)?.prerequisiteModuleIds ?? [],
  );
  if (moduleCycle) problems.push(`Module prerequisite cycle: ${moduleCycle.join(' → ')}`);

  // ── Modules ↔ lessons ─────────────────────────────────────────────────────
  const moduleOfLesson = new Map<string, Module>();
  for (const module of raw.modules) {
    for (const pre of module.prerequisiteModuleIds) {
      if (!moduleById.has(pre)) {
        problems.push(`Module ${module.id} lists missing prerequisite module ${pre}`);
      }
    }
    module.lessonIds.forEach((lid, i) => {
      const lesson = lessonById.get(lid);
      if (!lesson) {
        problems.push(`Module ${module.id} lists missing lesson ${lid}`);
        return;
      }
      if (lesson.moduleId !== module.id) {
        problems.push(`Lesson ${lid} is listed by module ${module.id} but declares moduleId ${lesson.moduleId}`);
      }
      if (lesson.order !== i) {
        problems.push(`Lesson ${lid} has order ${lesson.order} but sits at position ${i} in module ${module.id}`);
      }
      if (moduleOfLesson.has(lid)) {
        problems.push(`Lesson ${lid} is listed by more than one module`);
      }
      moduleOfLesson.set(lid, module);
    });
    if (module.bossLessonId && !module.lessonIds.includes(module.bossLessonId)) {
      problems.push(`Module ${module.id} bossLessonId ${module.bossLessonId} is not among its lessons`);
    }
    // Spiral declarations (doc 06 §3.5 / doc 07 Phase 5): revisits look back,
    // prepares look forward, and every module past Tier 1 revisits something.
    for (const sid of module.revisits) {
      const skill = skillById.get(sid);
      if (!skill) {
        problems.push(`Module ${module.id} revisits missing skill ${sid}`);
      } else if (skill.tier > module.tier) {
        problems.push(`Module ${module.id} revisits ${sid} (tier ${skill.tier}) — revisits must look back, not up`);
      }
    }
    for (const sid of module.prepares) {
      const skill = skillById.get(sid);
      if (!skill) {
        problems.push(`Module ${module.id} prepares missing skill ${sid}`);
      } else if (skill.tier < module.tier) {
        problems.push(`Module ${module.id} prepares ${sid} (tier ${skill.tier}) — prepares must look forward, not back`);
      }
    }
    if (module.tier >= 2 && module.revisits.length === 0) {
      problems.push(`Module ${module.id} (tier ${module.tier}) declares no revisits — every tier-2+ module must bring something back`);
    }
    for (const coreId of module.coreSkillIds) {
      const skill = skillById.get(coreId);
      if (!skill) {
        problems.push(`Module ${module.id} claims missing core skill ${coreId}`);
      } else {
        if (!isCurriculumSkill(skill)) {
          problems.push(
            `Skill ${coreId} is a core skill of module ${module.id} but lacks curriculum fields (arc/strand/outcome/moduleId/assessment)`,
          );
        }
        if (skill.moduleId !== undefined && skill.moduleId !== module.id) {
          problems.push(
            `Skill ${coreId} declares moduleId ${skill.moduleId} but is core to module ${module.id}`,
          );
        }
      }
    }
  }
  for (const lesson of raw.lessons) {
    if (!moduleOfLesson.has(lesson.id)) {
      problems.push(`Lesson ${lesson.id} is not listed by any module`);
    }
  }

  // ── Lessons: refs, exercise coherence, mode/assist policy, scouting cap ──
  for (const lesson of raw.lessons) {
    const module = moduleOfLesson.get(lesson.id);
    for (const sid of lesson.skillIds) {
      if (!skillById.has(sid)) problems.push(`Lesson ${lesson.id} references missing skill ${sid}`);
    }
    if (lesson.chartId && !chartIds.has(lesson.chartId)) {
      problems.push(`Lesson ${lesson.id} references missing chart ${lesson.chartId}`);
    }
    if (lesson.fragmentId && !fragmentById.has(lesson.fragmentId)) {
      problems.push(`Lesson ${lesson.id} references missing fragment ${lesson.fragmentId}`);
    }
    if (lesson.theoryConceptId && !conceptById.has(lesson.theoryConceptId)) {
      problems.push(`Lesson ${lesson.id} references missing theory concept ${lesson.theoryConceptId}`);
    }

    switch (lesson.exerciseType) {
      case 'play-chart':
        if (!lesson.chartId) problems.push(`play-chart lesson ${lesson.id} has no chartId`);
        break;
      case 'fragment':
        if (!lesson.fragmentId) problems.push(`fragment lesson ${lesson.id} has no fragmentId`);
        break;
      case 'listen':
        if (!lesson.chartId && !lesson.fragmentId) {
          problems.push(`listen lesson ${lesson.id} needs a chartId or fragmentId`);
        }
        break;
      case 'theory-quiz': {
        if (!lesson.theoryConceptId) {
          problems.push(`theory-quiz lesson ${lesson.id} has no theoryConceptId`);
        } else {
          const concept = conceptById.get(lesson.theoryConceptId);
          if (concept && concept.questions.length === 0) {
            problems.push(`theory-quiz lesson ${lesson.id} uses concept ${concept.id} with no questions`);
          }
        }
        break;
      }
      default:
        // Mini-game-typed exercises need generator parameters.
        if (!lesson.generatorParams) {
          problems.push(`${lesson.exerciseType} lesson ${lesson.id} has no generatorParams`);
        }
    }

    if (lesson.mode === 'independent') {
      for (const a of lesson.assistOptions) {
        if ((VISUAL_ASSISTS as readonly string[]).includes(a)) {
          problems.push(`independent lesson ${lesson.id} may not offer visual assist '${a}'`);
        }
      }
    }
    if (lesson.mode === 'performance' && lesson.assistOptions.length > 0) {
      problems.push(`performance lesson ${lesson.id} must have empty assistOptions`);
    }

    // Scouting fragments stay within +1 tier of the module — except flagged
    // stretch-song Boss Challenges (doc 06 §5.3), which are exploration-only.
    if (lesson.mode === 'scouting' && !lesson.stretchBoss && lesson.fragmentId && module) {
      const fragment = fragmentById.get(lesson.fragmentId);
      const sourceSong = fragment ? songById.get(fragment.sourceSongId) : undefined;
      if (sourceSong && sourceSong.tier > module.tier + 1) {
        problems.push(
          `scouting lesson ${lesson.id} uses a fragment from tier-${sourceSong.tier} song ${sourceSong.id}, above the module tier ${module.tier} + 1 cap`,
        );
      }
    }
    if (lesson.stretchBoss && lesson.mode !== 'scouting') {
      problems.push(`stretch-boss lesson ${lesson.id} must use mode 'scouting'`);
    }
  }

  // ── Lesson-order feasibility (skills' prerequisites taught first) ─────────
  const firstTaughtAt = new Map<string, { moduleId: string; index: number }>();
  for (const module of raw.modules) {
    module.lessonIds.forEach((lid, i) => {
      const lesson = lessonById.get(lid);
      if (!lesson) return;
      for (const sid of lesson.skillIds) {
        if (!firstTaughtAt.has(sid)) firstTaughtAt.set(sid, { moduleId: module.id, index: i });
      }
    });
  }
  for (const module of raw.modules) {
    const upstream = transitivePrereqModules(module, moduleById);
    module.lessonIds.forEach((lid, i) => {
      const lesson = lessonById.get(lid);
      if (!lesson) return;
      for (const sid of lesson.skillIds) {
        const skill = skillById.get(sid);
        if (!skill) continue;
        for (const pre of skill.prerequisites) {
          const taught = firstTaughtAt.get(pre);
          if (!taught) {
            problems.push(
              `Lesson ${lid} uses skill ${sid} whose prerequisite ${pre} is not taught by any lesson`,
            );
          } else if (taught.moduleId === module.id) {
            if (taught.index >= i) {
              problems.push(
                `Lesson ${lid} uses skill ${sid} before its prerequisite ${pre} is taught (later in module ${module.id})`,
              );
            }
          } else if (!upstream.has(taught.moduleId)) {
            problems.push(
              `Lesson ${lid} (module ${module.id}) uses skill ${sid} whose prerequisite ${pre} is taught in ${taught.moduleId}, which is not a prerequisite module`,
            );
          }
        }
      }
    });
  }

  // ── Tier gates ─────────────────────────────────────────────────────────────
  const gateTiers = new Set(raw.tierGates.map((g) => g.tier));
  for (const module of raw.modules) {
    if (!gateTiers.has(module.tier)) {
      problems.push(`Tier ${module.tier} has modules but no tier gate`);
    }
  }
  for (const gate of raw.tierGates) {
    if (gate.coreSkillIds.length === 0) {
      problems.push(`Tier gate ${gate.tier} has no core skills`);
    }
    for (const sid of gate.coreSkillIds) {
      const skill = skillById.get(sid);
      if (!skill) {
        problems.push(`Tier gate ${gate.tier} lists missing core skill ${sid}`);
      } else if (skill.tier > gate.tier) {
        problems.push(`Tier gate ${gate.tier} core skill ${sid} sits at higher tier ${skill.tier}`);
      }
    }
    // Every gate core skill must be Hands-masterable: exercises cap below the
    // mastery threshold, so a reachable song must teach (taughtSkills) it.
    for (const sid of gate.coreSkillIds) {
      const teachable = raw.songs.some(
        (s) => s.tier <= gate.tier && s.taughtSkills.includes(sid),
      );
      if (!teachable) {
        problems.push(
          `Tier gate ${gate.tier} core skill ${sid} is not taught by any song at tier ≤ ${gate.tier} — Hands mastery is unreachable (exercises cap at 0.8)`,
        );
      }
    }

    const bossChart = raw.charts.find((c) => c.id === gate.bossChartId);
    if (bossChart && (bossChart.sections?.length ?? 0) < 2) {
      problems.push(
        `Tier gate ${gate.tier} boss chart ${gate.bossChartId} needs at least 2 sections (SongMastery transitions)`,
      );
    }
    const bossSong = songById.get(gate.bossSongId);
    if (!bossSong) {
      problems.push(`Tier gate ${gate.tier} references missing boss song ${gate.bossSongId}`);
    } else {
      if (!chartIds.has(gate.bossChartId)) {
        problems.push(`Tier gate ${gate.tier} references missing boss chart ${gate.bossChartId}`);
      } else if (!bossSong.chartIds.includes(gate.bossChartId)) {
        problems.push(
          `Tier gate ${gate.tier} boss chart ${gate.bossChartId} does not belong to boss song ${gate.bossSongId}`,
        );
      }
      // Boss must be playable by the skills available at or below the gate tier.
      for (const req of bossSong.requiredSkills) {
        const skill = skillById.get(req);
        if (skill && skill.tier > gate.tier) {
          problems.push(
            `Tier gate ${gate.tier} boss song ${bossSong.id} requires tier-${skill.tier} skill ${req} — unplayable at this gate`,
          );
        }
      }
    }
    if (gate.checkpointAssessmentIds.length === 0) {
      problems.push(`Tier gate ${gate.tier} has no theory/ear checkpoint assessment`);
    }
    for (const aid of gate.checkpointAssessmentIds) {
      const assessment = assessmentById.get(aid);
      if (!assessment) {
        problems.push(`Tier gate ${gate.tier} references missing assessment ${aid}`);
        continue;
      }
      const lesson = lessonById.get(assessment.lessonId);
      if (!lesson) {
        problems.push(`Assessment ${aid} references missing lesson ${assessment.lessonId}`);
      } else if (lesson.mode !== 'independent' && lesson.mode !== 'performance') {
        problems.push(
          `Tier-gate assessment ${aid} is administered by ${lesson.id} with mode '${lesson.mode}' — checkpoints must be independent or performance`,
        );
      }
    }
    if (gate.handsXpBand <= 0) {
      problems.push(`Tier gate ${gate.tier} has a non-positive handsXpBand`);
    }
  }

  // ── Assessments & theory concepts ─────────────────────────────────────────
  for (const a of raw.assessments) {
    if (!lessonById.has(a.lessonId)) {
      problems.push(`Assessment ${a.id} references missing lesson ${a.lessonId}`);
    }
    if (a.scope === 'skill' && (!a.skillId || !skillById.has(a.skillId))) {
      problems.push(`Skill assessment ${a.id} has a missing or unknown skillId`);
    }
    if (a.scope === 'tier' && a.tier === undefined) {
      problems.push(`Tier assessment ${a.id} has no tier`);
    }
    if (a.passScorePct <= 0 || a.passScorePct > 1) {
      problems.push(`Assessment ${a.id} has out-of-range passScorePct ${a.passScorePct}`);
    }
    for (const rid of a.remediationLessonIds) {
      if (!lessonById.has(rid)) {
        problems.push(`Assessment ${a.id} lists missing remediation lesson ${rid}`);
      }
    }
  }
  for (const t of raw.theoryConcepts) {
    for (const sid of t.linkedSkillIds) {
      if (!skillById.has(sid)) problems.push(`Theory concept ${t.id} links missing skill ${sid}`);
    }
    for (const songId of t.linkedSongIds) {
      if (!songById.has(songId)) problems.push(`Theory concept ${t.id} links missing song ${songId}`);
    }
    t.questions.forEach((q) => {
      if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
        problems.push(`Theory question ${q.id} (${t.id}) has out-of-range answerIndex`);
      }
    });
  }

  return problems;
}
