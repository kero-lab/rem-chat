import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, screen, fireEvent } from '@testing-library/react';
import { createRemChatStore } from '../src/store/create-rem-chat-store';
import { useChatSession } from '../src/session/use-chat-session';
import { ContinuePill } from '../src/session/continue-pill';
import { IDLE_RESET_MS } from '../src/turns';

const T0 = 1_000_000_000_000;
function seeded(lastActivityAt: number | null) {
  localStorage.setItem('k', JSON.stringify({ sessionId: 's1', lastActivityAt, messages: [{ id: 'u', role: 'user', content: 'x', timestamp: 0 }] }));
  return createRemChatStore({ transport: vi.fn(), sessionStorageKey: 'k' });
}

beforeEach(() => localStorage.clear());

describe('useChatSession', () => {
  it('auto-resets an idle chat, then continueChat restores it', () => {
    const store = seeded(T0);
    const { result } = renderHook(() => useChatSession(store, { now: () => T0 + IDLE_RESET_MS + 1 }));
    expect(store.getState().messages).toEqual([]);
    expect(store.getState().sessionId).not.toBe('s1');
    expect(result.current.resumable).toBe(true);
    act(() => result.current.continueChat());
    expect(store.getState().sessionId).toBe('s1');
    expect(store.getState().messages.map((m) => m.id)).toEqual(['u']);
    expect(result.current.resumable).toBe(false);
  });
  it('newChat resets and clears resumable', () => {
    const store = seeded(T0);
    const { result } = renderHook(() => useChatSession(store, { now: () => T0 + IDLE_RESET_MS + 1 }));
    expect(result.current.resumable).toBe(true);
    act(() => result.current.newChat());
    expect(result.current.resumable).toBe(false);
    act(() => result.current.continueChat());
    expect(store.getState().messages).toEqual([]);
  });
  it('continueChat is a no-op while loading or when the current chat has messages', () => {
    const store = seeded(T0);
    const { result } = renderHook(() => useChatSession(store, { now: () => T0 + IDLE_RESET_MS + 1 }));
    act(() => { store.setState({ isLoading: true }); });
    act(() => result.current.continueChat());
    expect(store.getState().sessionId).not.toBe('s1');
    act(() => { store.setState({ isLoading: false, messages: [{ id: 'n', role: 'user', content: 'y', timestamp: new Date() }] }); });
    act(() => result.current.continueChat());
    expect(store.getState().messages.map((m) => m.id)).toEqual(['n']);
    expect(store.getState().sessionId).not.toBe('s1');
  });
  it('does not reset within the idle window', () => {
    const store = seeded(T0);
    const { result } = renderHook(() => useChatSession(store, { now: () => T0 + IDLE_RESET_MS - 1000 }));
    expect(store.getState().sessionId).toBe('s1');
    expect(store.getState().messages).toHaveLength(1);
    expect(result.current.resumable).toBe(false);
  });
  it('checks again when the window regains focus', () => {
    const store = seeded(T0);
    let now = T0 + 1000;
    const { result } = renderHook(() => useChatSession(store, { now: () => now }));
    expect(result.current.resumable).toBe(false);
    now = T0 + IDLE_RESET_MS + 5;
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.resumable).toBe(true);
    expect(store.getState().messages).toEqual([]);
  });
});

describe('ContinuePill', () => {
  it('shows compact relative time and calls onContinue', () => {
    const onContinue = vi.fn();
    render(<ContinuePill onContinue={onContinue} lastActivityAt={Date.now() - 3 * 3_600_000} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('3h ago');
    fireEvent.click(btn);
    expect(onContinue).toHaveBeenCalled();
  });
});
