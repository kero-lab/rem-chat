import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { isSafeHref, SafeLink } from '../../src/render/safe-link';

describe('isSafeHref', () => {
  it.each(['https://a.example', 'HTTP://a.example', 'mailto:a@b.c', '/ok', '/a/b?c=1', '#top', '?q=1'])('allows %s', (h) => expect(isSafeHref(h)).toBe(true));
  it.each(['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example', '/\\evil.example', 'relative/path', ''])('blocks %j', (h) => expect(isSafeHref(h)).toBe(false));
});

describe('SafeLink', () => {
  it('external links get target and rel', () => {
    const a = render(<SafeLink href="https://a.example">x</SafeLink>).container.querySelector('a')!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });
  it('relative links stay in the tab', () => {
    const a = render(<SafeLink href="/x">x</SafeLink>).container.querySelector('a')!;
    expect(a.getAttribute('target')).toBeNull();
  });
  it('unsafe hrefs render plain text', () => {
    const { container } = render(<SafeLink href="javascript:alert(1)">x</SafeLink>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('x');
  });
});
