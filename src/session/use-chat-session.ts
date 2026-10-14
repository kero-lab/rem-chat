import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { IDLE_RESET_MS, shouldIdleReset } from '../turns';
import type { RemChatState } from '../store/create-rem-chat-store';

type Snapshot = Pick<RemChatState, 'sessionId' | 'messages' | 'lastActivityAt'>;

/** Idle reset (#2091): a chat untouched for 15 min starts fresh on mount / focus, with the old one resumable until the user moves on. */
export function useChatSession(
  store: StoreApi<RemChatState>,
  opts: { idleResetMs?: number; now?: () => number } = {},
) {
  const snapshot = useRef<Snapshot | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const empty = useStore(store, (s) => s.messages.length === 0);
  const idleResetMs = opts.idleResetMs ?? IDLE_RESET_MS;
  // Read through a ref so an inline `now` lambda does not re-run the mount check on every render.
  const nowRef = useRef(opts.now);
  useLayoutEffect(() => { nowRef.current = opts.now; });

  const check = useCallback(() => {
    const s = store.getState();
    const t = nowRef.current ? nowRef.current() : Date.now();
    // shouldIdleReset has a fixed 15-min window; a custom window is applied on top of its guards.
    const idle = idleResetMs === IDLE_RESET_MS
      ? shouldIdleReset({ lastActivity: s.lastActivityAt === null ? null : new Date(s.lastActivityAt), now: t, isLoading: s.isLoading, isEmpty: s.messages.length === 0 })
      : !s.isLoading && s.messages.length > 0 && s.lastActivityAt !== null && t - s.lastActivityAt > idleResetMs;
    if (!idle) return;
    snapshot.current = { sessionId: s.sessionId, messages: s.messages, lastActivityAt: s.lastActivityAt };
    s.reset();
    setHasSnapshot(true);
  }, [store, idleResetMs]);

  useEffect(() => {
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [check]);

  const continueChat = useCallback(() => {
    const snap = snapshot.current;
    if (!snap) return;
    const cur = store.getState();
    if (cur.isLoading || cur.messages.length > 0) return;
    // Resuming is activity: keeping the old timestamp would idle-reset the restored chat on the next focus.
    store.setState({ ...snap, lastActivityAt: nowRef.current ? nowRef.current() : Date.now() });
    snapshot.current = null;
    setHasSnapshot(false);
  }, [store]);

  const newChat = useCallback(() => {
    store.getState().reset();
    snapshot.current = null;
    setHasSnapshot(false);
  }, [store]);

  // Once the user starts typing into the fresh chat there is nothing to resume into.
  return { resumable: hasSnapshot && empty, continueChat, newChat };
}
