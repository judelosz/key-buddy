import { create } from 'zustand';
import type { NotePlayed } from '@/core/types';
import type { InputStatus } from '@/input';

export type Screen = 'home' | 'play' | 'progress' | 'input-debug' | 'calibration';

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
  inputStatus: InputStatus;
  providerKind: 'virtual' | 'midi';
  calibrationOffsetMs: number;
  recentNotes: LoggedNote[];

  setScreen: (s: Screen) => void;
  setInputStatus: (s: InputStatus) => void;
  setProviderKind: (k: 'virtual' | 'midi') => void;
  setCalibrationOffsetMs: (ms: number) => void;
  logNote: (n: NotePlayed) => void;
  clearNotes: () => void;
}

const MAX_LOG = 24;

export const useAppStore = create<AppState>((set) => ({
  screen: 'home',
  inputStatus: { kind: 'no-provider' },
  providerKind: 'virtual',
  calibrationOffsetMs: 0,
  recentNotes: [],

  setScreen: (screen) => set({ screen }),
  setInputStatus: (inputStatus) => set({ inputStatus }),
  setProviderKind: (providerKind) => set({ providerKind }),
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
