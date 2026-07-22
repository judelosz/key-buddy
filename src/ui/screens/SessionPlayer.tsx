import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Music, Eye, EyeOff, ChevronLeft, FileMusic } from 'lucide-react';
import type { Assist, Attempt, Chart, NoteGrade, Song } from '@/core/types';
import { getContent } from '@/core/content/bundled';
import { PlaySession, type PlayPhase } from '@/ui/session/playSession';
import { audioService } from '@/audio/audioService';
import { FallingNotes } from '@/ui/components/FallingNotes';
import { ChordSymbols } from '@/ui/components/ChordSymbols';
import { StaffNotation } from '@/ui/components/StaffNotation';
import { SessionReport } from '@/ui/components/SessionReport';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

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
  const [currentBar, setCurrentBar] = useState(-1);
  const [, setGradeVersion] = useState(0);

  const liveGradesRef = useRef<Map<string, NoteGrade>>(new Map());
  const sessionRef = useRef<PlaySession | null>(null);

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
          className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
        >
          <ChevronLeft size={16} /> Songs
        </button>
        <div className="text-right">
          <h2 className="font-semibold tracking-tight">{song.title}</h2>
          <p className="text-xs text-neutral-500">
            {song.genre} · tier {song.tier} · {chart.arrangementLevel} · target {song.tempoTargetBPM} BPM
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {song.chartIds.length > 1 && (
          <div className="inline-flex overflow-hidden rounded-lg border border-ink-line text-sm">
            {song.chartIds.map((cid) => {
              const c = content.getChart(cid);
              if (!c) return null;
              return (
                <button
                  key={cid}
                  type="button"
                  disabled={playing}
                  onClick={() => pickArrangement(cid)}
                  className={`px-3 py-1.5 capitalize ${
                    chart.id === cid ? 'bg-ink-line text-neutral-100' : 'text-neutral-400'
                  }`}
                >
                  {c.arrangementLevel}
                </button>
              );
            })}
          </div>
        )}

        <div className="inline-flex overflow-hidden rounded-lg border border-ink-line text-sm">
          {TEMPO_OPTIONS.map((t) => (
            <button
              key={t.label}
              type="button"
              disabled={playing}
              onClick={() => setTempoPct(t.pct)}
              className={`px-3 py-1.5 tabular-nums ${
                tempoPct === t.pct ? 'bg-ink-line text-neutral-100' : 'text-neutral-400'
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
          className="inline-flex items-center gap-2 rounded-lg border border-ink-line px-3 py-1.5 text-sm text-neutral-300"
          title="The falling-notes view is scaffolding — turn it off for the mastery star."
        >
          {showFalling ? <Eye size={15} /> : <EyeOff size={15} />}
          Falling notes {showFalling ? 'on' : 'off'}
        </button>

        <button
          type="button"
          onClick={() => setShowStaff((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border border-ink-line px-3 py-1.5 text-sm ${
            showStaff ? 'text-neutral-100' : 'text-neutral-400'
          }`}
        >
          <FileMusic size={15} /> Staff
        </button>

        <button
          type="button"
          disabled={playing}
          onClick={() => void start()}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-grade-perfect px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          <Play size={16} /> {phase === 'count-in' ? 'Get ready…' : 'Play'}
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
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-ink-line text-sm text-neutral-500">
          <Music size={16} className="mr-2" /> Falling notes hidden — play by ear and chord symbols.
        </div>
      )}

      {phase === 'count-in' && (
        <p className="text-center text-sm text-grade-good">Count-in — start on the next bar.</p>
      )}

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <PianoKeyboard />
      </div>
    </div>
  );
}

function SongPicker({ songs, onPick }: { songs: Song[]; onPick: (s: Song) => void }) {
  const byTier = useMemo(() => [...songs].sort((a, b) => a.tier - b.tier), [songs]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Play a song</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a chart. Connect your MIDI keyboard or use the on-screen keys.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {byTier.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-ink-line bg-ink-soft p-4 text-left transition-colors hover:border-neutral-600"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{s.title}</h3>
              <span className="rounded bg-ink px-2 py-0.5 text-xs text-neutral-400">T{s.tier}</span>
            </div>
            <p className="mt-1 text-xs capitalize text-neutral-500">
              {s.genre} · {s.key} · {s.tempoTargetBPM} BPM · {s.feel}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
