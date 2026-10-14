'use client';

export function ToolCallDetails({ args, result, error }: { args?: unknown; result?: unknown; error?: string }) {
  return (
    <div className="mt-1 space-y-2 rounded-lg border border-border bg-card/50 p-2 text-xs">
      {args !== undefined && (
        <div>
          <div className="mb-0.5 text-muted-foreground">Arguments</div>
          <pre className="max-h-32 overflow-x-auto rounded bg-muted/50 p-1.5">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
      {error && (
        <div>
          <div className="mb-0.5 text-red-400">Error</div>
          <pre className="overflow-x-auto rounded bg-red-500/10 p-1.5 text-red-400">
            {error}
          </pre>
        </div>
      )}
      {result !== undefined && (
        <div>
          <div className="mb-0.5 text-muted-foreground">Result</div>
          <pre className="max-h-32 overflow-x-auto rounded bg-muted/50 p-1.5">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
