import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatTip, ChatTipContext } from '../../src/render/chat-tip';
import { ToolChip, chipStatusOf } from '../../src/render/tool-chip';
import { ToolCallDetails } from '../../src/render/tool-call-details';
import type { ToolPart } from '../../src/protocol/parts';

describe('ChatTip', () => {
  it('labels its child with a tooltip', () => {
    render(<ChatTip label="Send" shortcut="Enter"><button>go</button></ChatTip>);
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.textContent).toContain('Send');
    expect(screen.getByRole('button', { name: 'go' }).getAttribute('aria-describedby')).toBe(tip.id);
  });
  it('adds no wrapper box around the child', () => {
    const { container } = render(<div id="row"><ChatTip label="Send"><button>go</button></ChatTip></div>);
    expect(container.querySelector('#row > button')).not.toBeNull();
  });
  it('uses a provided tip component instead of the CSS bubble', () => {
    const Mine = ({ label, children }: { label: React.ReactNode; children: React.ReactElement }) => <span data-testid="mine" data-label={String(label)}>{children}</span>;
    render(<ChatTipContext.Provider value={Mine}><ChatTip label="Send"><button>go</button></ChatTip></ChatTipContext.Provider>);
    expect(screen.getByTestId('mine').getAttribute('data-label')).toBe('Send');
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  });
});

describe('ChatTip describedby', () => {
  it('keeps a description the child already has', () => {
    render(<ChatTip label="Send"><button aria-describedby="hint">go</button></ChatTip>);
    const ids = screen.getByRole('button').getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('hint');
    expect(ids).toHaveLength(2);
  });
});

describe('ToolChip', () => {
  const part: ToolPart = { type: 'tool-web_search', toolCallId: 't', state: 'output-available', durationMs: 2500 };
  it('names the tool and duration, and toggles', () => {
    let toggled = 0;
    render(<ToolChip part={part} open={false} onToggle={() => toggled++} />);
    const b = screen.getByRole('button');
    expect(b.textContent).toContain('web_search');
    expect(b.textContent).toContain('3s');
    b.click();
    expect(toggled).toBe(1);
  });
  it('a stopped call reads as stopped, not failed (rem-chat#1)', () => {
    render(<ToolChip part={{ ...part, state: 'output-error', outcome: 'cancelled' }} open={false} onToggle={() => {}} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('data-status')).toBe('stopped');
    expect(b.getAttribute('aria-label')).toContain('stopped');
    expect(b.className).not.toContain('red-');
  });
  it.each(['error', 'timeout', 'refused', 'withheld', 'rate_limited', 'daily_cap'] as const)('outcome %s reads as failed', (outcome) => {
    expect(chipStatusOf({ ...part, state: 'output-error', outcome })).toBe('failed');
  });
  it('a real error still reads as failed', () => {
    render(<ToolChip part={{ ...part, state: 'output-error', outcome: 'error' }} open={false} onToggle={() => {}} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('data-status')).toBe('failed');
    expect(b.className).toContain('red-');
  });
  it('tooltip prose styles the name as code and colours the status word', () => {
    render(<ToolChip part={part} open={false} onToggle={() => {}} />);
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.querySelector('code')?.textContent).toBe('web_search');
    expect(tip.querySelector('.tabular-nums')?.textContent).toBe('3s');
    expect(tip.querySelector('.text-green-700')?.textContent).toBe('done');
  });
});

describe('ToolCallDetails', () => {
  it('shows args, error and result', () => {
    render(<ToolCallDetails args={{ q: 1 }} error="boom" result={{ ok: true }} />);
    expect(screen.getByText('Arguments')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
