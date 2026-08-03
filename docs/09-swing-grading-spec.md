# Swing-ratio grading spec (doc 09)

Status: **adopted 2026-08-03** (user decisions recorded in CLAUDE.md §3). This spec closes
doc-08 gap **G7** and unblocks Tier-8 authoring (doc-06 §6 Arc II amendments). It defines how
the engine represents, plays, displays, measures, and gates the shuffle/swing feel.

Evidence base: doc-08 findings 2.9–2.13 (pedagogy: teach-by-imitation, ratio research,
swing dial, failure modes, root-5↔6 cell), 3.9 (bias vs variability), 3.10–3.11 (stable-tempo
reps; alternating slow/target), and the §8 honesty caveat: **swung (non-isochronous)
synchronization is barely studied** — the numbers below are convention plus the ratio
studies, not direct evidence, and every tunable is a named constant expected to move after
the human MIDI test window.

---

## 1. Representation: notate straight, mark the feel

Charts are authored on the **straight grid** — swung eighths are written as exact 0.5-beat
events — with the feel carried as metadata. This is the real-world convention (doc-08 2.9:
teachers "notate straight, mark 'swing feel'"), it keeps every chart tool (sections, slicing,
falling notes, staff) grid-based, and it means the swing transform lives in **one engine
helper, never in content JSON**.

- `Song.feel` already exists (`'straight' | 'shuffle' | 'swing' | 'waltz'`).
- New: **`Chart.feel?: Feel`** — an arrangement-level override, so a song's `--simplified`
  chart can be straight while its `--full` chart swings. Resolution everywhere is
  `chart.feel ?? song.feel`.
- `'shuffle'` and `'swing'` grade identically in v1 (one target-ratio model); `'straight'`
  and `'waltz'` are identity — the transform is a no-op.

## 2. Target model: shift only the offbeat eighths

For a swung take, the expected onset of a note whose `startBeat` has fractional part exactly
`0.5` moves from the midpoint to the ratio split:

```
swungBeat(b, r) = floor(b) + r/(r+1)        when frac(b) = 0.5
                = b                          otherwise
SWING_TARGET_RATIO = 2                       (triplet feel: offbeat at 2/3)
```

Durations follow the same geometry: the onbeat eighth of a pair lengthens to `r/(r+1)` of a
beat, the offbeat eighth shrinks to `1/(r+1)` — so playback *sounds* long-short and falling
notes *look* long-short. Notes on other subdivisions (there are none in the Tier 8–10
repertoire) pass through unchanged.

Per-note grading is otherwise unchanged: the tier's normal symmetric windows apply **around
the swung position**. The windows answer "did you play *your* note in time"; the ratio band
below answers "did the take swing". Keeping these separate is what makes the metric honest —
a widened or shifted window cannot express a band that is *narrower* than the Perfect window.

## 3. The ratio band (the pass bar)

Why a band and not windows, quantified: at 84 BPM (beat = 714 ms) the straight offbeat sits
357 ms after the beat and a 2:1 swung offbeat at 476 ms — 119 ms apart, comfortably inside
the tier-8 Good window (±161 ms chart, ±281 ms taps). Meanwhile the acceptable ratio range
1.7:1–2.5:1 spans only ≈450–510 ms — a **±30 ms** corridor, tighter than the tier-8 Perfect
window. Symmetric windows physically cannot grade this; a paired-note ratio measurement can.

Measurement, per take:

1. **Pair** every offbeat event with its preceding onbeat event (same instrument stream;
   both must have been played — misses drop the pair).
2. For each pair compute the played split `long/short` from bias-corrected onsets (§4).
3. **`measuredRatio`** = median of pair ratios (median: robust to one flubbed pair).
4. **`inBandPct`** = fraction of pairs whose ratio falls inside the tempo band:

```
swingBandForTempo(bpm):
  min = 1.7                                  (constant across the v1 tempo range)
  max = 2.5      at bpm ≤ 90
      = lerp 2.5 → 2.2 over 90 → 140 bpm     (ratio research: swing tightens as tempo rises)
      = 2.2      at bpm ≥ 140
```

5. **Flattening drift** (doc-08 2.12 failure mode #1: "eighths evening out as tempo rises or
   attention shifts"): compare the median pair ratio of the first and second halves of the
   take; if the take starts in-band and the second half drops below `min`, report
   `flattening: { fromBar }` (the first bar of the below-band run).

A take with fewer than `SWING_MIN_PAIRS = 4` playable pairs reports no swing block at all —
too little evidence to praise or gate.

## 4. Per-player bias correction: onbeat evidence only

Doc-08 3.9: individual constant bias (negative mean asynchrony + device latency) is large
(up to ~100 ms) while variability is small (~20–50 ms). The ratio must be measured relative
to the player's own beat placement, or an early-tapping player's genuine 2:1 swing reads as
flat.

- Bias is estimated from **onbeat evidence only**: the existing count-in tap median
  (onbeat by construction) and the mean deviation of onbeat notes in the take so far.
- The bias is then subtracted from **both** onbeat and offbeat onsets before pairing.
- **Never** feed offbeat error into the bias estimate. The existing tap-engine learner
  (per-prompt mean, clamp ±150 ms) absorbs *any* systematic offset — including
  swing-flattening, the exact failure mode being graded. On swung prompts the learner is
  restricted to onbeat taps.

Chart takes need no new learner: the global `calibrationOffsetMs` is already applied
upstream in the InputService, and the take-level onbeat mean covers residual drift.

## 5. The readout: `Attempt.swing`

```ts
swing?: {
  measuredRatio: number;      // median pair ratio, e.g. 1.94
  inBandPct: number;          // 0–1, fraction of pairs inside the band
  offbeatPairs: number;       // evidence count
  flattening?: { fromBar: number };
}
```

Optional field, mirroring the `continuity?` precedent — absent on straight takes, takes
without enough pairs, and all pre-spec attempts. Surfaces:

- **SwingRatioCard** on take reports (beside the timing histogram): the measured ratio on a
  straight↔triplet scale with the band shaded, in-band %, and the flattening note.
- **One tip line** in the coach ladder (after continuity, *before* the consistent-lag
  calibration tip — a flat swinger must never be told to re-run calibration): "too straight"
  / "your long-short is flattening after bar N" / over-swung.
- Per-tap live feedback on swung tap prompts gains a "Too straight" verdict.

## 6. Gating: declared, never ambient

Swing participates in pass/fail **only where content declares it** (user decision):

- New `LessonPassCriteria.minSwingInBandPct?: number` — authored on swing-tagged lessons
  (the m8 apply + boss) and consumed by the lesson reducer from `Attempt.swing`.
- A take with no swing block (too few pairs) **fails** a lesson that declares the criterion —
  silence is not evidence.
- Sibling criterion, same mechanism: `maxStops?: number` reads `Attempt.continuity.stops`
  (Tier 9's "without stopping" gate item — continuity's first consumer).
- The star matrix, recital letter anchors, XP formulas, and every straight chart's grading
  are **byte-identical to before**. Guardrail #8 is served by the measured ratio being
  un-gameable timing evidence, and guardrail #4 by the boss still requiring the mastery star
  (at-tempo, un-assisted) *plus* the declared swing bar.
- Validator: `minSwingInBandPct` is only legal on a lesson whose resolved chart/fragment
  feel is swung; `maxStops` on any chart-backed lesson.

## 7. Teach the feel before grading it (content contract for Tier 8)

The m8 ladder must precede the first graded swung take with, in order (doc-08 2.9/2.11):

1. **Reference listen** — an authentic shuffle recording framing (PD-era piano).
2. **A/B feel identification** (`feel-id`): same cell played straight then swung (order
   randomized) — "which one swings?" / "is this straight or shuffled?".
3. **Swing dial** (`feel-id` variant): the cell at parameterized ratios (≈1.5 / 2.0 / 3.0) —
   "which swings harder?" / "match the reference". Generated `choiceExplanations` name the
   long-short language, never decimals.
4. **Echo the cell**: swung `rhythm-tap` — tap the long-short pattern with the click.
5. Only then: LH root-5↔root-6 rock (the 6th is the blues sound — doc-08 2.13), hands
   together, then the graded chart with `minSwingInBandPct`.

## 8. Practice shape

Swung reps follow the already-shipped alternation rule (doc-08 3.11, adaptive ADR
2026-07-28): working-tempo reps alternate with one-off full-tempo tastes — never a gradual
BPM staircase, which is where flattening hides. Rhythm cards keep stable tempos within a rep
(3.10).

## 9. Tunables in one place

All constants live in `src/core/scoring/swing.ts` and are expected to move after Jude's MIDI
test window: `SWING_TARGET_RATIO`, `swingBandForTempo` endpoints (1.7 / 2.5 / 2.2, 90 / 140
BPM knees), `SWING_MIN_PAIRS`, the flattening split rule, and the m8
`minSwingInBandPct` values (initial: apply 0.6, boss 0.7). The count-in/tap bias clamps are
shared with the existing tap machinery and keep their values.
