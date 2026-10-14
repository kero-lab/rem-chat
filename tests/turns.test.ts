// tests/chat-turns.test.ts
import { describe, it, expect } from 'vitest';
import {
  IDLE_RESET_MS, toRuns, isEmoteOnly, trimReply, shouldIdleReset, remMarkState, headerMarkState, providerAccent, toPlainText,
} from '../src/turns';
import type { ChatMessage as Message } from '../src/protocol';

const m = (id: string, role: Message['role'], over: Partial<Message> = {}): Message =>
  ({ id, role, content: id, timestamp: new Date(0), ...over });

describe('toRuns (#2091 §10.2)', () => {
  it('groups consecutive turns from the same sender', () => {
    const runs = toRuns([m('a', 'user'), m('b', 'user'), m('c', 'assistant'), m('d', 'user')]);
    expect(runs.map((r) => [r.role, r.messages.map((x) => x.id)])).toEqual([
      ['user', ['a', 'b']], ['assistant', ['c']], ['user', ['d']],
    ]);
  });
  it('returns [] for no messages', () => expect(toRuns([])).toEqual([]));
});

describe('isEmoteOnly', () => {
  it('accepts up to 3 custom emotes or emoji, ignoring whitespace', () => {
    expect(isEmoteOnly('<:rem_wave:123>')).toBe(true);
    expect(isEmoteOnly('<a:dance:9> 🎲 😄')).toBe(true);
    expect(isEmoteOnly('\n\n<:rem_wave:123>\n')).toBe(true);
  });
  it('rejects text, 4+ emotes and empty strings', () => {
    expect(isEmoteOnly('hi <:rem_wave:123>')).toBe(false);
    expect(isEmoteOnly('😄😄😄😄')).toBe(false);
    expect(isEmoteOnly('   ')).toBe(false);
    expect(isEmoteOnly('123')).toBe(false);
  });
  it('counts a ZWJ family / flag as one emoji', () => {
    expect(isEmoteOnly('👨‍👩‍👧')).toBe(true);
    expect(isEmoteOnly('🇳🇱')).toBe(true);
  });
});

describe('trimReply', () => {
  it('drops leading and trailing blank lines but keeps inner ones and indentation', () => {
    expect(trimReply('\n\n  \nHello\n\nWorld\n\n')).toBe('Hello\n\nWorld');
    expect(trimReply('\n    code\n')).toBe('    code');
  });
  it('an all-blank reply becomes empty', () => expect(trimReply('\n \n\t\n')).toBe(''));
});

describe('shouldIdleReset', () => {
  const now = 10 * IDLE_RESET_MS;
  const at = (msAgo: number) => new Date(now - msAgo);
  it('resets after more than 15 min of quiet', () => {
    expect(shouldIdleReset({ lastActivity: at(IDLE_RESET_MS + 1), now, isLoading: false, isEmpty: false })).toBe(true);
  });
  it('does not reset at exactly 15 min or less', () => {
    expect(shouldIdleReset({ lastActivity: at(IDLE_RESET_MS), now, isLoading: false, isEmpty: false })).toBe(false);
    expect(shouldIdleReset({ lastActivity: at(1000), now, isLoading: false, isEmpty: false })).toBe(false);
  });
  it('never resets while streaming, on an empty chat, or with no activity record', () => {
    expect(shouldIdleReset({ lastActivity: at(IDLE_RESET_MS * 3), now, isLoading: true, isEmpty: false })).toBe(false);
    expect(shouldIdleReset({ lastActivity: at(IDLE_RESET_MS * 3), now, isLoading: false, isEmpty: true })).toBe(false);
    expect(shouldIdleReset({ lastActivity: null, now, isLoading: false, isEmpty: false })).toBe(false);
  });
  it('accepts ISO strings (persisted dates come back as strings)', () => {
    expect(shouldIdleReset({ lastActivity: at(IDLE_RESET_MS + 5).toISOString(), now, isLoading: false, isEmpty: false })).toBe(true);
  });
});

describe('remMarkState', () => {
  it('maps message fields to the ring state', () => {
    expect(remMarkState({ content: '', isLoading: true })).toBe('thinking');
    expect(remMarkState({ content: 'Hi', isLoading: true })).toBe('streaming');
    expect(remMarkState({ content: 'Hi', isLoading: false, error: 'boom' })).toBe('error');
    expect(remMarkState({ content: 'Hi', isLoading: false })).toBe('idle');
  });
  it('a thinking-only tail (stripped <rem_thinking>) still counts as thinking', () => {
    expect(remMarkState({ content: '<rem_thinking>plan', isLoading: true })).toBe('thinking');
  });
});

describe('providerAccent', () => {
  it('colours brands with a colour and leaves monochrome brands neutral', () => {
    expect(providerAccent('anthropic')).toEqual({ label: 'Anthropic', color: '#D97757' });
    expect(providerAccent('Google')).toEqual({ label: 'Google', color: '#4285F4' });
    expect(providerAccent('gemini')).toEqual({ label: 'Google', color: '#4285F4' });
    expect(providerAccent('openai')).toEqual({ label: 'OpenAI', color: null });
    expect(providerAccent('ollama')).toEqual({ label: 'Ollama', color: null });
  });
  it('unknown or missing providers are neutral and keep their name', () => {
    expect(providerAccent('mystery')).toEqual({ label: 'mystery', color: null });
    expect(providerAccent(undefined)).toEqual({ label: 'unknown', color: null });
  });
});

describe('toPlainText', () => {
  it('strips common markdown but keeps the words', () => {
    expect(toPlainText('**bold** and _it_ and `code`')).toBe('bold and it and code');
    expect(toPlainText('[RemHub](https://rem.home) here')).toBe('RemHub here');
    expect(toPlainText('# Title\n- one\n- two')).toBe('Title\none\ntwo');
    expect(toPlainText('```bash\nls -la\n```')).toBe('ls -la');
  });
  it('leaves snake_case, backticked identifiers and spaced asterisks alone', () => {
    expect(toPlainText('use my_var_name here')).toBe('use my_var_name here');
    expect(toPlainText('`snake_case_name`')).toBe('snake_case_name');
    expect(toPlainText('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(toPlainText('see https://x.io/a_b_c ok')).toBe('see https://x.io/a_b_c ok');
    expect(toPlainText('__bold__ and *it*')).toBe('bold and it');
  });
});

describe('headerMarkState', () => {
  const a = (o: Partial<Message>): Message => ({ id: 'x', role: 'assistant', content: '', timestamp: new Date(0), ...o } as Message);
  it('is idle with no messages', () => expect(headerMarkState([], false)).toBe('idle'));
  it('is thinking while the store streams and no visible text has arrived', () =>
    expect(headerMarkState([a({ role: 'user', content: 'hi' }), a({ content: '<rem_thinking>x</rem_thinking>' })], true)).toBe('thinking'));
  // message.isLoading clears at the FIRST token; the store's isLoading spans the whole reply.
  it('is streaming once text arrives even though message.isLoading is false', () =>
    expect(headerMarkState([a({ content: 'Hello', isLoading: false })], true)).toBe('streaming'));
  it('is error when the last reply failed', () => expect(headerMarkState([a({ error: 'boom' })], false)).toBe('error'));
  it('is idle after the reply finished', () => expect(headerMarkState([a({ content: 'done' })], false)).toBe('idle'));
});
