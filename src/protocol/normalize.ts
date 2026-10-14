import type { ChatMessage, ToolCallInfo } from './types';
import type { Part, ToolPart } from './parts';

/** A legacy {tool,status} call as a part. A call still "calling" on a finished message never finished. */
export function legacyToolPart(tc: ToolCallInfo, toolCallId: string, inFlight: boolean): ToolPart {
  const open = tc.status === 'calling';
  return {
    type: `tool-${tc.tool}`,
    toolCallId,
    state: open ? (inFlight ? 'input-available' : 'output-error') : tc.status === 'error' ? 'output-error' : 'output-available',
    input: tc.args,
    output: tc.result,
    errorText: tc.error,
    durationMs: tc.durationMs,
    outcome: open ? (inFlight ? undefined : 'cancelled') : tc.status === 'error' ? 'error' : 'ok',
  };
}

/**
 * Parts for any message, old or new (#2091). Messages saved before parts
 * existed showed tool calls above the text, so that order is kept.
 */
export function toParts(m: Pick<ChatMessage, 'id' | 'content' | 'toolCalls' | 'parts' | 'isLoading'>): Part[] {
  if (m.parts?.length) return m.parts;
  const parts: Part[] = (m.toolCalls ?? []).map((tc, i) => legacyToolPart(tc, `${m.id}-tool-${i}`, !!m.isLoading));
  if (m.content) parts.push({ type: 'text', text: m.content });
  return parts;
}
