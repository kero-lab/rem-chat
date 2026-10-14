import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRemChatStore, type RemChatTransport } from '../src/store/create-rem-chat-store';

const sse = (...frames: string[]) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const f of frames) c.enqueue(e.encode(f)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });

beforeEach(() => localStorage.clear());

describe('createRemChatStore', () => {
  it('sends only content + sessionId and folds the stream', async () => {
    const transport = vi.fn<RemChatTransport>(async () => sse('event: text\ndata: {"delta":"Hi"}\n\n', 'event: done\ndata: {"debug":{}}\n\n'));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    await s.getState().send('hello');
    expect(transport).toHaveBeenCalledWith({ content: 'hello', sessionId: s.getState().sessionId }, expect.any(AbortSignal));
    const [u, a] = s.getState().messages;
    expect(u).toMatchObject({ role: 'user', content: 'hello' });
    expect(a).toMatchObject({ role: 'assistant', content: 'Hi', isLoading: false });
    expect(s.getState().isLoading).toBe(false);
  });
  it('never sends history: the second send carries only the new text', async () => {
    const transport = vi.fn<RemChatTransport>(async () => sse('event: done\ndata: {"debug":{}}\n\n'));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    await s.getState().send('one');
    await s.getState().send('two');
    expect(transport.mock.calls[1][0]).toEqual({ content: 'two', sessionId: s.getState().sessionId });
  });
  it('stop keeps the partial reply, marks it stopped, and does not resend', async () => {
    let abortSeen = false;
    const transport = vi.fn<RemChatTransport>((_b, signal) => new Promise<Response>((_, rej) => {
      signal.addEventListener('abort', () => { abortSeen = true; rej(new DOMException('aborted', 'AbortError')); });
    }));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    const p = s.getState().send('hi');
    s.getState().stop();
    await p;
    expect(abortSeen).toBe(true);
    expect(s.getState().messages[1]).toMatchObject({ stopped: true, isLoading: false });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('a non-OK response becomes an error turn with the server message', async () => {
    const transport = vi.fn<RemChatTransport>(async () => new Response(JSON.stringify({ error: "Rem can't confirm who you are right now." }), { status: 503 }));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    await s.getState().send('hi');
    expect(s.getState().messages[1]).toMatchObject({ isLoading: false, error: "Rem can't confirm who you are right now." });
  });
  it('an error event mid-stream keeps the partial text and sets error', async () => {
    const transport = vi.fn<RemChatTransport>(async () => sse('event: text\ndata: {"delta":"par"}\n\n', 'event: error\ndata: {"message":"boom"}\n\n'));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    await s.getState().send('hi');
    expect(s.getState().messages[1]).toMatchObject({ content: 'par', error: 'boom', isLoading: false });
  });
  it('regenerate resends the last user message once, replacing the last reply', async () => {
    const transport = vi.fn<RemChatTransport>(async () => sse('event: text\ndata: {"delta":"r"}\n\n', 'event: done\ndata: {"debug":{}}\n\n'));
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    await s.getState().send('q');
    await s.getState().regenerate();
    expect(s.getState().messages).toHaveLength(2);
    expect(transport.mock.calls[1][0].content).toBe('q');
    expect(transport.mock.calls[1][0].sessionId).toBe(transport.mock.calls[0][0].sessionId);
  });
  it('reset starts a new sessionId and persists it', () => {
    const s = createRemChatStore({ transport: vi.fn(), sessionStorageKey: 'k' });
    const before = s.getState().sessionId;
    s.getState().reset();
    expect(s.getState().sessionId).not.toBe(before);
    expect(JSON.parse(localStorage.getItem('k')!).sessionId).toBe(s.getState().sessionId);
  });
  it('restores sessionId and messages from storage', () => {
    localStorage.setItem('k', JSON.stringify({ sessionId: 's1', messages: [{ id: 'u', role: 'user', content: 'x', timestamp: 0 }], lastActivityAt: 5 }));
    const s = createRemChatStore({ transport: vi.fn(), sessionStorageKey: 'k' });
    expect(s.getState()).toMatchObject({ sessionId: 's1', lastActivityAt: 5 });
    expect(s.getState().messages[0].timestamp).toBeInstanceOf(Date);
  });
  it('restores a reply left loading by a crash as stopped, not loading', () => {
    localStorage.setItem('k', JSON.stringify({ sessionId: 's1', lastActivityAt: 5, messages: [
      { id: 'u', role: 'user', content: 'x', timestamp: 0 },
      { id: 'a', role: 'assistant', content: 'par', timestamp: 0, isLoading: true },
    ] }));
    const s = createRemChatStore({ transport: vi.fn(), sessionStorageKey: 'k' });
    expect(s.getState().messages[1]).toMatchObject({ isLoading: false, stopped: true, content: 'par' });
  });
  it('never persists isLoading: true mid-stream', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const transport = vi.fn<RemChatTransport>(async () => { await gate; return sse('event: done\ndata: {"debug":{}}\n\n'); });
    const s = createRemChatStore({ transport, sessionStorageKey: 'k' });
    const p = s.getState().send('hi');
    const stored = JSON.parse(localStorage.getItem('k')!);
    expect(stored.messages.some((m: { isLoading?: boolean }) => m.isLoading)).toBe(false);
    release();
    await p;
  });
});
