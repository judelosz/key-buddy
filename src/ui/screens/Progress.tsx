import type { ReactNode } from 'react';
import { Zap, Coins, Flame, TrendingUp, Brain, Hand } from 'lucide-react';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import { isHandsMastered, isHeadMastered } from '@/core/progression/progressionService';
import { levelForXpBounds } from '@/core/rewards/rewardService';

export function Progress() {
  const content = getContent();
  const player = useGameStore((s) => s.player);
  const skillProgressById = useGameStore((s) => s.skillProgressById);
  const unlockProgress = useGameStore((s) => s.unlockProgress);

  const { intoLevel, span } = levelForXpBounds(player.totalXP, player.playerLevel);
  const lockedSongs = content.songs.filter((s) => s.requiredSkills.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold tracking-tight">Your progress</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<TrendingUp size={16} />} label="Playing tier" value={player.currentPlayingTier} />
        <Stat icon={<Zap size={16} />} label="Player level" value={player.playerLevel} />
        <Stat icon={<Coins size={16} />} label="Riffs" value={player.riffs} />
        <Stat icon={<Flame size={16} />} label="Streak" value={`${player.streak}d`} />
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-neutral-300">Level {player.playerLevel}</span>
          <span className="text-neutral-500">
            {player.totalXP} XP total · {span - intoLevel} to level {player.playerLevel + 1}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink">
          <div
            className="h-full rounded-full bg-grade-perfect"
            style={{ width: `${Math.round((intoLevel / span) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Level &amp; tier come from your playing (Hands) only — AFK/theory fills the Head track
          separately.
        </p>
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <h3 className="mb-3 text-sm font-medium text-neutral-300">Skills (two locks)</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {content.skills.map((skill) => {
            const p = skillProgressById.get(skill.id);
            const hands = p ? isHandsMastered(p) : false;
            const head = p ? isHeadMastered(p) : false;
            return (
              <div
                key={skill.id}
                className="flex items-center justify-between rounded-lg bg-ink px-3 py-2"
              >
                <div>
                  <div className="text-sm text-neutral-200">{skill.name}</div>
                  <div className="text-xs text-neutral-500">
                    {skill.genre} · tier {skill.tier}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LockPip on={hands} icon={<Hand size={13} />} title="Hands (play it)" />
                  <LockPip on={head} icon={<Brain size={13} />} title="Head (know it)" />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          A skill goes gold only when both locks open. The Head lock opens in Woodshed/AFK mode
          (coming soon).
        </p>
      </div>

      {lockedSongs.length > 0 && (
        <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Next unlocks</h3>
          <div className="flex flex-col gap-3">
            {lockedSongs.map((song) => {
              const prog = unlockProgress(song);
              return (
                <div key={song.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={prog.unlocked ? 'text-grade-perfect' : 'text-neutral-300'}>
                      {song.title} {prog.unlocked && '· unlocked'}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {prog.masteredCount}/{prog.requiredCount} skills
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                    <div
                      className="h-full rounded-full bg-grade-good/70"
                      style={{ width: `${Math.round((prog.masteredCount / prog.requiredCount) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-ink-soft border border-ink-line px-4 py-3">
      <div className="flex items-center gap-1.5 text-neutral-400">{icon}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function LockPip({ on, icon, title }: { on: boolean; icon: ReactNode; title: string }) {
  return (
    <span
      title={title}
      className={`flex h-6 w-6 items-center justify-center rounded-full ${
        on ? 'bg-grade-perfect/20 text-grade-perfect' : 'bg-ink-line text-neutral-600'
      }`}
    >
      {icon}
    </span>
  );
}
