'use client';

const isObj = (p: unknown): p is Record<string, unknown> => typeof p === 'object' && p !== null;

/** A part (or card, #2140) this client can't render: its fallbackText, never a blank. Own module so cards don't pull in the markdown stack. */
export function UnsupportedPart({ part, debug }: { part: unknown; debug: boolean }) {
  const p = isObj(part) ? part : {};
  return (
    <div className="my-1 rounded-md border border-dashed border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
      <div className="text-[10px] uppercase tracking-wide opacity-70">Unsupported block · {String(p.type ?? 'unknown')}</div>
      {typeof p.fallbackText === 'string' && <div className="mt-0.5 whitespace-pre-wrap">{p.fallbackText}</div>}
      {debug && (
        <details className="mt-1">
          <summary className="cursor-pointer">JSON</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/50 p-1.5">{JSON.stringify(part, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
