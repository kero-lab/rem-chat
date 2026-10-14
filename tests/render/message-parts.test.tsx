import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/render/chat-markdown', () => ({
  ChatMarkdown: ({ text, streaming, className }: { text: string; streaming?: boolean; className?: string }) => (
    <div data-testid="md" data-streaming={String(!!streaming)} data-class={className}>{text}</div>
  ),
}));

import { PartView, RENDERERS, type PartRenderer } from '../../src/render/part-registry';
import { MessageParts } from '../../src/render/message-parts';
import type { ChatMessage } from '../../src/protocol/types';

const ctx = { seed: 'm', streaming: false, density: 'comfortable' as const, debug: false };
const msg = (over: Partial<ChatMessage>): ChatMessage => ({ id: 'm1', role: 'assistant', content: '', timestamp: new Date(0), ...over });

describe('part registry', () => {
  it('unknown part types fall back to their fallbackText', () => {
    render(<PartView part={{ type: 'data-widget', data: {}, fallbackText: 'A chart of CPU' } as never} ctx={ctx} />);
    expect(screen.getByText('A chart of CPU')).toBeInTheDocument();
    expect(screen.getByText(/unsupported block/i)).toBeInTheDocument();
  });
  it('invalid parts fall back instead of crashing', () => {
    render(<PartView part={{ type: 'text', text: 42 } as never} ctx={ctx} />);
    expect(screen.getByText(/unsupported block/i)).toBeInTheDocument();
  });
  it('a throwing renderer is contained by its error boundary', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom: PartRenderer = { matches: (t) => t === 'text', validate: () => true, Component: () => { throw new Error('boom'); } };
    render(
      <div>
        <PartView part={{ type: 'text', text: 'x' } as never} ctx={ctx} renderers={[Boom]} />
        <span>sibling survives</span>
      </div>,
    );
    expect(screen.getByText('sibling survives')).toBeInTheDocument();
    expect(screen.getByText(/unsupported block/i)).toBeInTheDocument();
    spy.mockRestore();
  });
  it('debug mode shows the raw JSON of an unsupported part', () => {
    render(<PartView part={{ type: 'data-x', data: { k: 1 }, fallbackText: 'f' } as never} ctx={{ ...ctx, debug: true }} />);
    expect(screen.getByText(/"k": 1/)).toBeInTheDocument();
  });
  it('the default registry covers text, tool and file', () => {
    expect(RENDERERS.some((r) => r.matches('text'))).toBe(true);
    expect(RENDERERS.some((r) => r.matches('tool-web_search'))).toBe(true);
    expect(RENDERERS.some((r) => r.matches('file'))).toBe(true);
  });
  it('recovers when the part changes after a throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const R: PartRenderer = {
      matches: (t) => t === 'text', validate: () => true,
      Component: (({ part }: { part: { text: string } }) => { if (part.text === 'bad') throw new Error('x'); return <span>{part.text}</span>; }) as PartRenderer['Component'],
    };
    const { rerender } = render(<PartView part={{ type: 'text', text: 'bad' } as never} ctx={ctx} renderers={[R]} />);
    expect(screen.getByText(/unsupported block/i)).toBeInTheDocument();
    rerender(<PartView part={{ type: 'text', text: 'good!' } as never} ctx={ctx} renderers={[R]} />);
    expect(screen.getByText('good!')).toBeInTheDocument();
    spy.mockRestore();
  });
  it('file parts: images through ImagePart, others as a safe link', () => {
    const { container } = render(
      <>
        <PartView part={{ type: 'file', url: 'https://cdn.discordapp.com/a.png', mediaType: 'image/png', name: 'a' } as never} ctx={ctx} />
        <PartView part={{ type: 'file', url: 'https://example.com/r.pdf', mediaType: 'application/pdf', name: 'Report' } as never} ctx={ctx} />
        <PartView part={{ type: 'file', url: 'javascript:alert(1)', mediaType: 'application/pdf', name: 'Evil' } as never} ctx={ctx} />
      </>,
    );
    expect(container.querySelector('img')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Report' }).getAttribute('href')).toBe('https://example.com/r.pdf');
    expect(screen.queryByRole('link', { name: 'Evil' })).toBeNull();
  });
});

describe('MessageParts', () => {
  it('renders text, a chip row, then text, in stream order', async () => {
    const { container } = render(
      <MessageParts
        message={msg({
          content: 'a b',
          parts: [
            { type: 'text', text: 'Before' },
            { type: 'tool-web_search', toolCallId: '1', state: 'output-available', outcome: 'ok', durationMs: 120 },
            { type: 'tool-weather', toolCallId: '2', state: 'output-error', outcome: 'error', errorText: 'denied' },
            { type: 'text', text: 'After' },
          ],
        })}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('After'));
    const text = container.textContent!;
    expect(text.indexOf('Before')).toBeLessThan(text.indexOf('web_search'));
    expect(text.indexOf('weather')).toBeLessThan(text.indexOf('After'));
    expect(container.querySelectorAll('[data-chip-row]')).toHaveLength(1);
  });
  it('a chip expands to its details', () => {
    render(<MessageParts message={msg({ parts: [{ type: 'tool-ssh', toolCallId: '1', state: 'output-error', outcome: 'error', errorText: 'denied', input: { host: 'x' } }] })} />);
    fireEvent.click(screen.getByRole('button', { name: /ssh/ }));
    expect(screen.getByText('denied')).toBeInTheDocument();
  });
  it('keeps the tool details region in the tree while collapsed, hidden from assistive tech', () => {
    const withTool = msg({ parts: [{ type: 'tool-web_search', toolCallId: '1', state: 'output-available', outcome: 'ok', input: { q: 'x' }, output: 'r' }] });
    const { container } = render(<MessageParts message={withTool} />);
    fireEvent.click(screen.getByRole('button', { name: /web_search/ }));
    expect(container.querySelector('[data-slot="tool-details"]')!.getAttribute('aria-hidden')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /web_search/ }));
    expect(container.querySelector('[data-slot="tool-details"]')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('legacy messages render through the normaliser', async () => {
    const { container } = render(<MessageParts message={msg({ content: 'Legacy reply', toolCalls: [{ tool: 'old_tool', status: 'done' }] })} />);
    await waitFor(() => expect(container.textContent).toContain('Legacy reply'));
    expect(container.textContent).toContain('old_tool');
  });
  it('thinking tags never reach the rendered text', async () => {
    const { container } = render(<MessageParts message={msg({ parts: [{ type: 'text', text: '<rem_thinking>secret plan</rem_thinking>Hello' }] })} />);
    await waitFor(() => expect(container.textContent).toContain('Hello'));
    expect(container.textContent).not.toContain('secret plan');
  });
  it('only the last text part streams', () => {
    const m = msg({ parts: [{ type: 'text', text: 'one' }, { type: 'tool-x', toolCallId: '1', state: 'output-available', outcome: 'ok' }, { type: 'text', text: 'two' }] });
    const { unmount } = render(<MessageParts message={m} streaming />);
    expect(screen.getAllByTestId('md').map((e) => e.getAttribute('data-streaming'))).toEqual(['false', 'true']);
    unmount();
    render(<MessageParts message={m} streaming={false} />);
    expect(screen.getAllByTestId('md').map((e) => e.getAttribute('data-streaming'))).toEqual(['false', 'false']);
  });
  it('a tool-only reply shows its chip', () => {
    render(<MessageParts message={msg({ isLoading: true, parts: [{ type: 'tool-ssh', toolCallId: '1', state: 'input-available' }] })} streaming />);
    expect(screen.getByRole('button', { name: /ssh/ })).toBeInTheDocument();
  });
});

describe('MessageParts injection points', () => {
  it('renders a registered card and ignores unknown kinds', () => {
    const card = (kind: string) => ({ kind, v: 1, asOf: new Date(0).toISOString(), title: 'T', data: {}, fallbackText: 'fb' });
    const m = msg({ parts: [
      { type: 'tool-weather', toolCallId: 'a', state: 'output-available', card: card('weather') },
      { type: 'tool-x', toolCallId: 'b', state: 'output-available', card: card('nope') },
    ] });
    const { container } = render(<MessageParts message={m} cards={{ weather: ({ card: c, part }) => <div>WEATHER CARD {c.title} {part.toolCallId}</div> }} />);
    expect(screen.getByText('WEATHER CARD T a')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="cards"] > *')).toHaveLength(1);
    // Both chips still show.
    expect(screen.getByRole('button', { name: /weather/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tool-x|x/ })).toBeInTheDocument();
  });
  it('renders cards after the reply text and no card slot without cards', () => {
    const m = msg({ parts: [
      { type: 'tool-weather', toolCallId: 'a', state: 'output-available', card: { kind: 'weather', v: 1, asOf: new Date(0).toISOString(), title: 'T', data: {}, fallbackText: 'fb' } },
      { type: 'text', text: 'Reply' },
    ] });
    const { container, rerender } = render(<MessageParts message={m} cards={{ weather: () => <div>CARD</div> }} />);
    expect(container.textContent!.indexOf('Reply')).toBeLessThan(container.textContent!.indexOf('CARD'));
    rerender(<MessageParts message={m} />);
    expect(container.querySelector('[data-slot="cards"]')).toBeNull();
  });
  it('a throwing card falls back to its fallbackText', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = msg({ parts: [{ type: 'tool-weather', toolCallId: 'a', state: 'output-available', card: { kind: 'weather', v: 1, asOf: new Date(0).toISOString(), title: 'T', data: {}, fallbackText: 'Sunny, 18C' } }] });
    render(<MessageParts message={m} cards={{ weather: () => { throw new Error('bad'); } }} />);
    expect(screen.getByText('Sunny, 18C')).toBeInTheDocument();
    spy.mockRestore();
  });
  it('renderers override the defaults per part type', () => {
    const Mine: PartRenderer = { matches: () => true, validate: () => true, Component: (() => <div>MINE</div>) as PartRenderer['Component'] };
    render(
      <MessageParts message={msg({ parts: [{ type: 'text', text: 'hello' }, { type: 'data-widget', data: {}, fallbackText: 'w' }] })} renderers={{ text: Mine, 'data-widget': Mine }} />,
    );
    expect(screen.getAllByText('MINE')).toHaveLength(2);
    expect(screen.queryByTestId('md')).toBeNull();
  });
  it('passes markdown props through to ChatMarkdown', () => {
    render(<MessageParts message={msg({ parts: [{ type: 'text', text: 'hi' }] })} markdown={{ className: 'custom' }} />);
    expect(screen.getByTestId('md').getAttribute('data-class')).toBe('custom');
  });
  it('passes toolMedia props (renderNavLink, renderGenerating) to ToolMedia', () => {
    const m = msg({ parts: [{ type: 'tool-generate_image', toolCallId: '1', state: 'output-available', outcome: 'ok' }] });
    render(
      <MessageParts
        message={m}
        toolMedia={{ openHref: '/gallery', renderNavLink: ({ href, children }) => <a data-testid="nav" href={href}>{children}</a>, renderGenerating: ({ label }) => <div>GENERATING {label}</div> }}
      />,
    );
    expect(screen.getByText(/GENERATING/)).toBeInTheDocument();
    expect(screen.getByTestId('nav').getAttribute('href')).toBe('/gallery');
  });
});
