import type { ChatMessage, StreamEvent } from './types';
import { isToolPart, TOOL_OUTCOMES, type FilePart, type Part, type ToolOutcome, type ToolPart } from './parts';
import { legacyToolPart } from './normalize';
import { mergeSources, sanitizeSources } from './sources';
import { sanitizeCard } from './cards';

/**
 * Folds one SSE event into the assistant message (#2091). Pure: the store
 * calls it inside set(), and tests replay event lists through it.
 */
function toFileParts(media: unknown): FilePart[] | undefined {
  if (!Array.isArray(media)) return undefined;
  const out = media.flatMap((m): FilePart[] => {
    if (!m || typeof m !== 'object') return [];
    const { url, mediaType, width, height, alt } = m as Record<string, unknown>;
    if (typeof url !== 'string' || !/^https:\/\//i.test(url) || typeof mediaType !== 'string') return [];
    const part: FilePart = { type: 'file', url, mediaType };
    if (typeof alt === 'string') part.name = alt;
    if (typeof width === 'number') part.width = width;
    if (typeof height === 'number') part.height = height;
    return [part];
  });
  return out.length ? out : undefined;
}

export function applyStreamEvent<M extends ChatMessage>(msg: M, ev: StreamEvent, now: number = Date.now()): M {
  const parts: Part[] = msg.parts ?? [];
  switch (ev.type) {
    case 'text': {
      const last = parts[parts.length - 1];
      const next =
        last?.type === 'text'
          ? [...parts.slice(0, -1), { type: 'text' as const, text: last.text + ev.delta }]
          : [...parts, { type: 'text' as const, text: ev.delta }];
      return { ...msg, content: msg.content + ev.delta, parts: next, isLoading: false };
    }
    case 'tool_call': {
      const type = `tool-${ev.tool}` as const;
      if (ev.status === 'calling') {
        const n = parts.filter((p) => p.type === type).length;
        const part: ToolPart = {
          type,
          toolCallId: ev.toolCallId ?? `${msg.id}-${ev.tool}-${n}`,
          state: 'input-available',
          input: ev.args,
          category: ev.category,
          startedAt: now,
        };
        return { ...msg, parts: [...parts, part] };
      }
      const idx = ev.toolCallId
        ? parts.findIndex((p) => isToolPart(p) && p.toolCallId === ev.toolCallId)
        : parts.findIndex((p) => p.type === type && (p as ToolPart).state === 'input-available');
      if (idx === -1) return msg;
      const prev = parts[idx] as ToolPart;
      const failed = ev.status === 'error' || (ev.outcome !== undefined && ev.outcome !== 'ok');
      const outcome: ToolOutcome = ev.status === 'error' ? 'error' : !failed ? 'ok' : TOOL_OUTCOMES.has(ev.outcome as ToolOutcome) ? (ev.outcome as ToolOutcome) : 'error';
      const closed: ToolPart = {
        ...prev,
        state: failed ? 'output-error' : 'output-available',
        outcome,
        output: ev.result ?? prev.output,
        errorText: ev.error ?? ev.errorText ?? prev.errorText,
      };
      const media = toFileParts(ev.media);
      if (media) closed.media = media;
      // #2140 — a card only for a call that succeeded; malformed cards are dropped here.
      const card = failed ? undefined : sanitizeCard(ev.card);
      if (card) closed.card = card;
      return { ...msg, parts: parts.map((p, i) => (i === idx ? closed : p)) };
    }
    case 'sources': {
      // #2091 R4 — scoped to the call: each web_search numbers its results from 1.
      const clean = sanitizeSources(ev.sources);
      if (!clean.length) return msg;
      // An id names its call or nothing: an unknown id is dropped, never pinned on another call.
      const idx = ev.toolCallId
        ? parts.findIndex((p) => isToolPart(p) && p.toolCallId === ev.toolCallId)
        : parts.findLastIndex(isToolPart);
      if (idx === -1) return msg;
      const prev = parts[idx] as ToolPart;
      const next: ToolPart = { ...prev, sources: mergeSources(prev.sources, clean) };
      return { ...msg, parts: parts.map((p, i) => (i === idx ? next : p)) };
    }
    case 'done': {
      const calls = ev.debug?.toolCalls ?? [];
      let next = parts;
      if (calls.length && !parts.some(isToolPart)) {
        const prefix = calls.map((d, i) =>
          legacyToolPart(
            { tool: d.tool, status: d.success ? 'done' : 'error', args: d.args, result: d.result, durationMs: d.durationMs },
            `${msg.id}-tool-${i}`,
            false,
          ),
        );
        next = [...prefix, ...parts];
      } else if (calls.length) {
        const seen = new Map<string, number>();
        next = parts.map((p) => {
          if (!isToolPart(p)) return p;
          const name = p.type.slice('tool-'.length);
          const k = seen.get(name) ?? 0;
          seen.set(name, k + 1);
          const d = calls.filter((c) => c.tool === name)[k];
          return d ? { ...p, durationMs: d.durationMs, input: p.input ?? d.args, output: p.output ?? d.result } : p;
        });
      }
      // rem-core sends no tool done for SDK tool-error parts, no-execute tools or id mismatches:
      // `done` is final, so nothing may stay spinning (#2091).
      const seenOpen = new Map<string, number>();
      next = next.map((p) => {
        if (!isToolPart(p)) return p;
        const name = p.type.slice('tool-'.length);
        const k = seenOpen.get(name) ?? 0;
        seenOpen.set(name, k + 1);
        if (p.state !== 'input-available' && p.state !== 'input-streaming') return p;
        const d = calls.filter((c) => c.tool === name)[k];
        if (!d) return { ...p, state: 'output-error', outcome: 'cancelled' } as ToolPart;
        return (d.success
          ? { ...p, state: 'output-available', outcome: 'ok' }
          : { ...p, state: 'output-error', outcome: 'error' }) as ToolPart;
      });
      return { ...msg, parts: next, isLoading: false, debug: ev.debug };
    }
    default:
      return msg;
  }
}

/** A turn that ends without `done` (Stop, dropped stream) leaves no call running (#2091). */
export function closeOpenTools<M extends ChatMessage>(msg: M): M {
  const isOpen = (p: Part) => isToolPart(p) && (p.state === 'input-available' || p.state === 'input-streaming');
  if (!msg.parts?.some(isOpen)) return msg;
  return {
    ...msg,
    parts: msg.parts.map((p) =>
      isOpen(p) ? ({ ...(p as ToolPart), state: 'output-error', outcome: 'cancelled' } as ToolPart) : p,
    ),
  };
}
