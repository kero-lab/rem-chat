import { describe, it, expect } from 'vitest';
import { applyStreamEvent, closeOpenTools } from '../../src/protocol/stream-reducer';
import { toParts } from '../../src/protocol/normalize';
import { isToolPart, type ToolPart } from '../../src/protocol/parts';
import type { ChatMessage as Message, StreamEvent } from '../../src/protocol/types';
import { cardsOf } from '../../src/protocol/cards';

const base = (): Message => ({ id: 'a1', role: 'assistant', content: '', timestamp: new Date(0), isLoading: true });
const run = (evs: StreamEvent[], m = base()) => evs.reduce(applyStreamEvent, m);

describe('applyStreamEvent (#2091)', () => {
  it('keeps text and tools in the order they happened', () => {
    const m = run([
      { type: 'text', delta: 'Let me ' },
      { type: 'text', delta: 'check. ' },
      { type: 'tool_call', tool: 'web_search', status: 'calling', toolCallId: 'c1', args: { q: 'x' } },
      { type: 'tool_call', tool: 'web_search', status: 'done', toolCallId: 'c1', result: { n: 1 } },
      { type: 'text', delta: 'Found it.' },
    ]);
    expect(m.content).toBe('Let me check. Found it.');
    expect(m.parts!.map((p) => p.type)).toEqual(['text', 'tool-web_search', 'text']);
    expect(m.parts![1]).toMatchObject({ toolCallId: 'c1', state: 'output-available', outcome: 'ok', input: { q: 'x' }, output: { n: 1 } });
    expect(m.isLoading).toBe(false);
    expect(toParts(m).filter(isToolPart)).toHaveLength(1);
  });
  it('does not mutate its input', () => {
    const m1 = run([{ type: 'text', delta: 'a' }]);
    const snapshot = JSON.stringify(m1);
    applyStreamEvent(m1, { type: 'text', delta: 'b' });
    expect(JSON.stringify(m1)).toBe(snapshot);
  });
  it('without ids, done closes the OLDEST open call of that name (Review Focus 5)', () => {
    const m = run([
      { type: 'tool_call', tool: 'web_search', status: 'calling' },
      { type: 'tool_call', tool: 'web_search', status: 'calling' },
      { type: 'tool_call', tool: 'web_search', status: 'done', result: 'first' },
    ]);
    expect(m.parts!.map((p) => (p as { state: string }).state)).toEqual(['output-available', 'input-available']);
    expect(m.parts![0]).toMatchObject({ output: 'first', toolCallId: 'a1-web_search-0' });
    expect(m.parts![1]).toMatchObject({ toolCallId: 'a1-web_search-1' });
  });
  it('a done with no open call of that name creates no phantom part', () => {
    const m = run([{ type: 'tool_call', tool: 'x', status: 'done', result: 1 }]);
    expect(m.parts ?? []).toEqual([]);
  });
  it('error status marks the call failed', () => {
    const m = run([
      { type: 'tool_call', tool: 'ssh', status: 'calling', toolCallId: 's' },
      { type: 'tool_call', tool: 'ssh', status: 'error', toolCallId: 's', error: 'denied' },
    ]);
    expect(m.parts![0]).toMatchObject({ state: 'output-error', outcome: 'error', errorText: 'denied' });
  });
  it('done fills durations from debug, matched per tool name in order', () => {
    const m = run([
      { type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' },
      { type: 'tool_call', tool: 'a', status: 'done', toolCallId: '1' },
      { type: 'done', debug: { provider: 'p', model: 'm', tier: 1, isDegraded: false, toolCalls: [{ tool: 'a', args: { k: 1 }, result: 2, durationMs: 33, success: true }] } },
    ]);
    expect(m.parts![0]).toMatchObject({ durationMs: 33, input: { k: 1 }, output: 2 });
    expect(m.debug?.model).toBe('m');
  });
  it('done-only tool calls (no streamed events) are prepended as parts', () => {
    const m = run([
      { type: 'text', delta: 'ok' },
      { type: 'done', debug: { provider: 'p', model: 'm', tier: 1, isDegraded: false, toolCalls: [{ tool: 'b', args: {}, result: 1, durationMs: 5, success: false }] } },
    ]);
    expect(m.parts!.map((p) => p.type)).toEqual(['tool-b', 'text']);
    expect(m.parts![0]).toMatchObject({ state: 'output-error' });
  });
  it('an id\'d done with an unknown toolCallId is ignored', () => {
    const m = run([
      { type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' },
      { type: 'tool_call', tool: 'a', status: 'done', toolCallId: 'nope', result: 1 },
    ]);
    expect(m.parts).toHaveLength(1);
    expect(m.parts![0]).toMatchObject({ state: 'input-available' });
  });
  it('an error event returns the message unchanged', () => {
    const m = run([{ type: 'text', delta: 'x' }]);
    expect(applyStreamEvent(m, { type: 'error', message: 'boom' })).toBe(m);
  });
  it('closeOpenTools cancels open calls, leaves finished ones, never mutates', () => {
    const m = run([
      { type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' },
      { type: 'tool_call', tool: 'a', status: 'done', toolCallId: '1', result: 1 },
      { type: 'tool_call', tool: 'b', status: 'calling', toolCallId: '2' },
    ]);
    const snap = JSON.stringify(m);
    const c = closeOpenTools(m);
    expect(JSON.stringify(m)).toBe(snap);
    expect(c.parts![0]).toMatchObject({ state: 'output-available', outcome: 'ok' });
    expect(c.parts![1]).toMatchObject({ state: 'output-error', outcome: 'cancelled' });
    expect(closeOpenTools(c)).toBe(c);
  });
  describe('done closes calls still open (rem-core sent no tool done)', () => {
    const dbg = (toolCalls: Array<{ tool: string; success: boolean }>) => ({
      type: 'done' as const,
      debug: { provider: 'p', model: 'm', tier: 1, isDegraded: false, toolCalls: toolCalls.map((t) => ({ ...t, args: {}, result: null, durationMs: 1 })) },
    });
    it('a matched failed debug entry closes it as output-error/error', () => {
      const m = run([{ type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' }, dbg([{ tool: 'a', success: false }])]);
      expect(m.parts![0]).toMatchObject({ state: 'output-error', outcome: 'error' });
    });
    it('a matched successful debug entry closes it as output-available/ok', () => {
      const m = run([{ type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' }, dbg([{ tool: 'a', success: true }])]);
      expect(m.parts![0]).toMatchObject({ state: 'output-available', outcome: 'ok' });
    });
    it('no debug entry closes it as cancelled', () => {
      const m = run([{ type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' }, dbg([])]);
      expect(m.parts![0]).toMatchObject({ state: 'output-error', outcome: 'cancelled' });
    });
    it('matches per name in order and leaves an already-closed call untouched, without mutating', () => {
      const before = run([
        { type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '1' },
        { type: 'tool_call', tool: 'a', status: 'error', toolCallId: '1', error: 'x' },
        { type: 'tool_call', tool: 'a', status: 'calling', toolCallId: '2' },
      ]);
      const snap = JSON.stringify(before);
      const m = applyStreamEvent(before, dbg([{ tool: 'a', success: true }]));
      expect(JSON.stringify(before)).toBe(snap);
      expect(m.parts![0]).toMatchObject({ state: 'output-error', outcome: 'error', errorText: 'x' });
      expect(m.parts![1]).toMatchObject({ state: 'output-error', outcome: 'cancelled' });
    });
  });
  it('stamps startedAt on calling from the event clock', () => {
    const m = applyStreamEvent(base(), { type: 'tool_call', tool: 'generate_image', status: 'calling', toolCallId: 'g1' }, 1_000);
    expect((m.parts![0] as ToolPart).startedAt).toBe(1_000);
  });
  it('keeps startedAt and stores media as file parts on done', () => {
    let m = applyStreamEvent(base(), { type: 'tool_call', tool: 'generate_image', status: 'calling', toolCallId: 'g1' }, 1_000);
    m = applyStreamEvent(m, { type: 'tool_call', tool: 'generate_image', status: 'done', toolCallId: 'g1', result: 'ok',
      media: [{ url: 'https://cdn.kero-ara.com/u/a.png', mediaType: 'image/png', alt: 'Generated image' }] }, 21_000);
    const p = m.parts![0] as ToolPart;
    expect(p.startedAt).toBe(1_000);
    expect(p.media).toEqual([{ type: 'file', url: 'https://cdn.kero-ara.com/u/a.png', mediaType: 'image/png', name: 'Generated image' }]);
  });
  it('ignores malformed media entries and older events without media', () => {
    let m = applyStreamEvent(base(), { type: 'tool_call', tool: 'x', status: 'calling', toolCallId: 'c' }, 0);
    m = applyStreamEvent(m, { type: 'tool_call', tool: 'x', status: 'done', toolCallId: 'c', media: [{ url: 42 }, { url: 'javascript:alert(1)', mediaType: 'image/png' }] as never }, 1);
    expect('media' in (m.parts![0] as ToolPart)).toBe(false);
  });
});

describe('tool done outcome (#2091 R3b)', () => {
  const call = { type: 'tool_call' as const, tool: 'generate_image', toolCallId: 'g1' };
  it('done + outcome error closes the part as output-error and keeps errorText', () => {
    const m = run([
      { ...call, status: 'calling' },
      { ...call, status: 'done', outcome: 'error', errorText: 'comfyui returned no image' },
    ]);
    expect(m.parts![0]).toMatchObject({ state: 'output-error', outcome: 'error', errorText: 'comfyui returned no image' });
  });
  it('keeps a specific known outcome; unknown outcome strings become error', () => {
    const t = run([{ ...call, status: 'calling' }, { ...call, status: 'done', outcome: 'timeout' }]);
    expect(t.parts![0]).toMatchObject({ state: 'output-error', outcome: 'timeout' });
    const u = run([{ ...call, status: 'calling' }, { ...call, status: 'done', outcome: 'weird' as never }]);
    expect(u.parts![0]).toMatchObject({ state: 'output-error', outcome: 'error' });
  });
  it('done with outcome ok, or without outcome, is unchanged', () => {
    for (const extra of [{ outcome: 'ok' as const }, {}]) {
      const m = run([{ ...call, status: 'calling' }, { ...call, status: 'done', ...extra }]);
      expect(m.parts![0]).toMatchObject({ state: 'output-available', outcome: 'ok' });
    }
  });
});

describe('cards on tool parts (#2140)', () => {
  const card = { kind: 'weather', v: 1, asOf: '2026-10-07T16:06:00.000Z', title: 'Rotterdam', subtitle: 'Netherlands', data: { a: 1 }, fallbackText: 'Dry.', refresh: { kind: 'weather', args: { lat: 51.92 } } };
  const calling = { type: 'tool_call', tool: 'weather', status: 'calling', toolCallId: 'w1' } as const;
  it('attaches a valid card to its call', () => {
    const m = run([calling, { type: 'tool_call', tool: 'weather', status: 'done', toolCallId: 'w1', card }]);
    expect((m.parts![0] as ToolPart).card).toEqual(card);
    expect(cardsOf(m.parts!)).toHaveLength(1);
  });
  it('drops malformed cards', () => {
    for (const bad of [null, 'x', { kind: 'weather' }, { ...card, kind: 'bad kind!' }, { ...card, v: 'one' }, { ...card, asOf: 'yesterday' }, { ...card, fallbackText: 5 }]) {
      const m = run([calling, { type: 'tool_call', tool: 'weather', status: 'done', toolCallId: 'w1', card: bad }]);
      expect((m.parts![0] as ToolPart).card).toBeUndefined();
    }
  });
  it('a failed call keeps no card', () => {
    const m = run([calling, { type: 'tool_call', tool: 'weather', status: 'done', toolCallId: 'w1', outcome: 'error', card }]);
    expect((m.parts![0] as ToolPart).card).toBeUndefined();
  });
  it('drops a refresh spec without a kind', () => {
    const m = run([calling, { type: 'tool_call', tool: 'weather', status: 'done', toolCallId: 'w1', card: { ...card, refresh: { args: {} } } }]);
    expect((m.parts![0] as ToolPart).card?.refresh).toBeUndefined();
  });

  it('preserves app-specific fields it does not know (RemHub compare/private)', () => {
    const msg = { id: 'a', role: 'assistant' as const, content: '', timestamp: new Date(0), private: true, compareResponse: { content: 'x' } };
    const out = applyStreamEvent(msg, { type: 'text', delta: 'hi' }, 1);
    expect(out).toMatchObject({ private: true, compareResponse: { content: 'x' }, content: 'hi' });
  });
});
