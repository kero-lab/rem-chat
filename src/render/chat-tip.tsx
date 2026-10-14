'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export type TipComponent = (p: { label: React.ReactNode; shortcut?: string; children: React.ReactElement }) => React.ReactNode;

/** Apps provide their own tooltip (RemHub: its radix wrapper); without one, ChatTip falls back to a CSS bubble. */
export const ChatTipContext = React.createContext<TipComponent | undefined>(undefined);
export const TipProvider = ChatTipContext.Provider;

/**
 * Tooltip for icon-only controls. Fallback: no wrapper box (the child keeps its place in a flex row), a CSS
 * bubble shown after 300 ms hover or on keyboard focus, z-[120] to clear a Cmd+K palette. The bubble is
 * aria-hidden and wired with aria-describedby, so screen readers announce it with the control, not inline.
 * The child must forward className and aria-describedby (a native element does).
 */
export function ChatTip({ label, shortcut, children }: { label: React.ReactNode; shortcut?: string; children: React.ReactElement }) {
  const Provided = React.useContext(ChatTipContext);
  const id = React.useId();
  if (Provided) return <Provided label={label} shortcut={shortcut}>{children}</Provided>;
  const own = children.props as { className?: string; 'aria-describedby'?: string };
  const child = React.cloneElement(children as React.ReactElement<{ className?: string; 'aria-describedby'?: string }>, {
    className: cn('peer', own.className),
    // Keep a description the child already carries; the bubble adds to it.
    'aria-describedby': own['aria-describedby'] ? `${own['aria-describedby']} ${id}` : id,
  });
  return (
    <>
      {child}
      {/* No offsets: an absolute box stays at its static position, right after the control, and lifts above it. */}
      <span
        id={id}
        role="tooltip"
        aria-hidden
        className="pointer-events-none absolute z-[120] -mt-1.5 w-max max-w-xs -translate-y-full rounded-md border border-border/50 bg-popover px-3 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity peer-hover:opacity-100 peer-hover:delay-300 peer-focus-visible:opacity-100"
      >
        {label}
        {shortcut && <kbd className="ml-2 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>}
      </span>
    </>
  );
}
