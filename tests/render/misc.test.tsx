import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatTip } from '../../src/render/chat-tip';
import { ToolChip } from '../../src/render/tool-chip';
import { ToolCallDetails } from '../../src/render/tool-call-details';
import type { ToolPart } from '../../src/protocol/parts';

describe('ChatTip', () => {
  it('labels its child with a tooltip', () => {
    render(<ChatTip label="Send" shortcut="Enter"><button>go</button></ChatTip>);
    expect(screen.getByRole('tooltip').textContent).toContain('Send');
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
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
});

describe('ToolCallDetails', () => {
  it('shows args, error and result', () => {
    render(<ToolCallDetails args={{ q: 1 }} error="boom" result={{ ok: true }} />);
    expect(screen.getByText('Arguments')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
