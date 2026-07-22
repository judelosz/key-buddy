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

/** Curriculum arcs — the five macro-phases of the 30-tier syllabus (doc 06 §6). */
export type Arc = 'foundation' | 'blues' | 'country' | 'gospel' | 'fluency';

/** The five instructional strands that thread through every tier (doc 06 §4). */
export type Strand = 'technique' | 'rhythm' | 'harmony' | 'ear' | 'repertoire';

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

/**
 * A named span of bars (doc 06 §5.2) — the unit of SongMastery section
 * evidence and section drills. Transitions are derived between consecutive
 * sections, never authored.
 */
export interface ChartSection {
  id: string; // stable within the chart, e.g. "A1"
  label: string; // learner-facing, e.g. "Verse, first half"
  startBar: number; // inclusive, 0-based
  endBar: number; // inclusive
  /** Counts toward SongMastery coverage (default true). */
  required?: boolean;
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
  /** Phrase-level sections covering every bar; required on song charts
   * (fragments' embedded charts are exempt). */
  sections?: ChartSection[];
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

/**
 * Machine-checkable pass rule for a skill's unassisted checkpoint (doc 06 §9).
 * Percentages are 0–1 fractions.
 */
export interface SkillAssessment {
  minStars: 0 | 1 | 2 | 3;
  minNotesCorrectPct: number;
  minGoodOrBetterPct: number;
  requiresAtTempo: boolean;
  requiresNoAssists: boolean;
  /** Evidence across N separate sessions — recorded now, enforced Phase 5. */
  repeatedSessions?: number;
}

/**
 * A teachable micro-skill. The optional curriculum fields (doc 06 §9) are
 * required — and validated — on any skill referenced by a Module; seed/legacy
 * skills may omit them until they join the authored curriculum.
 */
export interface Skill {
  id: string;
  name: string;
  family: SkillFamily;
  tier: Tier;
  genre: Genre;
  prerequisites: string[]; // skill IDs
  theoryConceptId?: string;
  description: string;

  // Curriculum fields (doc 06 §9) — optional until a Module references the skill.
  arc?: Arc;
  strand?: Strand;
  /** Plain-language outcome, e.g. "Play C–F–G–C triads at a steady pulse". */
  outcome?: string;
  moduleId?: string;
  assessment?: SkillAssessment;
  /** Skill IDs this skill is expected to transfer into later. */
  transferTargets?: string[];
  commonErrors?: string[];
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
  refId: string; // chartId, fragmentId, or miniGameId
  refKind: 'chart' | 'fragment' | 'minigame';
  timestamp: number;
  perNoteGrades: PerNoteGrade[];
  timingHistogram: TimingHistogram;
  /** Wrong/extra notes the player hit that don't belong in the chart, each
   * attributed to the bar it fell in (for the report heat-map). */
  wrongNotes: { pitch: Pitch; bar: number }[];
  extraNotes: number; // = wrongNotes.length (convenience)
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
  /** Set when the take happened inside a practice session. */
  sessionId?: string;
  /** Set when the take was a section drill (a sliced sub-chart) — such
   * attempts accrue section evidence only, never chart/boss mastery. */
  sectionId?: string;
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
  /** Set when a passing result landed while the FSRS card was due and the
   * skill was already functional — the tier gate's delayed-review evidence. */
  delayedReviewPassedAt?: number;
  /** Distinct ISO dates of passing Hands results (capped ~10) — evidence for
   * `SkillAssessment.repeatedSessions` ("N separate sessions"). */
  handsEvidenceDates?: string[];
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
 *   Head evidence can GATE but never SUBSTITUTE. A tier gate may require a
 *   theory/ear checkpoint (necessary condition, doc 06 §5.4), but Head/theory
 *   work alone can never raise `learningTier`, `playerLevel`, or
 *   `currentPlayingTier`, and `headTrackXP` never feeds `totalXP` or
 *   `tierHandsXP`. Do not add a code path that violates this.
 */
export interface PlayerState {
  // Hands / playing track — the only inputs to level & tier.
  /** User-facing Level. Always equals `learningTier` (tier gates passed + 1). */
  playerLevel: number;
  totalXP: number; // lifetime playing (Hands) XP only
  /** Highest tier with a Hands-mastered skill (drives the Scouting cap). */
  currentPlayingTier: Tier;
  /** The curriculum tier the player is working in: tier gates passed + 1. */
  learningTier: Tier;
  /** Hands XP accumulated within the current learning tier (meter fill). */
  tierHandsXP: number;
  /** Per-song Hands XP counted toward the CURRENT tier band (anti-grind cap:
   * one song can't fill most of a tier). Reset when a gate passes. */
  tierXpBySong: Record<string, number>;
  /** Epoch ms each tier gate was passed at, keyed by tier. */
  tierGatePassedAt: Record<number, number>;

  // Head / knowledge track — strictly separate (doc 04 §5).
  headTrackXP: number;

  // First-run flag: set when onboarding completes (epoch ms).
  onboardedAt?: number;

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
