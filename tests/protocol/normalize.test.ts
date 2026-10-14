import { describe, it, expect } from 'vitest';
import { toParts } from '../../src/protocol/normalize';
import { isToolPart, toolNameOf } from '../../src/protocol/parts';
import { stripThinking, parseThinking } from '../../src/protocol/thinking';

describe('toParts (#2091)', () => {
  it('returns existing parts untouched', () => {
    const parts = [{ type: 'text' as const, text: 'hi' }];
    expect(toParts({ id: 'm', content: 'ignored', parts })).toBe(parts);
  });
  it('turns a legacy message into tool parts first, then text', () => {
    const p = toParts({
      id: 'm1',
      content: 'Done.',
      toolCalls: [
        { tool: 'web_search', status: 'done', args: { q: 'x' }, result: 1, durationMs: 40 },
        { tool: 'ssh', status: 'error', error: 'denied' },
      ],
    });
    expect(p.map((x) => x.type)).toEqual(['tool-web_search', 'tool-ssh', 'text']);
    expect(p[0]).toMatchObject({ toolCallId: 'm1-tool-0', state: 'output-available', outcome: 'ok', input: { q: 'x' }, durationMs: 40 });
    expect(p[1]).toMatchObject({ state: 'output-error', outcome: 'error', errorText: 'denied' });
    expect(p[2]).toEqual({ type: 'text', text: 'Done.' });
  });
  it('a legacy call left "calling" on a finished message is cancelled, not spinning forever', () => {
    const [tool] = toParts({ id: 'm', content: '', toolCalls: [{ tool: 'x', status: 'calling' }] });
    expect(tool).toMatchObject({ state: 'output-error', outcome: 'cancelled' });
  });
  it('a legacy call still "calling" on an in-flight message stays open', () => {
    const [tool] = toParts({ id: 'm', content: '', isLoading: true, toolCalls: [{ tool: 'x', status: 'calling' }] });
    expect(tool).toMatchObject({ state: 'input-available' });
  });
  it('empty content yields no text part', () => {
    expect(toParts({ id: 'm', content: '' })).toEqual([]);
  });
  it('tool part helpers', () => {
    const [t] = toParts({ id: 'm', content: '', toolCalls: [{ tool: 'web_search', status: 'done' }] });
    expect(isToolPart(t)).toBe(true);
    expect(isToolPart({ type: 'text' })).toBe(false);
    expect(toolNameOf(t as never)).toBe('web_search');
  });
});

describe('thinking helpers (#2091)', () => {
  it('strips complete and partial thinking blocks', () => {
    expect(stripThinking('<rem_thinking>hmm</rem_thinking>Hello')).toBe('Hello');
    expect(stripThinking('Hello <rem_thi')).toBe('Hello');
    expect(parseThinking('<rem_thinking>a</rem_thinking>b').thinking).toBe('a');
  });
});
