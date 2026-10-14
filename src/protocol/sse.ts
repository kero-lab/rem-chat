import type { StreamEvent } from './types';

/** Parses rem-core's SSE stream (via an app's proxy route) into events. `event:` state spans reads (#2140). */
export async function* parseRemChatStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType: string | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventType) {
        try {
          const p = JSON.parse(line.slice(6));
          if (eventType === 'text') yield { type: 'text', delta: p.delta };
          else if (eventType === 'tool_call') yield {
            type: 'tool_call', tool: p.tool, status: p.status, toolCallId: p.toolCallId, category: p.category,
            args: p.args, result: p.result, error: p.error, media: p.media, outcome: p.outcome, errorText: p.errorText, card: p.card,
          };
          else if (eventType === 'sources') yield { type: 'sources', toolCallId: p.toolCallId, sources: p.sources };
          else if (eventType === 'done') yield { type: 'done', debug: p.debug };
          else if (eventType === 'error') yield { type: 'error', message: p.message };
        } catch {
          // malformed JSON: skip
        }
        eventType = null;
      } else if (line === '') {
        eventType = null;
      }
    }
  }
}
