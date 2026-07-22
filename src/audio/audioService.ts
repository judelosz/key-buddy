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
  private synth: Tone.PolySynth | null = null; // fallback until samples load
  private sampler: Tone.Sampler | null = null; // sampled grand piano
  private samplerReady = false;
  // Woodblock metronome: a short pitched "tok" plus a filtered noise transient.
  private clickTone: Tone.Synth | null = null;
  private clickNoise: Tone.NoiseSynth | null = null;
  private clickFilter: Tone.Filter | null = null;
  private metronomeId: number | null = null;
  private beatCounter = 0;
  private beatsPerBar = 4;
  private lastEmittedBeat = -1;
  private rafId: number | null = null;
  private currentBeatSec = 0.5;
  private chartAudioIds: number[] = [];
  private tickListeners = new Set<(t: MetronomeTick) => void>();

  // Clock anchor (captured once) mapping audio seconds ↔ performance.now() ms.
  private anchorPerfMs = 0;
  private anchorAudioMs = 0;

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    // Fallback synth — plays immediately while the piano samples download.
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.8 },
    }).toDestination();
    this.synth.volume.value = -8;

    // Sampled grand piano (Salamander, via the Tone.js sample CDN). Loads in the
    // background; playNote swaps to it once ready, and stays on the synth if
    // offline. Samples every minor third, pitch-shifted between.
    this.sampler = new Tone.Sampler({
      urls: {
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        A5: 'A5.mp3', C6: 'C6.mp3',
      },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1,
      onload: () => {
        this.samplerReady = true;
      },
    }).toDestination();
    this.sampler.volume.value = -4;

    // Woodblock click: a dry pitched "tok" + a short band-passed noise transient.
    this.clickTone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
    this.clickTone.volume.value = -8;

    this.clickFilter = new Tone.Filter({ type: 'bandpass', frequency: 2000, Q: 1.4 }).toDestination();
    this.clickNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    }).connect(this.clickFilter);
    this.clickNoise.volume.value = -14;

    this.anchorPerfMs = performance.now();
    this.anchorAudioMs = Tone.getContext().currentTime * 1000;
    this.initialized = true;
  }

  /** Trigger one metronome woodblock; accented on the downbeat. */
  private triggerClick(time: number, accent: boolean): void {
    this.clickFilter?.frequency.setValueAtTime(accent ? 2500 : 1800, time);
    this.clickTone?.triggerAttackRelease(accent ? 'C6' : 'G5', 0.05, time, accent ? 0.9 : 0.6);
    this.clickNoise?.triggerAttackRelease(0.03, time, accent ? 0.6 : 0.4);
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

  /** Seconds elapsed on the Transport since it started (0 at start). */
  getTransportSeconds(): number {
    return Tone.getTransport().seconds;
  }

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  getBpm(): number {
    return Tone.getTransport().bpm.value;
  }

  playNote(pitch: number, durationSec = 0.5, velocity = 0.8, time?: number): void {
    const instrument = this.samplerReady && this.sampler ? this.sampler : this.synth;
    if (!instrument) return;
    const freq = Tone.Frequency(pitch, 'midi').toFrequency();
    instrument.triggerAttackRelease(freq, durationSec, time, velocity);
  }

  /** True once the sampled piano has finished downloading (else the synth plays). */
  get pianoReady(): boolean {
    return this.samplerReady;
  }

  /**
   * Start the metronome/Transport at the given tempo. Click AUDIO is scheduled
   * precisely on the Transport; the logical beat TICKS (used to drive the play
   * session and calibration) are emitted from a rAF loop reading the same
   * Transport clock. Both derive from one clock, but the tick loop doesn't
   * depend on Tone.Draw's animation scheduler (which proved unreliable for
   * driving app state), so phase transitions and completion always fire.
   */
  startMetronome(bpm: number, beatsPerBar = 4): void {
    const transport = Tone.getTransport();
    this.stopMetronome();
    this.beatsPerBar = beatsPerBar;
    this.lastEmittedBeat = -1;
    transport.bpm.value = bpm;
    const beatSec = 60 / bpm;
    this.currentBeatSec = beatSec;

    // Precise click audio (woodblock).
    this.metronomeId = transport.scheduleRepeat((time) => {
      const beat = this.beatCounter++;
      this.triggerClick(time, beat % this.beatsPerBar === 0);
    }, '4n');
    this.beatCounter = 0;

    const startAudioTime = Tone.now() + 0.05;
    transport.start(startAudioTime);

    // Logical beat ticks off a rAF loop (robust, same clock as the visualizer).
    const loop = () => {
      const sec = transport.seconds;
      const beat = Math.floor(sec / beatSec + 1e-6);
      while (this.lastEmittedBeat < beat) {
        this.lastEmittedBeat++;
        const b = this.lastEmittedBeat;
        const audioTime = startAudioTime + b * beatSec;
        const tick: MetronomeTick = {
          beat: b,
          barBeat: ((b % beatsPerBar) + beatsPerBar) % beatsPerBar,
          perfMs: this.audioTimeToPerfMs(audioTime),
          audioTime,
        };
        for (const l of this.tickListeners) l(tick);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Schedule the chart's notes to play back on the sampled piano (for Preview /
   * "watch it first"). Times are anchored to the running Transport start, after
   * the count-in. Call right after startMetronome.
   */
  scheduleChartAudio(
    notes: ReadonlyArray<{ pitches: number[]; startBeat: number; durationBeats: number }>,
    countInBeats: number,
  ): void {
    const transport = Tone.getTransport();
    for (const n of notes) {
      const at = (countInBeats + n.startBeat) * this.currentBeatSec; // transport seconds
      const dur = Math.max(0.15, n.durationBeats * this.currentBeatSec * 0.9);
      const id = transport.schedule((time) => {
        for (const p of n.pitches) this.playNote(p, dur, 0.85, time);
      }, at);
      this.chartAudioIds.push(id);
    }
  }

  pauseTransport(): void {
    Tone.getTransport().pause();
  }

  resumeTransport(): void {
    Tone.getTransport().start();
  }

  stopMetronome(): void {
    const transport = Tone.getTransport();
    for (const id of this.chartAudioIds) transport.clear(id);
    this.chartAudioIds = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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
