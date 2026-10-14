import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const emoteRenders = vi.fn();
vi.mock('../../src/render/discord-token-view', async (orig) => {
  const actual = await orig<typeof import('../../src/render/discord-token-view')>();
  const CountingEmote = (p: Record<string, unknown>) => { emoteRenders(); return actual.DiscordEmote(p); };
  return { ...actual, DiscordEmote: CountingEmote, DISCORD_TOKEN_COMPONENTS: { ...actual.DISCORD_TOKEN_COMPONENTS, 'rem-emote': CountingEmote } };
});

import { ChatMarkdown } from '../../src/render/chat-markdown';

const html = (text: string, streaming = false) => render(<ChatMarkdown text={text} seed="m1" streaming={streaming} discordTokens />).container;

describe('ChatMarkdown (#2091)', () => {
  it('renders emotes, links and inline code', async () => {
    const c = html('Hi <:rem_wave:123456789012345678> see [docs](https://github.com/a) and `x`');
    await waitFor(() => expect(c.querySelector('img[alt=":rem_wave:"]')).not.toBeNull());
    expect(c.querySelector('a[href="https://github.com/a"]')).not.toBeNull();
    expect(c.textContent).not.toContain('<:rem_wave');
  });
  it('literal angle brackets survive (Review Focus 2)', async () => {
    const c = html('I <3 you. x < y > z. `<div>` ok');
    await waitFor(() => expect(c.textContent).toContain('I <3 you'));
    expect(c.textContent).toContain('x < y > z');
    expect(c.textContent).toContain('<div>');
  });
  it('hides a half-typed token at the stream tail, but not when finished', async () => {
    expect(html('Hi <:rem_wa', true).textContent).not.toContain('<:rem_wa');
    await waitFor(() => expect(html('Hi <:rem_wa', false).textContent).toContain('<:rem_wa'));
  });
  it('a stopped reply inside an unclosed fence still renders a code block (Review Focus 4)', async () => {
    const c = html('Here:\n\n```ts\nconst x = 1;\n', false);
    await waitFor(() => expect(c.textContent).toContain('const x = 1;'));
    expect(c.querySelector('pre, [data-streamdown="code-block"]')).not.toBeNull();
  });
  it('a half table renders as a table', async () => {
    const c = html('| a | b |\n|---|---|\n| 1 | 2', true);
    await waitFor(() => expect(c.querySelector('table')).not.toBeNull());
  });
  it('an image nested in a link from a foreign host never auto-loads (Review Focus 3)', async () => {
    const c = html('[![x](https://evil.example/a.png)](https://evil.example)');
    await waitFor(() => expect(c.textContent).toMatch(/load image from evil\.example/i));
    expect(c.querySelector('img[src^="https://evil.example"]')).toBeNull();
  });
  it('raw HTML script never runs or renders', async () => {
    const c = html('ok <script>alert(1)</script> <img src=x onerror="alert(1)">');
    await waitFor(() => expect(c.textContent).toContain('ok'));
    expect(c.querySelector('script')).toBeNull();
    expect(c.querySelector('[onerror]')).toBeNull();
    expect(c.textContent).toContain('<script>');
  });
  it('tag-like prose is literal text, never an element (Review Focus 2)', async () => {
    const c = html('a <b> c and more text after');
    await waitFor(() => expect(c.textContent).toContain('a <b> c and more text after'));
    expect(c.querySelector('b')).toBeNull();
  });
  it('generics and component names survive', async () => {
    const c = html('Use the <Button> component and Promise<void> and fn<T>(x)');
    await waitFor(() => expect(c.textContent).toContain('<Button>'));
    expect(c.textContent).toContain('Promise<void>');
    expect(c.textContent).toContain('fn<T>(x)');
  });
  it('emoji shortcodes and kaomoji', async () => {
    const c = html(':wave: [KAOMOJI:Cat]');
    await waitFor(() => expect(c.textContent).toContain('👋'));
    expect(c.textContent).not.toContain('[KAOMOJI');
  });
  it('finished blocks are not re-rendered on every delta (Review Focus 1)', async () => {
    const first = 'Block one <:rem_wave:123456789012345678>\n\n';
    const { rerender } = render(<ChatMarkdown text={first + 'two'} seed="m2" streaming discordTokens />);
    await waitFor(() => expect(emoteRenders).toHaveBeenCalled());
    const before = emoteRenders.mock.calls.length;
    for (const tail of [' more', ' more words', ' more words here']) {
      rerender(<ChatMarkdown text={first + 'two' + tail} seed="m2" streaming discordTokens />);
    }
    expect(emoteRenders.mock.calls.length).toBe(before);
  });
  it('a single newline is a line break (Discord semantics), but fenced code is untouched', async () => {
    const c = html('line one\nline two');
    await waitFor(() => expect(c.textContent).toContain('line two'));
    expect(c.querySelector('br')).not.toBeNull();
    const f = html('```\na\nb\n```');
    await waitFor(() => expect(f.querySelector('pre code > span')).not.toBeNull());
    expect(f.querySelector('br')).toBeNull();
    // Shiki renders one block span per source line: two lines, no <br> injected.
    expect([...f.querySelectorAll('pre code > span')].map((l) => l.textContent)).toEqual(['a', 'b']);
  });
});

describe('ChatMarkdown links and options', () => {
  it('never renders javascript: links, even with a custom renderLink', () => {
    const seen: string[] = [];
    render(<ChatMarkdown text="[x](javascript:alert(1)) [y](/ok) [z](https://a.example)" renderLink={({ href, children }) => { seen.push(href); return <a href={href}>{children}</a>; }} />);
    // streamdown normalises the bare origin to 'https://a.example/'.
    expect(seen).toEqual(['/ok', 'https://a.example/']);
    expect(screen.getByText(/^x/).closest('a')).toBeNull(); // streamdown also marks it [blocked]
  });
  it('external links open safely by default', () => {
    render(<ChatMarkdown text="[z](https://a.example)" />);
    const a = screen.getByText('z').closest('a')!;
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(a.getAttribute('target')).toBe('_blank');
  });
  it('Discord tokens stay literal unless discordTokens is on', async () => {
    const off = render(<ChatMarkdown text="Hi <:rem_wave:123456789012345678>" />).container;
    await waitFor(() => expect(off.textContent).toContain('Hi'));
    expect(off.querySelector('img[alt=":rem_wave:"]')).toBeNull();
  });
  it('appends the app remarkPlugins after the built-ins', async () => {
    const plugin = () => (tree: { children: Array<{ children?: Array<{ value?: string }> }> }) => {
      const t = tree.children[0]?.children?.[0];
      if (t?.value) t.value = t.value.replace('PLAIN', 'FANCY');
    };
    const { container } = render(<ChatMarkdown text="PLAIN text" remarkPlugins={[plugin] as never} />);
    await waitFor(() => expect(container.textContent).toContain('FANCY text'));
  });
  it('imageOpts opens extra hosts for markdown images', async () => {
    const { container } = render(<ChatMarkdown text="![x](https://img.example/a.png)" imageOpts={{ extraHosts: ['img.example'] }} />);
    await waitFor(() => expect(container.querySelector('img[src="https://img.example/a.png"]')).not.toBeNull());
  });
  it('renders [n] citations as source links', async () => {
    const { container } = render(<ChatMarkdown text="Fact [1]." sources={[{ n: 1, title: 'T', url: 'https://s.example/' }]} />);
    await waitFor(() => expect(container.querySelector('a[data-citation="1"]')).not.toBeNull());
  });
});
