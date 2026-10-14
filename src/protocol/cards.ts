// deployments/monitoring/remhub/src/lib/chat/cards.ts
import { isToolPart, type Part, type ToolCard, type ToolPart } from './parts';

const KIND = /^[a-z][a-z0-9_-]{0,31}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Shape-check a card off the wire (#2140). `data` is validated per kind by the registry. */
export function sanitizeCard(raw: unknown): ToolCard | undefined {
  if (!isObj(raw)) return undefined;
  const { kind, v, asOf, title, subtitle, data, fallbackText, refresh } = raw;
  if (typeof kind !== 'string' || !KIND.test(kind)) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return undefined;
  if (typeof asOf !== 'string' || Number.isNaN(Date.parse(asOf))) return undefined;
  if (typeof title !== 'string' || typeof fallbackText !== 'string') return undefined;
  const card: ToolCard = { kind, v, asOf, title, data, fallbackText };
  if (typeof subtitle === 'string') card.subtitle = subtitle;
  if (isObj(refresh) && typeof refresh.kind === 'string' && KIND.test(refresh.kind) && isObj(refresh.args)) {
    card.refresh = { kind: refresh.kind, args: refresh.args };
  }
  return card;
}

/** A turn's cards, in call order (#2140). */
export function cardsOf(parts: Part[]): Array<{ part: ToolPart; card: ToolCard }> {
  return parts.flatMap((p) => (isToolPart(p) && p.card ? [{ part: p, card: p.card }] : []));
}
