import { useEffect } from 'react';
import { inputService, enableVirtualInput } from '@/input';
import { audioService } from '@/audio/audioService';
import { useAppStore } from '@/ui/store/appStore';

/**
 * Wires the InputService singleton to the store once, on app mount:
 *  - starts on the virtual provider (always available),
 *  - logs every calibrated note and plays it back for audible feedback,
 *  - mirrors provider status into the store.
 */
export function useInputWiring(): void {
  const logNote = useAppStore((s) => s.logNote);
  const setInputStatus = useAppStore((s) => s.setInputStatus);

  useEffect(() => {
    const offNote = inputService.onNote((n) => {
      logNote(n);
      if (audioService.isInitialized) audioService.playNote(n.pitch, 0.4, n.velocity / 127);
    });
    const offStatus = inputService.onStatusChange(setInputStatus);
    void enableVirtualInput().then(() => setInputStatus(inputService.getStatus()));

    return () => {
      offNote();
      offStatus();
    };
  }, [logNote, setInputStatus]);
}
