import { describe, it, expect } from 'vitest';
import { isAllowedChatImage, DEFAULT_IMAGE_HOSTS } from '../../src/render/image-allowlist';

describe('isAllowedChatImage', () => {
  it('defaults', () => {
    expect(DEFAULT_IMAGE_HOSTS).toEqual(['cdn.discordapp.com', 'media.discordapp.net', 'cdn.kero-ara.com']);
    expect(isAllowedChatImage('https://cdn.discordapp.com/a.png')).toBe(true);
    expect(isAllowedChatImage('https://evil.example/a.png')).toBe(false);
    expect(isAllowedChatImage('http://cdn.discordapp.com/a.png')).toBe(false);
    expect(isAllowedChatImage('https://x.rem.home/a.png')).toBe(false);
  });
  it('extra suffixes and hosts are opt-in', () => {
    expect(isAllowedChatImage('https://x.rem.home/a.png', { extraSuffixes: ['.rem.home'] })).toBe(true);
    expect(isAllowedChatImage('https://img.example/a.png', { extraHosts: ['img.example'] })).toBe(true);
    expect(isAllowedChatImage('https://rem.home.evil.example/x.png', { extraSuffixes: ['.rem.home'] })).toBe(false);
  });
  it('same-origin relative URLs are allowed', () => {
    expect(isAllowedChatImage('/api/img/1.png')).toBe(true);
    expect(isAllowedChatImage('/api/img/1.png', { origin: 'https://hub.example' })).toBe(true);
    expect(isAllowedChatImage('https://hub.example/a.png', { origin: 'https://hub.example' })).toBe(true);
    expect(isAllowedChatImage('https://hub.example/a.png')).toBe(false);
  });
  it.each([
    '//evil.example/x.png',
    '/\\evil.example/x.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'javascript:alert(1)',
    'https://cdn.discordapp.com.evil.example/x.png',
    'relative/path.png',
    undefined,
    '',
  ])('blocks %s', (src) => expect(isAllowedChatImage(src)).toBe(false));
});
