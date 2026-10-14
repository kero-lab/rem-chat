'use client';

import * as React from 'react';
import { ArrowDown } from 'lucide-react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { cn } from '../lib/utils';

export const useChatScroll = useStickToBottomContext;

/**
 * Your own message always lands in view: when `followKey` (the id of your latest message) changes,
 * jump to the bottom even if the lock was lost. A 1-2 px layout nudge (Studio's composer resetting its
 * height on send) reads to the library as "scrolled away" and would otherwise strand the reply (#2091).
 */
function FollowOnSend({ followKey }: { followKey?: string }) {
  const { scrollToBottom } = useStickToBottomContext();
  const seen = React.useRef(followKey);
  React.useEffect(() => {
    if (followKey === seen.current) return;
    seen.current = followKey;
    if (followKey !== undefined) void scrollToBottom();
  }, [followKey, scrollToBottom]);
  return null;
}

function JumpToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs shadow-lg hover:bg-muted"
    >
      <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
    </button>
  );
}

/**
 * Follows the stream only while the reader is at the bottom (#2091 §4.4).
 * StickToBottom.Content renders its own `height: 100%` scroll element, so the
 * outer box clips and that element inherits any max-height set via className.
 * The outer box is a flex column so the scroll element can shrink (min-h-0 flex-1) inside a
 * content-sized, max-height-capped parent, where `height: 100%` has nothing definite to resolve against.
 */
export function ChatScroll({
  className,
  contentClassName,
  followKey,
  children,
}: {
  className?: string;
  contentClassName?: string;
  /** Id of the reader's latest message; a change scrolls to the bottom. */
  followKey?: string;
  children: React.ReactNode;
}) {
  return (
    <StickToBottom className={cn('relative flex flex-col overflow-hidden', className)} resize="smooth" initial="instant">
      <StickToBottom.Content scrollClassName="min-h-0 flex-1 max-h-[inherit]" className={contentClassName}>
        {children}
      </StickToBottom.Content>
      <FollowOnSend followKey={followKey} />
      <JumpToLatest />
    </StickToBottom>
  );
}
