'use client';

import * as React from 'react';
import { CheckCircle2, CircleStop, Loader2, Wrench, XCircle } from 'lucide-react';
import { cn, formatDurationMs } from '../lib/utils';
import { ChatTip } from './chat-tip';
import { toolNameOf, type ToolPart } from '../protocol/parts';

export type ChipStatus = 'running' | 'done' | 'stopped' | 'failed';

/** A Stop (or a turn that ended mid-call) is the user's own action, not an error (rem-chat#1). */
export function chipStatusOf(part: ToolPart): ChipStatus {
  if (part.state === 'input-streaming' || part.state === 'input-available') return 'running';
  if (part.state === 'output-error') return part.outcome === 'cancelled' ? 'stopped' : 'failed';
  return 'done';
}

const STATUS_TEXT: Record<ChipStatus, string> = {
  running: 'text-muted-foreground',
  done: 'text-green-600 dark:text-green-400',
  stopped: 'text-muted-foreground',
  failed: 'text-red-600 dark:text-red-400',
};

const ICON: Record<ChipStatus, React.ReactNode> = {
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  done: <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />,
  stopped: <CircleStop className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />,
};

/** "1m 5s": digits in tabular numerals, units quieter. */
function Duration({ ms }: { ms: number }) {
  return (
    <span className="tabular-nums">
      {formatDurationMs(ms).split(/(\d+)/).filter(Boolean).map((s, i) =>
        /^\d+$/.test(s) ? <span key={i} className="font-medium">{s}</span> : <span key={i} className="opacity-60">{s}</span>,
      )}
    </span>
  );
}

/** Tooltip prose: tool name as code, duration, status word in its status colour. */
function ChipTip({ part, status }: { part: ToolPart; status: ChipStatus }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <code className="font-mono">{toolNameOf(part)}</code>
      {part.durationMs != null && <><span aria-hidden className="opacity-40">·</span><Duration ms={part.durationMs} /></>}
      <span aria-hidden className="opacity-40">·</span>
      <span className={cn('font-medium', STATUS_TEXT[status])}>{status}</span>
    </span>
  );
}

/** Inline tool chip (#2091 D6). The chip says what ran and how it ended; details on demand. */
export function ToolChip({ part, open, onToggle }: { part: ToolPart; open: boolean; onToggle: () => void }) {
  const status = chipStatusOf(part);
  const failed = status === 'failed';
  return (
    <ChatTip label={<ChipTip part={part} status={status} />}>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={[toolNameOf(part), part.durationMs != null ? formatDurationMs(part.durationMs) : null, status].filter(Boolean).join(', ')}
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors',
        failed ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300' : 'border-border bg-muted/50 text-foreground/80 hover:bg-muted',
        open && 'ring-1 ring-ring',
      )}
    >
      <Wrench className="h-3 w-3 shrink-0 opacity-70" />
      <span className="font-mono">{toolNameOf(part)}</span>
      {part.durationMs != null && <span className={cn('tabular-nums', failed ? 'opacity-80' : 'text-muted-foreground')}>{formatDurationMs(part.durationMs)}</span>}
      {ICON[status]}
    </button>
    </ChatTip>
  );
}
