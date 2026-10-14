import { isToolPart, type Part, type SourceRef } from './parts';

/** Host without "www.", or null when the url is not http(s). */
export function sourceHost(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Keeps http(s) sources only; a missing title falls back to the host (#2091 R4). Each keeps the [n]
 * rem-core printed (`n`, or the 1-based array position when an older rem-core sent none), so a
 * dropped entry is a hole and never renumbers the ones after it.
 */
export function sanitizeSources(raw: unknown): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s, i): SourceRef[] => {
    if (!s || typeof s !== 'object') return [];
    const { n, title, url } = s as Record<string, unknown>;
    if (typeof url !== 'string') return [];
    const host = sourceHost(url);
    if (!host) return [];
    const num = typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : i + 1;
    return [{ n: num, title: typeof title === 'string' && title.trim() ? title.trim() : host, url }];
  });
}

/** Merges by n (first one wins), ordered by n. No url dedupe: two results may share a url and keep both numbers. */
export function mergeSources(prev: SourceRef[] | undefined, add: SourceRef[]): SourceRef[] {
  const byN = new Map<number, SourceRef>();
  for (const s of [...(prev ?? []), ...add]) if (!byN.has(s.n)) byN.set(s.n, s);
  return [...byN.values()].sort((a, b) => a.n - b.n);
}

/** Source n of a call's list, by its printed number, never by array position. */
export function sourceAt(sources: readonly SourceRef[] | undefined, n: number): SourceRef | undefined {
  return sources?.find((s) => s.n === n);
}

/**
 * The list a text part's [n] refers to: the nearest preceding call with sources.
 * web_search restarts at [1] per call, and the model cites the results it just read.
 */
export function citationSourcesFor(parts: Part[], textIndex: number): SourceRef[] | undefined {
  for (let i = textIndex - 1; i >= 0; i--) {
    const p = parts[i];
    if (isToolPart(p) && p.sources?.length) return p.sources;
  }
  return undefined;
}

/** Every call's sources, in call order, for the Sources row. */
export function sourceGroupsOf(parts: Part[]): SourceRef[][] {
  return parts.flatMap((p) => (isToolPart(p) && p.sources?.length ? [p.sources] : []));
}
