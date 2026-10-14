'use client';

import * as React from 'react';

/**
 * Tooltip for the chat sheet's icon-only controls: a CSS-only bubble (no tooltip library in the package),
 * 300 ms hover delay (house rule), z-[120] so it clears a Cmd+K palette at z-[100]/[101].
 * Shows on keyboard focus too. The child is wrapped, so it needs no ref.
 */
export function ChatTip({ label, shortcut, children }: { label: React.ReactNode; shortcut?: string; children: React.ReactElement }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[120] mb-1.5 w-max max-w-xs -translate-x-1/2 rounded-md border border-border/50 bg-popover px-3 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-within/tip:opacity-100"
      >
        {label}
        {shortcut && <kbd className="ml-2 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>}
      </span>
    </span>
  );
}
