/**
 * AudioService — Tone.js audio (build-spec §6.9).
 *
 * Owns the sampled instrument (piano; falls back to a synth until sample packs
 * land — see CLAUDE.md TODO) and, crucially, the **metronome/Transport as the
 * master clock** that the ScoringEngine and falling-notes visualizer sync to.
 *
 * Clock bridge: input note timestamps are in the performance.now() domain, but
 * Tone schedules in AudioContext seconds. `audioTimeToPerfMs` converts a
 * scheduled audio time to the shared performance.now() domain so a chart's beat
 * onsets and the player's notes can be compared on one timeline.
 *
 * Browser-only (needs AudioContext); not imported by unit tests.
 */
import * as Tone from 'tone';

export interface MetronomeTick {
  beat: number; // absolute beat index since start
  barBeat: number; // 0-based beat within the bar
  perfMs: number; // sounding time in performance.now() domain
  audioTime: number; // scheduled audio-context time (seconds)
}

export class AudioService {
  private initialized = false;
  private instrument: Tone.PolySynth | null = null;
  private clickHi: Tone.MembraneSynth | null = null;
  private clickLo: Tone.MembraneSynth | null = null;
  private metronomeId: number | null = null;
  private beatCounter = 0;
  private beatsPerBar = 4;
  private tickListeners = new Set<(t: MetronomeTick) => void>();

  // Clock anchor (captured once) mapping audio seconds ↔ performance.now() ms.
  private anchorPerfMs = 0;
  private anchorAudioMs = 0;

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
    this.instrument = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.8 },
    }).toDestination();
    this.instrument.volume.value = -8;

    this.clickHi = new Tone.MembraneSynth().toDestination();
    this.clickLo = new Tone.MembraneSynth().toDestination();
    this.clickHi.volume.value = -6;
    this.clickLo.volume.value = -12;

    this.anchorPerfMs = performance.now();
    this.anchorAudioMs = Tone.getContext().currentTime * 1000;
    this.initialized = true;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** performance.now() timestamp for a given AudioContext time (seconds). */
  audioTimeToPerfMs(audioSeconds: number): number {
    return this.anchorPerfMs + (audioSeconds * 1000 - this.anchorAudioMs);
  }

  /** AudioContext time (seconds) for a given performance.now() timestamp. */
  perfMsToAudioTime(perfMs: number): number {
    return (perfMs - this.anchorPerfMs + this.anchorAudioMs) / 1000;
  }

  nowMs(): number {
    return performance.now();
  }

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  getBpm(): number {
    return Tone.getTransport().bpm.value;
  }

  playNote(pitch: number, durationSec = 0.5, velocity = 0.8, time?: number): void {
    if (!this.instrument) return;
    const freq = Tone.Frequency(pitch, 'midi').toFrequency();
    this.instrument.triggerAttackRelease(freq, durationSec, time, velocity);
  }

  /**
   * Start the metronome/Transport at the given tempo. Each beat fires a click
   * and notifies tick listeners with the sounding time in both clock domains.
   */
  startMetronome(bpm: number, beatsPerBar = 4): void {
    const transport = Tone.getTransport();
    this.stopMetronome();
    this.beatCounter = 0;
    this.beatsPerBar = beatsPerBar;
    transport.bpm.value = bpm;

    this.metronomeId = transport.scheduleRepeat((time) => {
      const beat = this.beatCounter++;
      const barBeat = beat % this.beatsPerBar;
      const accent = barBeat === 0;
      const click = accent ? this.clickHi : this.clickLo;
      click?.triggerAttackRelease(accent ? 'C3' : 'C2', 0.03, time);

      const tick: MetronomeTick = {
        beat,
        barBeat,
        perfMs: this.audioTimeToPerfMs(time),
        audioTime: time,
      };
      Tone.getDraw().schedule(() => {
        for (const l of this.tickListeners) l(tick);
      }, time);
    }, '4n');

    transport.start();
  }

  stopMetronome(): void {
    const transport = Tone.getTransport();
    if (this.metronomeId !== null) {
      transport.clear(this.metronomeId);
      this.metronomeId = null;
    }
    transport.stop();
    transport.position = 0;
  }

  onTick(cb: (t: MetronomeTick) => void): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }
}

/** App-wide singleton (audio must be a single AudioContext). */
export const audioService = new AudioService();
