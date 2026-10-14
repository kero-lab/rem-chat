import { create } from 'zustand';
import { applyStreamEvent, closeOpenTools } from '../protocol/stream-reducer';
import { parseRemChatStream } from '../protocol/sse';
import type { ChatMessage } from '../protocol/types';

export type RemChatTransport = (body: { content: string; sessionId: string }, signal: AbortSignal) => Promise<Response>;
export interface RemChatState {
  messages: ChatMessage[];
  sessionId: string;
  isLoading: boolean;
  lastActivityAt: number | null;
  send(content: string): Promise<void>;
  stop(): void;
  regenerate(): Promise<void>;
  reset(): void;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** A reply caught mid-stream (crash, reload, or a snapshot taken while streaming) is a stopped reply, never a loading one. */
const settle = (m: ChatMessage): ChatMessage => (m.isLoading ? { ...m, isLoading: false, stopped: true } : m);

export function createRemChatStore(opts: { transport: RemChatTransport; sessionStorageKey: string; newId?: () => string }) {
  const newId = opts.newId ?? uuid;
  let controller: AbortController | null = null;

  const load = (): Pick<RemChatState, 'messages' | 'sessionId' | 'lastActivityAt'> => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(opts.sessionStorageKey) : null;
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v.sessionId === 'string' && Array.isArray(v.messages)) {
          return {
            sessionId: v.sessionId,
            messages: v.messages.map((m: ChatMessage) => settle({ ...m, timestamp: new Date(m.timestamp) })),
            lastActivityAt: typeof v.lastActivityAt === 'number' ? v.lastActivityAt : null,
          };
        }
      }
    } catch { /* storage unavailable or corrupt: start fresh */ }
    return { sessionId: newId(), messages: [], lastActivityAt: null };
  };

  const store = create<RemChatState>()((set, get) => {
    const patch = (id: string, f: (m: ChatMessage) => ChatMessage) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? f(m) : m)) }));

    const run = async (content: string, assistantId: string) => {
      const ac = new AbortController();
      controller = ac;
      try {
        const res = await opts.transport({ content, sessionId: get().sessionId }, ac.signal);
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({} as { error?: string }));
          if (ac.signal.aborted) patch(assistantId, (m) => ({ ...m, isLoading: false, stopped: true }));
          else patch(assistantId, (m) => ({ ...m, isLoading: false, error: err.error || `HTTP ${res.status}` }));
          return;
        }
        for await (const ev of parseRemChatStream(res.body)) {
          if (ev.type === 'error') { patch(assistantId, (m) => ({ ...closeOpenTools(m), isLoading: false, error: ev.message })); return; }
          patch(assistantId, (m) => applyStreamEvent(m, ev, Date.now()));
          if (ev.type === 'done') break;
        }
        patch(assistantId, (m) => ({ ...closeOpenTools(m), isLoading: false }));
      } catch (e) {
        if (isAbort(e) || ac.signal.aborted) patch(assistantId, (m) => ({ ...closeOpenTools(m), isLoading: false, stopped: true }));
        else patch(assistantId, (m) => ({ ...closeOpenTools(m), isLoading: false, error: e instanceof Error ? e.message : String(e) }));
      } finally {
        // Only the current run may touch store-level state; a run orphaned by reset() must not clear the new run's isLoading.
        if (controller === ac) {
          controller = null;
          set({ isLoading: false, lastActivityAt: Date.now() });
        }
      }
    };

    return {
      ...load(),
      isLoading: false,
      async send(content) {
        const text = content.trim();
        if (!text || get().isLoading) return;
        const user: ChatMessage = { id: newId(), role: 'user', content: text, timestamp: new Date() };
        const asst: ChatMessage = { id: newId(), role: 'assistant', content: '', timestamp: new Date(), isLoading: true };
        set((s) => ({ messages: [...s.messages, user, asst], isLoading: true, lastActivityAt: Date.now() }));
        await run(text, asst.id);
      },
      stop() { controller?.abort(); },
      async regenerate() {
        const msgs = get().messages;
        const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
        if (!lastUser || get().isLoading) return;
        const cut = msgs.lastIndexOf(lastUser) + 1;
        const asst: ChatMessage = { id: newId(), role: 'assistant', content: '', timestamp: new Date(), isLoading: true };
        set({ messages: [...msgs.slice(0, cut), asst], isLoading: true });
        await run(lastUser.content, asst.id);
      },
      reset() {
        controller?.abort();
        controller = null;
        set({ messages: [], sessionId: newId(), isLoading: false, lastActivityAt: null });
      },
    };
  });

  // Persist on structural changes only, not every stream delta; isLoading flipping at stream end covers the final text.
  store.subscribe((s, prev) => {
    if (s.isLoading === prev.isLoading && s.messages.length === prev.messages.length && s.sessionId === prev.sessionId && s.lastActivityAt === prev.lastActivityAt) return;
    try {
      localStorage.setItem(opts.sessionStorageKey, JSON.stringify({ sessionId: s.sessionId, messages: s.messages.map(settle), lastActivityAt: s.lastActivityAt }));
    } catch { /* quota or private mode: the chat still works in memory */ }
  });
  return store;
}
