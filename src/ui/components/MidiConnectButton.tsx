import { Usb } from 'lucide-react';
import {
  inputService,
  enableMidiInput,
  disableMidiInput,
  isMidiEnabled,
} from '@/input';
import { useAppStore } from '@/ui/store/appStore';

/**
 * Connect / disconnect a MIDI keyboard from anywhere. MIDI runs alongside the
 * always-on virtual keyboard, so connecting here also works while playing a song.
 */
export function MidiConnectButton({ compact = false }: { compact?: boolean }) {
  const midiEnabled = useAppStore((s) => s.midiEnabled);
  const setMidiEnabled = useAppStore((s) => s.setMidiEnabled);
  const status = useAppStore((s) => s.inputStatus);

  const toggle = async () => {
    if (isMidiEnabled()) {
      disableMidiInput();
      setMidiEnabled(false);
    } else {
      await enableMidiInput();
      setMidiEnabled(true);
    }
    useAppStore.getState().setInputStatus(inputService.getStatus());
  };

  const connected = midiEnabled && status.kind === 'ready' && status.source === 'midi';
  const problem =
    midiEnabled && (status.kind === 'no-device' || status.kind === 'unsupported' || status.kind === 'error');

  let label: string;
  if (connected) label = compact ? 'MIDI on' : `MIDI: ${status.deviceName}`;
  else if (problem) label = compact ? 'No MIDI' : 'No MIDI device found';
  else label = compact ? 'MIDI' : 'Connect MIDI keyboard';

  const tone = connected
    ? 'bg-mint text-ink'
    : problem
      ? 'bg-amber-soft text-amber-deep'
      : 'bg-surface text-ink';

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      title="MIDI plays alongside the on-screen keyboard"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium shadow-soft transition hover:-translate-y-px active:translate-y-px ${tone}`}
    >
      <Usb size={15} /> {label}
    </button>
  );
}
