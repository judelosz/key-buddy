import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Play,
  PlayCircle,
  Pause,
  RotateCcw,
  Square,
  Music,
  Eye,
  EyeOff,
  ChevronLeft,
  FileMusic,
} from 'lucide-react';
import type { Assist, Attempt, Chart, NoteGrade, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { useGameStore } from '@/ui/store/gameStore';
import type { AttemptReward } from '@/core/session/recordAttempt';
import { PlaySession, type PlayPhase, type PlayMode } from '@/ui/session/playSession';
import { audioService } from '@/audio/audioService';
import { FallingNotes } from '@/ui/components/FallingNotes';
import { displayRange } from '@/core/pianoLayout';
import { ChordSymbols } from '@/ui/components/ChordSymbols';
import { StaffNotation } from '@/ui/components/StaffNotation';
import { SessionReport } from '@/ui/components/SessionReport';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';
import { KeyboardHint } from '@/ui/components/KeyboardHint';
import { MidiConnectButton } from '@/ui/components/MidiConnectButton';

const COUNT_IN_BEATS = 4;
const TEMPO_OPTIONS = [
  { label: '50%', pct: 0.5 },
  { label: '75%', pct: 0.75 },
  { label: '100%', pct: 1 },
];

/**
 * Real-time per-hit verdict copy + styling (doc 03 §3.3 "in-the-moment").
 * Only the celebratory top ("Perfect!") and the missed-the-mark grades flash a
 * pill — a solid green note (great) already says "you played it", so it stays
 * quiet and the pills keep their signal value: amber/peri = adjust something.
 */
const LIVE_FLASH: Partial<Record<NoteGrade, { label: string; style: string }>> = {
  perfect: { label: 'Perfect!', style: 'bg-mint-deep text-white' },
  good: { label: 'A little off', style: 'bg-amber-soft text-amber-ink' },
  early: { label: 'Early', style: 'bg-peri-soft text-peri-ink' },
  late: { label: 'Late', style: 'bg-peri-soft text-peri-ink' },
};
const LIVE_FLASH_MS = 750;

/**
 * How a lesson (or Free Play) is allowed to configure a take. The policy is
 * derived from the lesson mode — guided lessons force assists on, independent
 * and performance lessons force them off — so a checkpoint can't silently
 * become an assisted take.
 */
export interface ChartPlayerPolicy {
  /** 'choice' shows the tempo control; a number pins tempo to that fraction of target. */
  tempo: 'choice' | number;
  /** Falling-notes assist: user toggle, forced on (guided), or forced off (independent+). */
  fallingNotes: 'choice' | 'on' | 'off';
  /** Show the Watch/preview button. */
  allowWatch: boolean;
  /** Allow switching arrangements (Free Play). */
  allowArrangementChoice: boolean;
}

export const FREE_PLAY_POLICY: ChartPlayerPolicy = {
  tempo: 'choice',
  fallingNotes: 'choice',
  allowWatch: true,
  allowArrangementChoice: true,
};

export interface ChartPlayerProps {
  song: Song;
  chart: Chart;
  policy?: ChartPlayerPolicy;
  /** Back/Done navigation (leave the player). */
  onExit: () => void;
  /** Fires once per completed, recorded take (after rewards resolve). */
  onRecorded?: (attempt: Attempt, reward: AttemptReward) => void;
  /**
   * Lesson mode: the host records the attempt (via recordLesson) and shows its
   * own result screen. When set, ChartPlayer neither records nor renders the
   * SessionReport — it hands the raw Attempt over exactly once.
   */
  onAttemptCaptured?: (attempt: Attempt) => void;
  /** Optional context banner rendered above the controls (lesson prompts). */
  banner?: ReactNode;
  /** Label for the exit button (defaults to "Songs"). */
  exitLabel?: string;
  /**
   * Hosts that render their own frame (lesson/session takeovers) set this to
   * drop the player's back-link + title row — the song meta collapses to one
   * muted line so a lesson never shows two stacked headers.
   */
  hideHeader?: boolean;
}

/**
 * The full take loop for one chart: count-in → play (metronome clock) →
 * offline scoring → session report. Extracted from the Phase-2 SessionPlayer
 * so Free Play and curriculum lessons share one player.
 */
export function ChartPlayer({
  song,
  chart: initialChart,
  policy = FREE_PLAY_POLICY,
  onExit,
  onRecorded,
  onAttemptCaptured,
  banner,
  exitLabel = 'Songs',
  hideHeader = false,
}: ChartPlayerProps) {
  const content = getContent();
  const [chart, setChart] = useState<Chart>(initialChart);
  const [tempoPct, setTempoPct] = useState(policy.tempo === 'choice' ? 0.75 : policy.tempo);
  const [showFalling, setShowFalling] = useState(policy.fallingNotes !== 'off');
  const [showStaff, setShowStaff] = useState(false);
  const [phase, setPhase] = useState<PlayPhase>('idle');
  const [mode, setMode] = useState<PlayMode>('play');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [reward, setReward] = useState<AttemptReward | null>(null);
  const [currentBar, setCurrentBar] = useState(-1);
  const [, setGradeVersion] = useState(0);

  const recordAttempt = useGameStore((s) => s.recordAttempt);
  const liveGradesRef = useRef<Map<string, NoteGrade>>(new Map());
  const sessionRef = useRef<PlaySession | null>(null);
  const recordedIdRef = useRef<string | null>(null);
  /** The most recent hit's verdict, flashed near the hit line. */
  const [liveFlash, setLiveFlash] = useState<{ grade: NoteGrade; seq: number } | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = new PlaySession({
      onPhase: (p) => {
        // EVERY take begins with a count-in (including mid-take Restart, which
        // bypasses start()) — wipe the previous pass's grade colors here so no
        // attempt ever starts wearing the last one's feedback.
        if (p === 'count-in') {
          liveGradesRef.current = new Map();
          setGradeVersion((v) => v + 1);
          setLiveFlash(null);
        }
        setPhase(p);
      },
      onLiveGrade: (g) => {
        liveGradesRef.current.set(g.noteEventId, g.grade);
        setGradeVersion((v) => v + 1);
        if (LIVE_FLASH[g.grade]) {
          setLiveFlash((prev) => ({ grade: g.grade, seq: (prev?.seq ?? 0) + 1 }));
          if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = window.setTimeout(() => setLiveFlash(null), LIVE_FLASH_MS);
        } else if (flashTimeoutRef.current === null) {
          // A quiet grade with no pill pending — make sure nothing stale shows.
          setLiveFlash(null);
        }
      },
      onComplete: setAttempt,
    });
  }

  // Re-arm when the host swaps songs/charts under us.
  useEffect(() => {
    setChart(initialChart);
    setAttempt(null);
    setPhase('idle');
    liveGradesRef.current = new Map();
  }, [initialChart]);

  const beatsPerBar = chart.timeSignature.beatsPerBar;
  const range = useMemo(() => {
    const pitches = chart.notes.flatMap((n) => n.pitches);
    return displayRange(Math.min(...pitches), Math.max(...pitches));
  }, [chart]);

  // Track the current bar for the chord strip while playing.
  useEffect(() => {
    if (phase !== 'playing') return;
    const beatMs = 60000 / (song.tempoTargetBPM * tempoPct);
    const id = window.setInterval(() => {
      const beat = (audioService.getTransportSeconds() * 1000) / beatMs - COUNT_IN_BEATS;
      setCurrentBar(Math.floor(beat / beatsPerBar));
    }, 120);
    return () => window.clearInterval(id);
  }, [phase, song, tempoPct, beatsPerBar]);

  const pickArrangement = useCallback((chartId: string) => {
    const c = getContent().getChart(chartId);
    if (!c) return;
    setChart(c);
    setAttempt(null);
    liveGradesRef.current = new Map();
  }, []);

  const start = useCallback(
    async (playMode: PlayMode = 'play') => {
      liveGradesRef.current = new Map();
      setAttempt(null);
      setReward(null);
      setCurrentBar(-1);
      setMode(playMode);
      const assists: Assist[] = showFalling ? ['falling-notes'] : [];
      await sessionRef.current!.start({
        chart,
        targetTempoBPM: song.tempoTargetBPM,
        tempoBPM: Math.round(song.tempoTargetBPM * tempoPct),
        tier: song.tier,
        beatsPerBar: chart.timeSignature.beatsPerBar,
        countInBeats: COUNT_IN_BEATS,
        assists,
        mode: playMode,
        feel: chart.feel ?? song.feel,
      });
    },
    [song, chart, tempoPct, showFalling, policy.tempo],
  );

  // Record the completed take into progression/rewards/persistence exactly
  // once — unless a lesson host captures the attempt and records it itself.
  useEffect(() => {
    if (phase === 'done' && attempt && recordedIdRef.current !== attempt.id) {
      recordedIdRef.current = attempt.id;
      if (onAttemptCaptured) {
        onAttemptCaptured(attempt);
        return;
      }
      void recordAttempt(song, chart, attempt).then((r) => {
        setReward(r);
        onRecorded?.(attempt, r);
      });
    }
  }, [phase, attempt, song, chart, recordAttempt, onRecorded, onAttemptCaptured]);

  useEffect(
    () => () => {
      sessionRef.current?.cancel();
      if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  if (phase === 'done' && attempt && !onAttemptCaptured) {
    return (
      <SessionReport
        attempt={attempt}
        chart={chart}
        song={song}
        reward={reward}
        onRetry={() => void start()}
        onDone={onExit}
      />
    );
  }

  // "active" = a session is running (incl. paused): lock the setup controls
  // and keep the visualizer drawing.
  const active = phase !== 'idle' && phase !== 'done';
  const session = sessionRef.current;
  const showTempoControl = policy.tempo === 'choice';
  const showFallingToggle = policy.fallingNotes === 'choice';

  return (
    <div className="flex flex-col gap-4">
      {hideHeader ? (
        <p className="text-xs text-ink-soft">
          {song.title} · {song.genre} · {chart.arrangementLevel} · target {song.tempoTargetBPM} BPM
        </p>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sessionRef.current?.cancel();
              onExit();
            }}
            className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          >
            <ChevronLeft size={16} /> {exitLabel}
          </button>
          <div className="text-right">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{song.title}</h2>
            <p className="text-xs text-ink-soft">
              {song.genre} · tier {song.tier} · {chart.arrangementLevel} · target {song.tempoTargetBPM} BPM
            </p>
          </div>
        </div>
      )}

      {banner}

      <div className="flex flex-wrap items-center gap-3">
        {policy.allowArrangementChoice && song.chartIds.length > 1 && (
          <div className="inline-flex rounded-full bg-sand p-1 text-sm">
            {song.chartIds.map((cid) => {
              const c = content.getChart(cid);
              if (!c) return null;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={active}
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

        {showTempoControl && (
          <div className="inline-flex overflow-hidden rounded-2xl border border-line text-sm">
            {TEMPO_OPTIONS.map((t) => (
              <button
                key={t.label}
                type="button"
                disabled={active}
                onClick={() => setTempoPct(t.pct)}
                className={`rounded-full px-3 py-1.5 tabular-nums transition ${
                  tempoPct === t.pct ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {showFallingToggle && (
          <button
            type="button"
            disabled={active}
            onClick={() => setShowFalling((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
              showFalling ? 'bg-peri-soft text-peri-ink' : 'bg-sand text-ink-soft'
            }`}
            title="The falling-notes view is scaffolding — turn it off for the mastery star."
          >
            {showFalling ? <Eye size={15} /> : <EyeOff size={15} />}
            Falling notes {showFalling ? 'on' : 'off'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowStaff((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
            showStaff ? 'bg-peri-soft text-peri-ink' : 'bg-sand text-ink-soft'
          }`}
        >
          <FileMusic size={15} /> Staff
        </button>

        <div className="ml-auto flex items-center gap-2">
          <MidiConnectButton compact />

          {!active && (
            <>
              {policy.allowWatch && (
                <button
                  type="button"
                  onClick={() => void start('preview')}
                  className="inline-flex items-center gap-2 rounded-full bg-peri-soft px-4 py-2.5 font-display text-sm font-semibold text-peri-ink transition hover:-translate-y-px active:translate-y-px"
                  title="Watch and hear the song play through first, without scoring."
                >
                  <PlayCircle size={16} /> Watch
                </button>
              )}
              <button
                type="button"
                onClick={() => void start('play')}
                className="inline-flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px"
              >
                <Play size={16} className="fill-ink" /> Play
              </button>
            </>
          )}

          {mode === 'preview' && active && (
            <button
              type="button"
              onClick={() => session?.cancel()}
              className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
            >
              <Square size={15} /> Stop
            </button>
          )}

          {mode === 'play' && active && (
            <>
              <button
                type="button"
                onClick={() => session?.restart()}
                className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2.5 font-display text-sm font-semibold text-ink transition hover:-translate-y-px active:translate-y-px"
              >
                <RotateCcw size={15} /> Restart
              </button>
              {phase === 'paused' ? (
                <button
                  type="button"
                  onClick={() => session?.resume()}
                  className="inline-flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px active:translate-y-px"
                >
                  <Play size={16} className="fill-ink" /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => session?.pause()}
                  className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px active:translate-y-px"
                >
                  <Pause size={15} /> Pause
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <ChordSymbols chart={chart} currentBar={currentBar} />

      {showStaff && <StaffNotation chart={chart} />}

      {phase === 'count-in' && mode === 'play' && (
        <p className="text-center font-display text-sm font-medium text-amber-ink">
          Count-in — start on the next bar.
        </p>
      )}
      {mode === 'preview' && active && (
        <p className="text-center font-display text-sm font-medium text-peri-ink">
          Preview — watch and listen, then hit Play when you&rsquo;re ready.
        </p>
      )}
      {phase === 'paused' && (
        <p className="text-center font-display text-sm font-medium text-ink-soft">Paused</p>
      )}

      {!active && <KeyboardHint />}

      {/* Falling notes and the keyboard share one full-width container and the
          same pitch range, so each note drops straight onto its key. */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        {/* Real-time verdict for the last hit — feedback, not an assist: it
            never shows what to play, only how the note landed. */}
        {liveFlash && LIVE_FLASH[liveFlash.grade] && phase === 'playing' && mode === 'play' && (
          <div
            key={liveFlash.seq}
            className="pointer-events-none absolute right-5 z-10 animate-pop"
            style={{ bottom: 176 }}
          >
            <span
              className={`rounded-full px-3.5 py-1.5 font-display text-sm font-semibold shadow-soft ${LIVE_FLASH[liveFlash.grade]!.style}`}
            >
              {LIVE_FLASH[liveFlash.grade]!.label}
            </span>
          </div>
        )}
        {showFalling ? (
          <FallingNotes
            chart={chart}
            tempoBPM={song.tempoTargetBPM * tempoPct}
            countInBeats={COUNT_IN_BEATS}
            lowPitch={range.low}
            highPitch={range.high}
            liveGradesRef={liveGradesRef}
            active={active}
            feel={chart.feel ?? song.feel}
          />
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-ink-soft">
            <Music size={16} className="mr-2" /> Falling notes hidden — play by ear and chord symbols.
          </div>
        )}
        <div className="border-t border-line pb-2 pt-1">
          <PianoKeyboard lowPitch={range.low} highPitch={range.high} />
        </div>
      </div>
    </div>
  );
}
