import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Music, Eye, EyeOff, ChevronLeft, FileMusic, Star, Lock } from 'lucide-react';
import type { Assist, Attempt, Chart, NoteGrade, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import type { AttemptReward } from '@/core/session/recordAttempt';
import { PlaySession, type PlayPhase } from '@/ui/session/playSession';
import { audioService } from '@/audio/audioService';
import { FallingNotes } from '@/ui/components/FallingNotes';
import { ChordSymbols } from '@/ui/components/ChordSymbols';
import { StaffNotation } from '@/ui/components/StaffNotation';
import { SessionReport } from '@/ui/components/SessionReport';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';

const COUNT_IN_BEATS = 4;
const TEMPO_OPTIONS = [
  { label: '50%', pct: 0.5 },
  { label: '75%', pct: 0.75 },
  { label: '100%', pct: 1 },
];

export function SessionPlayer() {
  const content = getContent();
  const [song, setSong] = useState<Song | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [tempoPct, setTempoPct] = useState(0.75);
  const [showFalling, setShowFalling] = useState(true);
  const [showStaff, setShowStaff] = useState(false);
  const [phase, setPhase] = useState<PlayPhase>('idle');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [reward, setReward] = useState<AttemptReward | null>(null);
  const [currentBar, setCurrentBar] = useState(-1);
  const [, setGradeVersion] = useState(0);

  const recordAttempt = useGameStore((s) => s.recordAttempt);
  const liveGradesRef = useRef<Map<string, NoteGrade>>(new Map());
  const sessionRef = useRef<PlaySession | null>(null);
  const recordedIdRef = useRef<string | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = new PlaySession({
      onPhase: setPhase,
      onLiveGrade: (g) => {
        liveGradesRef.current.set(g.noteEventId, g.grade);
        setGradeVersion((v) => v + 1);
      },
      onComplete: setAttempt,
    });
  }

  const beatsPerBar = chart?.timeSignature.beatsPerBar ?? 4;

  // Track the current bar for the chord strip while playing.
  useEffect(() => {
    if (phase !== 'playing' || !chart) return;
    const beatMs = 60000 / ((song?.tempoTargetBPM ?? 90) * tempoPct);
    const id = window.setInterval(() => {
      const beat = (audioService.getTransportSeconds() * 1000) / beatMs - COUNT_IN_BEATS;
      setCurrentBar(Math.floor(beat / beatsPerBar));
    }, 120);
    return () => window.clearInterval(id);
  }, [phase, chart, song, tempoPct, beatsPerBar]);

  const loadSong = useCallback((s: Song) => {
    const c = getContent().getChart(s.chartIds[0]);
    setSong(s);
    setChart(c ?? null);
    setAttempt(null);
    setPhase('idle');
    liveGradesRef.current = new Map();
  }, []);

  const pickArrangement = useCallback((chartId: string) => {
    setChart(getContent().getChart(chartId) ?? null);
    setAttempt(null);
    liveGradesRef.current = new Map();
  }, []);

  const start = useCallback(async () => {
    if (!song || !chart) return;
    liveGradesRef.current = new Map();
    setAttempt(null);
    setReward(null);
    setCurrentBar(-1);
    const assists: Assist[] = showFalling ? ['falling-notes'] : [];
    await sessionRef.current!.start({
      chart,
      targetTempoBPM: song.tempoTargetBPM,
      tempoBPM: Math.round(song.tempoTargetBPM * tempoPct),
      tier: song.tier,
      beatsPerBar: chart.timeSignature.beatsPerBar,
      countInBeats: COUNT_IN_BEATS,
      assists,
    });
  }, [song, chart, tempoPct, showFalling]);

  // Record the completed take into progression/rewards/persistence exactly once.
  useEffect(() => {
    if (phase === 'done' && attempt && song && chart && recordedIdRef.current !== attempt.id) {
      recordedIdRef.current = attempt.id;
      void recordAttempt(song, chart, attempt).then(setReward);
    }
  }, [phase, attempt, song, chart, recordAttempt]);

  useEffect(() => () => sessionRef.current?.cancel(), []);

  if (!song || !chart) {
    return <SongPicker songs={[...content.songs]} onPick={loadSong} />;
  }

  if (phase === 'done' && attempt) {
    return (
      <SessionReport
        attempt={attempt}
        chart={chart}
        song={song}
        reward={reward}
        onRetry={() => void start()}
        onDone={() => {
          setSong(null);
          setChart(null);
          setPhase('idle');
        }}
      />
    );
  }

  const playing = phase === 'playing' || phase === 'count-in';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            sessionRef.current?.cancel();
            setSong(null);
            setChart(null);
          }}
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={16} /> Songs
        </button>
        <div className="text-right">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{song.title}</h2>
          <p className="text-xs text-ink-soft">
            {song.genre} · tier {song.tier} · {chart.arrangementLevel} · target {song.tempoTargetBPM} BPM
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {song.chartIds.length > 1 && (
          <div className="inline-flex rounded-full bg-sand p-1 text-sm">
            {song.chartIds.map((cid) => {
              const c = content.getChart(cid);
              if (!c) return null;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={playing}
                  onClick={() => pickArrangement(cid)}
                  className={`rounded-full px-3 py-1.5 capitalize transition ${
                    chart.id === cid ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'
                  }`}
                >
                  {c.arrangementLevel}
                </button>
              );
            })}
          </div>
        )}

        <div className="inline-flex overflow-hidden rounded-2xl border border-line text-sm">
          {TEMPO_OPTIONS.map((t) => (
            <button
              key={t.label}
              type="button"
              disabled={playing}
              onClick={() => setTempoPct(t.pct)}
              className={`rounded-full px-3 py-1.5 tabular-nums transition ${
                tempoPct === t.pct ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={playing}
          onClick={() => setShowFalling((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
            showFalling ? 'bg-peri-soft text-peri-deep' : 'bg-sand text-ink-soft'
          }`}
          title="The falling-notes view is scaffolding — turn it off for the mastery star."
        >
          {showFalling ? <Eye size={15} /> : <EyeOff size={15} />}
          Falling notes {showFalling ? 'on' : 'off'}
        </button>

        <button
          type="button"
          onClick={() => setShowStaff((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
            showStaff ? 'bg-peri-soft text-peri-deep' : 'bg-sand text-ink-soft'
          }`}
        >
          <FileMusic size={15} /> Staff
        </button>

        <button
          type="button"
          disabled={playing}
          onClick={() => void start()}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-60"
        >
          <Play size={16} className="fill-ink" /> {phase === 'count-in' ? 'Get ready…' : 'Play'}
        </button>
      </div>

      <ChordSymbols chart={chart} currentBar={currentBar} />

      {showStaff && <StaffNotation chart={chart} />}

      {showFalling ? (
        <FallingNotes
          chart={chart}
          tempoBPM={song.tempoTargetBPM * tempoPct}
          countInBeats={COUNT_IN_BEATS}
          liveGradesRef={liveGradesRef}
          active={playing}
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-line text-sm text-ink-soft">
          <Music size={16} className="mr-2" /> Falling notes hidden — play by ear and chord symbols.
        </div>
      )}

      {phase === 'count-in' && (
        <p className="text-center font-display text-sm font-medium text-amber-deep">
          Count-in — start on the next bar.
        </p>
      )}

      {!playing && <KeyboardHint />}

      <div className="rounded-3xl border border-line bg-surface shadow-soft p-4">
        <PianoKeyboard />
      </div>
    </div>
  );
}

function SongPicker({ songs, onPick }: { songs: Song[]; onPick: (s: Song) => void }) {
  const byTier = useMemo(() => [...songs].sort((a, b) => a.tier - b.tier), [songs]);
  const isUnlocked = useGameStore((s) => s.isUnlocked);
  const unlockProgress = useGameStore((s) => s.unlockProgress);
  const bestStars = useGameStore((s) => s.bestStars);
  const content = getContent();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Play a song</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Songs unlock by demonstrated skill — master the prerequisites to earn them. Connect your
          MIDI keyboard or use the on-screen keys.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {byTier.map((s) => {
          const unlocked = isUnlocked(s.id);
          const prog = unlockProgress(s);
          const stars = bestStars(s.chartIds[0]);
          return (
            <button
              key={s.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onPick(s)}
              data-testid={`song-${s.id}`}
              className={`rounded-3xl p-5 text-left transition ${
                unlocked
                  ? 'bg-surface shadow-soft hover:-translate-y-0.5 hover:shadow-lift'
                  : 'cursor-not-allowed border border-dashed border-line bg-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`font-display font-semibold ${unlocked ? 'text-ink' : 'text-ink-soft'}`}>
                  {s.title}
                </h3>
                <span className="rounded-full bg-sand px-2.5 py-0.5 font-display text-xs font-semibold text-ink-soft">
                  T{s.tier}
                </span>
              </div>
              <p className="mt-1 text-xs capitalize text-ink-soft">
                {s.genre} · {s.key} · {s.tempoTargetBPM} BPM · {s.feel}
              </p>
              {unlocked ? (
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      size={16}
                      className={n <= stars ? 'fill-amber text-amber-deep' : 'text-line'}
                    />
                  ))}
                  {stars === 0 && <span className="ml-1 text-xs text-ink-soft">Not yet played</span>}
                </div>
              ) : (
                <div className="mt-2">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Lock size={12} /> {prog.requiredCount - prog.masteredCount} skill
                    {prog.requiredCount - prog.masteredCount === 1 ? '' : 's'} to unlock:{' '}
                    {prog.remainingSkillIds
                      .map((id) => content.getSkill(id)?.name ?? id)
                      .join(', ')}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-mint-deep/70 transition-[width] duration-700"
                      style={{
                        width: `${
                          prog.requiredCount === 0
                            ? 100
                            : Math.round((prog.masteredCount / prog.requiredCount) * 100)
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
