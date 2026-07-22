import { AlertTriangle, Keyboard, Piano, Trash2, Usb } from 'lucide-react';
import { inputService, useMidiInput, useVirtualInput } from '@/input';
import type { InputStatus } from '@/input';
import { useAppStore } from '@/ui/store/appStore';
import { midiToName } from '@/core/music';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

function StatusBanner({ status }: { status: InputStatus }) {
  if (status.kind === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-grade-perfect/40 bg-grade-perfect/10 px-4 py-2 text-sm text-grade-perfect">
        <Piano size={16} /> Connected: {status.deviceName}
      </div>
    );
  }
  if (status.kind === 'connecting') {
    return <div className="rounded-lg bg-ink-soft px-4 py-2 text-sm text-neutral-400">Connecting…</div>;
  }
  const message =
    status.kind === 'no-device' || status.kind === 'unsupported' || status.kind === 'error'
      ? status.message
      : 'No input provider active.';
  return (
    <div className="flex items-center gap-2 rounded-lg border border-grade-early/40 bg-grade-early/10 px-4 py-2 text-sm text-grade-early">
      <AlertTriangle size={16} /> {message}
    </div>
  );
}

export function InputDebug() {
  const status = useAppStore((s) => s.inputStatus);
  const providerKind = useAppStore((s) => s.providerKind);
  const setProviderKind = useAppStore((s) => s.setProviderKind);
  const recentNotes = useAppStore((s) => s.recentNotes);
  const clearNotes = useAppStore((s) => s.clearNotes);
  const offset = useAppStore((s) => s.calibrationOffsetMs);

  const switchTo = async (kind: 'virtual' | 'midi') => {
    setProviderKind(kind);
    if (kind === 'midi') await useMidiInput();
    else await useVirtualInput();
    useAppStore.getState().setInputStatus(inputService.getStatus());
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Input debug</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Verify the note stream from either input source. Calibration offset applied:{' '}
          <span className="font-medium tabular-nums text-neutral-200">{offset} ms</span>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-ink-line">
          <button
            type="button"
            onClick={() => void switchTo('virtual')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm ${
              providerKind === 'virtual' ? 'bg-ink-line text-neutral-100' : 'text-neutral-400'
            }`}
          >
            <Keyboard size={15} /> On-screen
          </button>
          <button
            type="button"
            onClick={() => void switchTo('midi')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm ${
              providerKind === 'midi' ? 'bg-ink-line text-neutral-100' : 'text-neutral-400'
            }`}
          >
            <Usb size={15} /> MIDI keyboard
          </button>
        </div>
        <StatusBanner status={status} />
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
        <PianoKeyboard />
      </div>

      <div className="rounded-xl border border-ink-line bg-ink-soft">
        <div className="flex items-center justify-between border-b border-ink-line px-4 py-2">
          <h3 className="text-sm font-medium text-neutral-300">
            Incoming notes{' '}
            <span className="text-neutral-500">({recentNotes.length})</span>
          </h3>
          <button
            type="button"
            onClick={clearNotes}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
        {recentNotes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">
            Play the keyboard above (or your MIDI device) to see calibrated events.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
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
                <tr key={`${n.timestampMs}-${i}`} className="border-t border-ink-line/60">
                  <td className="px-4 py-1.5 font-medium">{midiToName(n.pitch)}</td>
                  <td className="px-4 py-1.5 tabular-nums text-neutral-400">{n.pitch}</td>
                  <td className="px-4 py-1.5 tabular-nums text-neutral-400">{n.velocity}</td>
                  <td className="px-4 py-1.5 text-neutral-400">{n.source}</td>
                  <td className="px-4 py-1.5 tabular-nums text-neutral-400">
                    {n.deltaMs === null ? '—' : n.deltaMs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
