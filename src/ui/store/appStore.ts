import { create } from 'zustand';
import type { NotePlayed } from '@/core/types';
import type { InputStatus } from '@/input';

export type Screen = 'missions' | 'free-play' | 'afk' | 'progress' | 'settings';

/** Lesson currently open in the full-screen runner (rendered over Missions). */
export interface ActiveLesson {
  moduleId: string;
  lessonId: string;
}

export interface LoggedNote {
  pitch: number;
  velocity: number;
  timestampMs: number;
  source: NotePlayed['source'];
  /** ms since the previous logged note (inter-onset interval). */
  deltaMs: number | null;
}

interface AppState {
  screen: Screen;
  /** True on first run (no onboardedAt) or when replaying the intro from Settings. */
  showOnboarding: boolean;
  /** A practice session takeover is open (mutually exclusive with activeLesson). */
  sessionActive: boolean;
  activeLesson: ActiveLesson | null;
  inputStatus: InputStatus;
  midiEnabled: boolean;
  calibrationOffsetMs: number;
  recentNotes: LoggedNote[];

  setScreen: (s: Screen) => void;
  setShowOnboarding: (v: boolean) => void;
  setSessionActive: (v: boolean) => void;
  setActiveLesson: (l: ActiveLesson | null) => void;
  setInputStatus: (s: InputStatus) => void;
  setMidiEnabled: (v: boolean) => void;
  setCalibrationOffsetMs: (ms: number) => void;
  logNote: (n: NotePlayed) => void;
  clearNotes: () => void;
}

const MAX_LOG = 24;

export const useAppStore = create<AppState>((set) => ({
  screen: 'missions',
  showOnboarding: false,
  sessionActive: false,
  activeLesson: null,
  inputStatus: { kind: 'no-provider' },
  midiEnabled: false,
  calibrationOffsetMs: 0,
  recentNotes: [],

  setScreen: (screen) => set({ screen }),
  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  // A session and a single open lesson are mutually exclusive takeovers.
  setSessionActive: (sessionActive) =>
    set(sessionActive ? { sessionActive, activeLesson: null } : { sessionActive }),
  setActiveLesson: (activeLesson) =>
    set(activeLesson ? { activeLesson, sessionActive: false } : { activeLesson }),
  setInputStatus: (inputStatus) => set({ inputStatus }),
  setMidiEnabled: (midiEnabled) => set({ midiEnabled }),
  setCalibrationOffsetMs: (calibrationOffsetMs) => set({ calibrationOffsetMs }),
  logNote: (n) =>
    set((state) => {
      const prev = state.recentNotes[0];
      const entry: LoggedNote = {
        pitch: n.pitch,
        velocity: n.velocity,
        timestampMs: n.timestampMs,
        source: n.source,
        deltaMs: prev ? Math.round(n.timestampMs - prev.timestampMs) : null,
      };
      return { recentNotes: [entry, ...state.recentNotes].slice(0, MAX_LOG) };
    }),
  clearNotes: () => set({ recentNotes: [] }),
}));
