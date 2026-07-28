import { useState, type ReactNode } from 'react';
import { Brain, Check, ChevronDown, ChevronRight, Circle, Flag, Hand, RefreshCcw, Zap } from 'lucide-react';
import type { Skill } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { isHandsMastered, isHeadMastered } from '@/core/progression/progressionService';
import { GateRing, gateRingSegments } from '@/ui/components/GateRing';
import { LockPip } from '@/ui/components/LockPip';
import { ProgressBar } from '@/ui/components/ProgressBar';
import { SongMasteryCard } from './SongMasteryCard';

export function Progress() {
  const content = getContent();
  const player = useGameStore((s) => s.player);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const gateStatus = useGameStore((s) => s.tierGateStatus)();

  const lockedSongs = content.songs.filter((s) => s.requiredSkills.length > 0);
  const band = gateStatus?.handsXp.band ?? 100;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Your progress</h2>

      {/* Gate ring + the advancement checklist — the honest centerpiece. The
          checklist doubles as the ring's legend: five segments, five items. */}
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <GateRing
              level={player.learningTier}
              segments={gateRingSegments(gateStatus)}
              size={104}
            />
            <div className="text-center text-xs text-ink-soft">
              <div className="font-medium tabular-nums text-ink">
                {player.tierHandsXP} / {band} tier XP
              </div>
              The ring&rsquo;s five segments are the five items beside it —
              <br />
              full ring = level up.
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-semibold text-ink">
              Advancing to Level {player.learningTier + 1}
            </h3>
            <p className="mb-3 mt-0.5 text-xs text-ink-soft">
              XP alone never levels you up — every item below must be earned. Done items stay as
              evidence of what you can play.
            </p>
            {gateStatus ? (
              <ul className="flex flex-col gap-1.5">
                <ChecklistItem
                  done={gateStatus.handsXp.reached}
                  label={`Practice XP band (${gateStatus.handsXp.current}/${gateStatus.handsXp.band} Hands XP this tier)`}
                  todo="Keep completing and reviewing lessons"
                />
                <ChecklistItem
                  done={gateStatus.coreSkills.every((s) => s.mastered)}
                  label={`Core skills Hands-mastered — ${gateStatus.coreSkills.filter((s) => s.mastered).length} of ${gateStatus.coreSkills.length}`}
                  todo={`These ${gateStatus.coreSkills.length} gate the level (the tier may list more): ${gateStatus.coreSkills
                    .filter((s) => !s.mastered)
                    .map((s) => content.getSkill(s.skillId)?.name ?? s.skillId)
                    .join(', ')}`}
                />
                <ChecklistItem
                  done={gateStatus.bossPassed}
                  label="Boss song mastery star"
                  todo="Three stars, at tempo, no assists on the tier boss"
                  icon={<Flag size={13} />}
                />
                <ChecklistItem
                  done={gateStatus.checkpoints.every((c) => c.passed)}
                  label="Theory & ear checkpoint (80%+)"
                  todo="Pass the tier check quiz in Missions"
                />
                {gateStatus.delayedReviewRequired ? (
                  <ChecklistItem
                    done={gateStatus.delayedReviewPassed}
                    label="One older skill reviewed after a delay"
                    todo="Come back another day and pass a review"
                    icon={<RefreshCcw size={13} />}
                  />
                ) : (
                  <li className="rounded-2xl border border-dashed border-line px-3 py-2 text-xs text-ink-soft">
                    Through Tier 3 you can level up in a single sitting. From Tier 4, advancing
                    also takes practice on separate days — that&rsquo;s when daily practice
                    becomes the path.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">
                You&rsquo;ve passed every authored tier gate — more tiers are on the way.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Zap size={16} />} label="Level" value={player.learningTier} />
        <Stat icon={<Hand size={16} />} label="Hands XP (lifetime)" value={player.totalXP} />
        <Stat icon={<Brain size={16} />} label="Head XP" value={player.headTrackXP} />
      </div>

      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <h3 className="mb-1 font-display text-sm font-semibold text-ink">Hands and Head</h3>
        <p className="text-xs text-ink-soft">
          <span className="font-medium text-ink">Hands XP</span> comes from playing and fills the
          Level meter. <span className="font-medium text-ink">Head XP</span> comes from ear &amp;
          theory work — it opens Head locks and deepens knowledge, but only your hands can raise
          your level or unlock songs.
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
        <h3 className="mb-3 font-display text-sm font-semibold text-ink">Skills (two locks)</h3>
        <div className="flex flex-col gap-2">
          {(() => {
            // Contiguous tier rows: an authored gap (e.g. no tier-9 skills yet)
            // gets an honest placeholder instead of silently vanishing.
            const authored = new Set(content.skills.map((s) => s.tier));
            const maxTier = Math.max(...authored);
            return Array.from({ length: maxTier }, (_, i) => i + 1).map((tier) =>
              authored.has(tier) ? (
                <TierSkillGroup
                  key={tier}
                  tier={tier}
                  skills={content.skills.filter((s) => s.tier === tier)}
                  defaultOpen={tier === player.learningTier}
                />
              ) : (
                <div
                  key={tier}
                  className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-ink-soft"
                >
                  <span className="font-display font-semibold">Tier {tier}</span>
                  <span className="text-xs">no skills to learn here yet</span>
                </div>
              ),
            );
          })()}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          A skill goes gold only when both locks open. Ear &amp; theory lessons open the Head lock;
          playing at tempo, unassisted, opens the Hands lock.
        </p>
      </div>

      <SongMasteryCard />

      {lockedSongs.length > 0 && (
        <div className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
          <h3 className="mb-3 font-display text-sm font-semibold text-ink">Next unlocks</h3>
          <div className="flex flex-col gap-3">
            {lockedSongs.map((song) => {
              const prog = unlockProgress(song);
              return (
                <div key={song.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={prog.unlocked ? 'font-medium text-mint-deep' : 'text-ink'}>
                      {song.title} {prog.unlocked && '· unlocked'}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {prog.masteredCount}/{prog.requiredCount} skills
                    </span>
                  </div>
                  <ProgressBar fraction={prog.masteredCount / prog.requiredCount} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TierSkillGroup({
  tier,
  skills,
  defaultOpen,
}: {
  tier: number;
  skills: readonly Skill[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const skillProgressById = useGameStore((s) => s.skillProgressById);
  const masteredCount = skills.filter((s) => {
    const p = skillProgressById.get(s.id);
    return p !== undefined && isHandsMastered(p);
  }).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-sand px-4 py-2.5 text-left"
      >
        <span className="font-display text-sm font-semibold text-ink">Tier {tier}</span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          {masteredCount}/{skills.length} mastered
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {open && (
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {skills.map((skill) => {
            const p = skillProgressById.get(skill.id);
            const hands = p ? isHandsMastered(p) : false;
            const head = p ? isHeadMastered(p) : false;
            return (
              <div
                key={skill.id}
                className="flex items-center justify-between rounded-2xl bg-sand px-3 py-2"
              >
                <div>
                  <div className="text-sm text-ink">{skill.name}</div>
                  <div className="text-xs capitalize text-ink-soft">{skill.genre}</div>
                </div>
                <div className="flex items-center gap-2">
                  <LockPip on={hands} icon={<Hand size={13} />} title="Hands (play it)" />
                  <LockPip on={head} icon={<Brain size={13} />} title="Head (know it)" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  todo,
  icon,
}: {
  done: boolean;
  label: string;
  todo: string;
  icon?: ReactNode;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 rounded-2xl px-3 py-2 ${
        done ? 'bg-mint-soft/40' : 'bg-sand'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-mint-soft text-mint-deep' : 'bg-surface text-ink-soft'
        }`}
      >
        {done ? <Check size={12} /> : (icon ?? <Circle size={10} />)}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${done ? 'text-ink-soft' : 'font-medium text-ink'}`}>
          {label}
        </span>
        {!done && todo && <span className="block text-xs text-ink-soft">{todo}</span>}
      </span>
    </li>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-surface px-4 py-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-ink-soft">{icon}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-ink-soft">{label}</div>
    </div>
  );
}

