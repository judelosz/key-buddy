import { AlertTriangle, Keyboard, Piano, Trash2, Usb } from 'lucide-react';
import { inputService, useMidiInput, useVirtualInput } from '@/input';
import type { InputStatus } from '@/input';
import { useAppStore } from '@/ui/store/appStore';
import { midiToName } from '@/core/music';
import { PianoKeyboard } from '@/ui/components/PianoKeyboard';

function StatusBanner({ status }: { status: InputStatus }) {
  if (status.kind === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2 text-sm font-medium text-mint-deep">
        <Piano size={16} /> Connected: {status.deviceName}
      </div>
    );
  }
  if (status.kind === 'connecting') {
    return <div className="rounded-2xl bg-sand px-4 py-2 text-sm text-ink-soft">Connecting…</div>;
  }
  const message =
    status.kind === 'no-device' || status.kind === 'unsupported' || status.kind === 'error'
      ? status.message
      : 'No input provider active.';
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-amber-soft px-4 py-2 text-sm font-medium text-amber-deep">
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
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Input debug</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Verify the note stream from either input source. Calibration offset applied:{' '}
          <span className="font-medium tabular-nums text-ink">{offset} ms</span>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-sand p-1">
          <button
            type="button"
            onClick={() => void switchTo('virtual')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
              providerKind === 'virtual' ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'
            }`}
          >
            <Keyboard size={15} /> On-screen
          </button>
          <button
            type="button"
            onClick={() => void switchTo('midi')}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
              providerKind === 'midi' ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'
            }`}
          >
            <Usb size={15} /> MIDI keyboard
          </button>
        </div>
        <StatusBanner status={status} />
      </div>

      <div className="rounded-3xl border border-line bg-surface shadow-soft p-4">
        <PianoKeyboard />
      </div>

      <div className="rounded-3xl border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h3 className="text-sm font-medium text-ink">
            Incoming notes{' '}
            <span className="text-ink-soft">({recentNotes.length})</span>
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
  );
}
