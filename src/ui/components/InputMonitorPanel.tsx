import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Piano, Trash2 } from 'lucide-react';
import { type InputStatus } from '@/input';
import { useAppStore } from '@/ui/store/appStore';
import { midiToName } from '@/core/music';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

export function InputStatusBanner({ status }: { status: InputStatus }) {
  if (status.kind === 'ready' && status.source === 'midi') {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2 text-sm font-medium text-mint-ink">
        <Piano size={16} /> MIDI connected: {status.deviceName}
      </div>
    );
  }
  if (status.kind === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2 text-sm font-medium text-mint-ink">
        <Check size={16} /> On-screen &amp; computer keys ready
      </div>
    );
  }
  if (status.kind === 'connecting') {
    return <div className="rounded-2xl bg-sand px-4 py-2 text-sm text-ink-soft">Connecting…</div>;
  }
  const message =
    status.kind === 'no-device' || status.kind === 'unsupported' || status.kind === 'error'
      ? status.message
      : 'No input active.';
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber-ink">
      <AlertTriangle size={16} /> {message}
    </div>
  );
}

/**
 * Collapsible live view of the calibrated note stream (keyboard + recent
 * events). Lives in Settings; useful for verifying a device without leaving
 * the app.
 */
export function InputMonitorPanel() {
  const [open, setOpen] = useState(false);
  const recentNotes = useAppStore((s) => s.recentNotes);
  const clearNotes = useAppStore((s) => s.clearNotes);
  const offset = useAppStore((s) => s.calibrationOffsetMs);

  return (
    <div className="rounded-3xl border border-line bg-surface shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-display text-sm font-semibold text-ink">Input monitor</span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          offset <span className="font-medium tabular-nums text-ink">{offset} ms</span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-line p-4">
          <PianoKeyboard />
          <div className="rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <h3 className="font-display text-sm font-semibold text-ink">
                Incoming notes <span className="text-ink-soft">({recentNotes.length})</span>
              </h3>
              <button
                type="button"
                onClick={clearNotes}
                className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>
            {recentNotes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-soft">
                Play the keyboard above (or your MIDI device) to see calibrated events.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-2 font-medium">Note</th>
                    <th className="px-4 py-2 font-medium">MIDI</th>
                    <th className="px-4 py-2 font-medium">Velocity</th>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Δ ms</th>
                  </tr>
                </thead>
                <tbody>
                  {recentNotes.map((n, i) => (
                    <tr key={`${n.timestampMs}-${i}`} className="border-t border-line">
                      <td className="px-4 py-1.5 font-medium">{midiToName(n.pitch)}</td>
                      <td className="px-4 py-1.5 tabular-nums text-ink-soft">{n.pitch}</td>
                      <td className="px-4 py-1.5 tabular-nums text-ink-soft">{n.velocity}</td>
                      <td className="px-4 py-1.5 text-ink-soft">{n.source}</td>
                      <td className="px-4 py-1.5 tabular-nums text-ink-soft">
                        {n.deltaMs === null ? '—' : n.deltaMs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
