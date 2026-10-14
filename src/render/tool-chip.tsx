'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, Wrench, XCircle } from 'lucide-react';
import { cn, formatDurationMs } from '../lib/utils';
import { ChatTip } from './chat-tip';
import { toolNameOf, type ToolPart } from '../protocol/parts';

/** Inline tool chip (#2091 D6). The chip says what ran and how it ended; details on demand. */
export function ToolChip({ part, open, onToggle }: { part: ToolPart; open: boolean; onToggle: () => void }) {
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const failed = part.state === 'output-error';
  const stateLabel = running ? 'running' : failed ? 'failed' : 'done';
  const label = [toolNameOf(part), part.durationMs != null ? formatDurationMs(part.durationMs) : null, stateLabel].filter(Boolean).join(' · ');
  return (
    <ChatTip label={label}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
        failed ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300' : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
        open && 'ring-1 ring-ring',
      )}
    >
      <Wrench className="h-3 w-3 shrink-0" />
      <span className="font-mono">{toolNameOf(part)}</span>
      {part.durationMs != null && <span className="tabular-nums opacity-70">{formatDurationMs(part.durationMs)}</span>}
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : failed ? <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
    </button>
    </ChatTip>
  );
}
