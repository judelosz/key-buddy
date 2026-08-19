import { create } from 'zustand';

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  pending: number;
  message?: string;
}
export const useSyncStore = create<SyncState>(() => ({ status: 'saved', pending: 0 }));

export function setSyncState(next: SyncState): void {
  useSyncStore.setState(next);
}
