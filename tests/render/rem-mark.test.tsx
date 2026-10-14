import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemMark } from '../../src/render/rem-mark';

const icon = <svg data-testid="rem-icon" />;

describe('RemMark (#2091 D11)', () => {
  it.each([
    ['idle', 'Rem'], ['thinking', 'Rem is thinking'], ['streaming', 'Rem is replying'], ['error', 'Rem hit an error'],
  ] as const)('%s state is labelled', (state, label) => {
    render(<RemMark state={state} icon={icon} />);
    const el = screen.getByRole('img', { name: label });
    expect(el.getAttribute('data-state')).toBe(state);
  });
  it('only the thinking state animates, and only motion-safe', () => {
    const { container, rerender } = render(<RemMark state="thinking" icon={icon} />);
    const ring = container.querySelector('[data-slot="rem-mark-ring"]')!;
    expect(ring.className).toContain('motion-safe:animate-[rem-ring-sweep');
    rerender(<RemMark state="streaming" icon={icon} />);
    expect(container.querySelector('[data-slot="rem-mark-ring"]')!.className).not.toContain('animate-');
  });
  it('uses no image/emote asset', () => {
    const { container } = render(<RemMark state="idle" icon={icon} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('renders the icon the app passes, with an optical-centring transform', () => {
    const { container, getByTestId } = render(<RemMark state="idle" icon={icon} />);
    expect(getByTestId('rem-icon')).toBeInTheDocument();
    expect((container.querySelector('[data-slot="rem-mark-icon"]') as HTMLElement).style.transform).not.toBe('');
  });
});
