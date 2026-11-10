import type { ErrorCode, RoomEvent, RoomView } from '@clave/shared';
import { create } from 'zustand';

interface RoomState {
  view: RoomView | null;
  /** Last applied seq; -1 before the first full state. */
  seq: number;
  /** Events of the last patch, for animations and sounds (M5/M6). */
  lastEvents: RoomEvent[];
  /** Why we're out of the room, when we are. */
  exit: 'kicked' | ErrorCode | null;
}

export const useRoom = create<RoomState>()(() => ({
  view: null,
  seq: -1,
  lastEvents: [],
  exit: null,
}));

/**
 * SPEC §2.2: patches carry an incremental seq. Apply the next one; ignore stale ones; on a gap,
 * ask for the full state again.
 */
export function patchAction(currentSeq: number, patchSeq: number): 'apply' | 'ignore' | 'resync' {
  if (currentSeq < 0) return 'resync';
  if (patchSeq <= currentSeq) return 'ignore';
  return patchSeq === currentSeq + 1 ? 'apply' : 'resync';
}
