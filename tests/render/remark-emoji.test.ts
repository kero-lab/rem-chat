import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { remarkDiscordTokens } from '../../src/render/remark/discord-tokens';
import { remarkEmoji, pickKaomoji, hashSeed } from '../../src/render/remark/emoji';

const run = (md: string, seed = 'm1') =>
  String(unified().use(remarkParse).use(remarkEmoji, { seed }).use(remarkStringify).processSync(md)).trim();

describe('remarkEmoji (#2091)', () => {
  it('resolves the full gemoji set, not a 60-entry map', () => {
    expect(run(':wave: :axe: :flag_nl:')).toContain('👋');
    expect(run(':axe:')).toBe('🪓');
  });
  it('leaves unknown codes and times like 10:30:00 alone', () => {
    expect(run(':not_an_emoji_xyz:').replace(/\\/g, '')).toBe(':not_an_emoji_xyz:'); // stringify escaping of _ varies by version
    expect(run('at 10:30:00')).toBe('at 10:30:00');
  });
  it('never touches code', () => {
    expect(run('`:wave:`')).toBe('`:wave:`');
  });
  it('kaomoji are stable for the same seed and vary by seed', () => {
    const a = run('hi [KAOMOJI:Joy] and [KAOMOJI:Joy]', 'msg-a');
    expect(run('hi [KAOMOJI:Joy] and [KAOMOJI:Joy]', 'msg-a')).toBe(a);
    const seeds = ['s1', 's2', 's3', 's4', 's5', 's6'].map((s) => pickKaomoji('Joy', s, 0));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
  it('drops unknown kaomoji categories', () => {
    expect(run('x [KAOMOJI:Nope] y')).toBe('x  y');
  });
  it('does not resolve Object.prototype keys', () => {
    const out = run(':constructor: :toString:');
    expect(out).not.toContain('function');
    expect(out.replace(/\\/g, '')).toBe(':constructor: :toString:');
  });
  it('leaves Discord token fallback text alone', () => {
    const proc = unified().use(remarkParse).use(remarkDiscordTokens).use(remarkEmoji, { seed: 's' });
    const tree = proc.runSync(proc.parse('<:wave:123456789012345678>')) as any;
    const tok = tree.children[0].children[0];
    expect(tok.type).toBe('discordToken');
    expect(tok.children[0].value).toBe(':wave:');
  });
  it('pins determinism', () => {
    expect(hashSeed('a')).toBe(3826002220);
    expect(pickKaomoji('Joy', 's', 0)).toBe(pickKaomoji('Joy', 's', 0));
    expect(pickKaomoji('Joy', 's', 1)).toBe(pickKaomoji('Joy', 's', 1));
  });
});
