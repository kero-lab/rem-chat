// #2091 2b-1 live check: sending a message must jump to the bottom even when the scroll lock was lost
// (Studio's composer reset nudged scrollTop up 1 px, which use-stick-to-bottom reads as "user scrolled away").
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const scrollToBottom = vi.fn();
vi.mock('use-stick-to-bottom', () => {
  const StickToBottom = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  StickToBottom.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { StickToBottom, useStickToBottomContext: () => ({ isAtBottom: false, scrollToBottom }) };
});

import { ChatScroll } from '../../src/render/chat-scroll';

beforeEach(() => scrollToBottom.mockClear());

describe('ChatScroll followKey', () => {
  it('does not scroll on mount (the initial position is the library\'s job)', () => {
    render(<ChatScroll followKey="u1"><p>hi</p></ChatScroll>);
    expect(scrollToBottom).not.toHaveBeenCalled();
  });
  it('scrolls to the bottom when the key changes (a new message of yours)', () => {
    const { rerender } = render(<ChatScroll followKey="u1"><p>hi</p></ChatScroll>);
    rerender(<ChatScroll followKey="u2"><p>hi</p></ChatScroll>);
    expect(scrollToBottom).toHaveBeenCalledTimes(1);
  });
  it('re-renders with the same key (streaming) do not force a scroll', () => {
    const { rerender } = render(<ChatScroll followKey="u1"><p>a</p></ChatScroll>);
    rerender(<ChatScroll followKey="u1"><p>ab</p></ChatScroll>);
    expect(scrollToBottom).not.toHaveBeenCalled();
  });
});
