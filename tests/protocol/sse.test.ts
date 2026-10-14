import { describe, it, expect } from 'vitest';
import { parseRemChatStream } from '../../src/protocol/sse';

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { for (const s of chunks) c.enqueue(enc.encode(s)); c.close(); } });
}
async function all(chunks: string[]) { const out = []; for await (const e of parseRemChatStream(body(chunks))) out.push(e); return out; }

describe('parseRemChatStream', () => {
  it('parses text, tool_call, sources, done, error', async () => {
    const ev = await all([
      'event: text\ndata: {"delta":"Hi"}\n\n',
      'event: tool_call\ndata: {"tool":"weather","status":"calling","toolCallId":"t1"}\n\n',
      'event: sources\ndata: {"toolCallId":"t1","sources":[{"n":1,"url":"https://a"}]}\n\n',
      'event: done\ndata: {"debug":{}}\n\n',
      'event: error\ndata: {"message":"boom"}\n\n',
    ]);
    expect(ev.map((e) => e.type)).toEqual(['text', 'tool_call', 'sources', 'done', 'error']);
    expect(ev[0]).toEqual({ type: 'text', delta: 'Hi' });
  });
  it('carries event: across chunk boundaries (#2140)', async () => {
    const ev = await all(['event: text\n', 'data: {"delta":"split"}\n\n']);
    expect(ev).toEqual([{ type: 'text', delta: 'split' }]);
  });
  it('splits a data line across chunks', async () => {
    const ev = await all(['event: text\ndata: {"del', 'ta":"x"}\n\n']);
    expect(ev).toEqual([{ type: 'text', delta: 'x' }]);
  });
  it('skips malformed JSON and unknown events', async () => {
    const ev = await all(['event: text\ndata: {bad\n\n', 'event: nope\ndata: {}\n\n', 'event: text\ndata: {"delta":"ok"}\n\n']);
    expect(ev).toEqual([{ type: 'text', delta: 'ok' }]);
  });
});
