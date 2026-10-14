// src/turns.ts
// Pure helpers for the Phase 2a chat sheet (#2091 §10). No React here.
import type { ChatMessage } from './protocol';
import { stripThinking } from './protocol';

export const IDLE_RESET_MS = 15 * 60_000;

export interface Run { role: 'user' | 'assistant'; messages: ChatMessage[] }

export function toRuns(messages: ChatMessage[]): Run[] {
  const runs: Run[] = [];
  for (const msg of messages) {
    const last = runs[runs.length - 1];
    if (last && last.role === msg.role) last.messages.push(msg);
    else runs.push({ role: msg.role, messages: [msg] });
  }
  return runs;
}

const CUSTOM_EMOTE = /<a?:\w{2,32}:\d{1,20}>/g;
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** True when the text is 1–3 emotes/emoji and nothing else (Discord "jumbo"). */
export function isEmoteOnly(text: string): boolean {
  const customs = text.match(CUSTOM_EMOTE) ?? [];
  const rest = text.replace(CUSTOM_EMOTE, '').replace(/\s+/g, '');
  const graphemes = rest ? (segmenter ? [...segmenter.segment(rest)].map((s) => s.segment) : [...rest]) : [];
  if (!graphemes.every((g) => PICTO.test(g))) return false;
  const count = customs.length + graphemes.length;
  return count >= 1 && count <= 3;
}

/** Drop leading/trailing blank lines (Haiku sometimes opens with "\n\n"); keep inner spacing and indentation. */
export function trimReply(text: string): string {
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n');
}

export function shouldIdleReset(a: { lastActivity: Date | string | null; now: number; isLoading: boolean; isEmpty: boolean }): boolean {
  if (a.isLoading || a.isEmpty || !a.lastActivity) return false;
  const t = new Date(a.lastActivity).getTime();
  if (Number.isNaN(t)) return false;
  return a.now - t > IDLE_RESET_MS;
}

export type RemMarkState = 'idle' | 'thinking' | 'streaming' | 'error';

export function remMarkState(m: Pick<ChatMessage, 'content' | 'isLoading' | 'error'>): RemMarkState {
  if (m.error) return 'error';
  if (m.isLoading) return stripThinking(m.content).trim() ? 'streaming' : 'thinking';
  return 'idle';
}

/** The header mark follows the latest reply (#2091 R2). The store's isLoading spans the whole reply; a message's own isLoading clears at its first token. */
export function headerMarkState(messages: ChatMessage[], storeLoading: boolean): RemMarkState {
  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!last) return storeLoading ? 'thinking' : 'idle';
  if (last.error) return 'error';
  if (!storeLoading) return 'idle';
  return stripThinking(last.content).trim() ? 'streaming' : 'thinking';
}

export interface ProviderAccent { label: string; color: string | null }

const ACCENTS: Record<string, ProviderAccent> = {
  anthropic: { label: 'Anthropic', color: '#D97757' },
  google: { label: 'Google', color: '#4285F4' },
  gemini: { label: 'Google', color: '#4285F4' },
  openai: { label: 'OpenAI', color: null },
  ollama: { label: 'Ollama', color: null },
};

export function providerAccent(provider: string | undefined): ProviderAccent {
  if (!provider) return { label: 'unknown', color: null };
  return ACCENTS[provider.toLowerCase()] ?? { label: provider, color: null };
}

/** Markdown → readable plain text for "Copy as plain text". Deliberately small. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(?<![\w*])\*\*(?!\s)(.+?)(?<!\s)\*\*(?![\w*])/g, '$1')
    .replace(/(?<!\w)__(?!\s)(.+?)(?<!\s)__(?!\w)/g, '$1')
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '$1')
    .replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
