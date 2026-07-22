/**
 * Core domain model — the single source of truth for the app's types.
 * Mirrors build-spec §5. User-state entities are persisted (IndexedDB);
 * content entities (Skill, Song, Chart, Fragment, MiniGame) ship as JSON.
 *
 * Guardrails are encoded structurally where possible (see PlayerState) and
 * enforced centrally in ProgressionService / RewardService.
 */

// ─── Shared vocabulary ──────────────────────────────────────────────────────

/** The six curriculum skill families (doc 01 §3). */
export type SkillFamily =
  | 'geography-mechanics'
  | 'rhythm-groove'
  | 'chords-voicings'
  | 'left-hand'
  | 'right-hand'
  | 'harmony-progressions';

/** Genre branches; 'foundation' is the shared trunk (doc 01 §4). */
export type Genre = 'foundation' | 'blues' | 'gospel' | 'country';

/** Difficulty tier on the 30-tier scale (doc 01 §7). 1–30. */
export type Tier = number;

/** MIDI note number, 0–127. Middle C (C4) = 60. */
export type Pitch = number;

/** Which hand plays a note; 'both' for coordination passages. */
export type Hand = 'left' | 'right' | 'both';

export type Feel = 'straight' | 'shuffle' | 'swing' | 'waltz';

export type TimeSignature = { beatsPerBar: number; beatUnit: number };

// ─── Input ──────────────────────────────────────────────────────────────────

/**
 * Source-agnostic note event emitted by InputService (build-spec §6.1).
 * 'mic' is reserved for the deferred acoustic path (§12) — not produced in v1.
 * `timestampMs` is already calibration-adjusted by the InputService.
 */
export interface NotePlayed {
  pitch: Pitch;
  velocity: number; // 0–127
  timestampMs: number; // performance-clock ms, calibrated
  source: 'midi' | 'virtual' | 'mic';
}

// ─── Content: charts & songs ────────────────────────────────────────────────

/**
 * One playable note (or chord, when `pitches` has >1) positioned on the beat
 * grid. This is what the ScoringEngine judges against and the visualizer
 * renders. Times are in beats so a chart is tempo-independent.
 */
export interface NoteEvent {
  id: string;
  pitches: Pitch[]; // 1 entry = single note; >1 = chord (all required, no extras)
  startBeat: number;
  durationBeats: number;
  hand: Hand;
}

/** The ordered, tempo-independent note data of a song arrangement. */
export interface Chart {
  id: string;
  songId: string;
  arrangementLevel: ArrangementLevel;
  timeSignature: TimeSignature;
  /** Chord symbols aligned to bars, e.g. { bar: 0, symbol: 'C7' } (primary notation). */
  chordSymbols: ChordSymbol[];
  notes: NoteEvent[];
}

export type ArrangementLevel = 'simplified' | 'full';

export interface ChordSymbol {
  bar: number;
  beat: number;
  symbol: string;
}

/** Song metadata (doc 02 §7). Content entity — shipped as JSON. */
export interface Song {
  id: string;
  title: string;
  source: string; // composer / origin
  year?: number;
  publicDomain: boolean;
  licenseNote?: string;
  genre: Genre;
  tier: Tier;
  key: string;
  tempoTargetBPM: number;
  timeSignature: TimeSignature;
  feel: Feel;
  requiredSkills: string[]; // skill IDs — gates the unlock (doc 03 §4.4)
  taughtSkills: string[];
  arrangementLevels: ArrangementLevel[];
  chartIds: string[]; // one chart per arrangement level
  fragmentIds: string[];
  backingTrackId?: string;
}

/** Extractable riff/voicing/groove from a stretch song (doc 01 §7). */
export interface Fragment {
  id: string;
  sourceSongId: string;
  label: string;
  skillTags: string[]; // skill IDs
  chart: Pick<Chart, 'timeSignature' | 'chordSymbols' | 'notes'>;
}

// ─── Content: skills ────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  family: SkillFamily;
  tier: Tier;
  genre: Genre;
  prerequisites: string[]; // skill IDs
  theoryConceptId?: string;
  description: string;
}

// ─── Content: mini-games (AFK — designed now, built Phase 5) ─────────────────

export type MiniGameType =
  | 'chord-ear'
  | 'what-changed'
  | 'interval-ear'
  | 'progression-ear'
  | 'melodic-dictation'
  | 'note-id'
  | 'build-chord'
  | 'scale-key-id'
  | 'interval-spelling'
  | 'rhythm-tap'
  | 'feel-id'
  | 'count-beats'
  | 'name-that-lick';

export interface MiniGame {
  id: string;
  type: MiniGameType;
  skillFamily: SkillFamily;
  generatorParams: Record<string, unknown>;
}

// ─── Scoring results ────────────────────────────────────────────────────────

export type NoteGrade = 'perfect' | 'great' | 'good' | 'early' | 'late' | 'miss';

export interface PerNoteGrade {
  noteEventId: string;
  grade: NoteGrade;
  /** Signed ms deviation from target onset (− early, + late). null if missed. */
  deviationMs: number | null;
  /** True if the required pitch(es) were all present with no extras. */
  pitchCorrect: boolean;
}

/** Distribution of timing deviations, for the rush/drag summary (doc 03 §3.3). */
export interface TimingHistogram {
  buckets: { centerMs: number; count: number }[];
  meanMs: number; // <0 rushing, >0 dragging
  medianMs: number;
  stdDevMs: number;
}

/**
 * Result of a take (song or mini-game) — build-spec §5.
 * `assistsUsed` and `atTempo` gate the mastery star (guardrail: mastery =
 * at-tempo, un-assisted).
 */
export interface Attempt {
  id: string;
  refId: string; // chartId or miniGameId
  refKind: 'chart' | 'minigame';
  timestamp: number;
  perNoteGrades: PerNoteGrade[];
  timingHistogram: TimingHistogram;
  /** Wrong/extra notes the player hit that don't belong in the chart. */
  extraNotes: number;
  notesCorrectPct: number; // 0–1, correct events ÷ (events + extra notes)
  goodOrBetterPct: number; // 0–1 of hits with Good+ timing
  greatOrBetterPct: number; // 0–1 of hits with Great+ timing
  stars: 0 | 1 | 2 | 3;
  masteryStar: boolean; // 3 stars AND at target tempo AND no assists
  atTempo: boolean; // played at target tempo (not slowed)
  tempoBPM: number;
  assistsUsed: Assist[];
  xpAwarded: number;
  riffsAwarded: number;
}

export type Assist = 'falling-notes' | 'note-names' | 'one-hand' | 'slow-down' | 'metronome-count-in';

// ─── User state (persisted) ─────────────────────────────────────────────────

/**
 * Per-user progress on a skill. The two-lock model (doc 04 §2):
 *  - handsLock: opened only by playing attempts (at-tempo, un-assisted).
 *  - headLock:  opened by AFK/theory/ear mini-games.
 * Skill goes gold only when BOTH pass threshold.
 */
export interface SkillProgress {
  skillId: string;
  headLock: number; // 0–1
  handsLock: number; // 0–1
  masteredAt?: number; // set when both locks ≥ threshold
  /** FSRS scheduling state serialized; see srs module. */
  freshness: FsrsState;
  lastReviewed?: number;
}

/** Opaque-ish FSRS card state (kept serializable for persistence). */
export interface FsrsState {
  due: number; // epoch ms
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // New | Learning | Review | Relearning
  lastReview?: number;
}

export interface ReviewItem {
  id: string;
  kind: 'skill' | 'theory';
  refId: string; // skillId or theoryConceptId
  fsrs: FsrsState;
}

export type GoalHorizon = 'session' | 'weekly' | 'long';
export type GoalType = 'learning' | 'performance';

export interface Goal {
  id: string;
  horizon: GoalHorizon;
  type: GoalType;
  text: string; // SMART-framed
  target: number;
  progress: number;
  accepted: boolean;
  deadline?: number;
  createdAt: number;
}

/**
 * Global player state + wallet (build-spec §5).
 *
 * GUARDRAIL (encoded here, enforced in ProgressionService/RewardService):
 *   `playerLevel` and `currentPlayingTier` derive ONLY from Hands progress and
 *   playing attempts. `headTrackXP` is a SEPARATE accumulator that can never
 *   feed them. Do not add a code path that lets headTrackXP influence
 *   playerLevel / currentPlayingTier.
 */
export interface PlayerState {
  // Hands / playing track — the only inputs to level & tier.
  playerLevel: number;
  totalXP: number; // playing (Hands) XP only
  currentPlayingTier: Tier;

  // Head / knowledge track — strictly separate (doc 04 §5).
  headTrackXP: number;

  // Economy & habit.
  riffs: number;
  streak: number;
  streakFreezes: number;
  lastSessionDate?: string; // YYYY-MM-DD

  // Cosmetics (Phase 6).
  cosmeticsOwned: string[];
  equippedCosmetics: Record<string, string>;

  // Preferences.
  calibrationOffsetMs: number;
}
