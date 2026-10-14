/**
 * Message parts (#2091 spec §4.3): the AI SDK UIMessage shape. Every part a
 * client cannot render degrades to text: DataPart carries `fallbackText`, and
 * the message's `content` is always the whole reply as plain markdown.
 */
export type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
export type ToolOutcome = 'ok' | 'error' | 'refused' | 'withheld' | 'rate_limited' | 'daily_cap' | 'timeout' | 'cancelled';
export const TOOL_OUTCOMES: ReadonlySet<ToolOutcome> = new Set<ToolOutcome>(['ok', 'error', 'refused', 'withheld', 'rate_limited', 'daily_cap', 'timeout', 'cancelled']);

export interface TextPart { type: 'text'; text: string }
export interface ToolPart {
  type: `tool-${string}`;
  toolCallId: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  outcome?: ToolOutcome;
  durationMs?: number;
  category?: string;
  media?: FilePart[];
  /** web_search results this call cited as [1]..[n] (#2091 R4). Numbering restarts per call. */
  sources?: SourceRef[];
  /** #2140 — the call's card; rendered after the reply text, before Sources. */
  card?: ToolCard;
  /** Epoch ms the call began; drives the inline image placeholder (#2091). */
  startedAt?: number;
}
/** One cited source (#2091 R4): `n` is the [n] rem-core printed for it; http(s) only, title falls back to the host. */
export interface SourceRef { n: number; title: string; url: string }
/** A structured card a tool attached (#2140); rendered by the card registry, else its fallbackText. */
export interface ToolCard {
  kind: string;
  v: number;
  asOf: string;
  title: string;
  subtitle?: string;
  data: unknown;
  fallbackText: string;
  refresh?: { kind: string; args: Record<string, unknown> };
}
export interface FilePart { type: 'file'; url: string; mediaType: string; name?: string; width?: number; height?: number }
export interface DataPart { type: `data-${string}`; data: unknown; fallbackText: string }
export type Part = TextPart | ToolPart | FilePart | DataPart;

export function isToolPart(p: { type: string }): p is ToolPart {
  return p.type.startsWith('tool-');
}
export function toolNameOf(p: ToolPart): string {
  return p.type.slice('tool-'.length);
}
