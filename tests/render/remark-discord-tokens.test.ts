import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkDiscordTokens, emoteUrl, hidePartialDiscordToken } from '../../src/render/remark/discord-tokens';

function els(md: string) {
  const tree = unified().use(remarkParse).use(remarkDiscordTokens).runSync(unified().use(remarkParse).parse(md));
  const out: Array<{ name: string; props: Record<string, unknown>; text: string }> = [];
  const walk = (n: any) => {
    if (n.data?.hName) out.push({ name: n.data.hName, props: n.data.hProperties ?? {}, text: (n.children ?? []).map((c: any) => c.value).join('') });
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  return out;
}

describe('remarkDiscordTokens (#2091)', () => {
  it('parses emotes, animated emotes, timestamps, mentions, channels, roles, spoilers', () => {
    const r = els('a <:rem_wave:123456789012345678> b <a:dance:223456789012345678> <t:1700000000:R> <@323456789012345678> <#423456789012345678> <@&523456789012345678> ||secret||');
    expect(r.map((e) => e.name)).toEqual(['rem-emote', 'rem-emote', 'rem-time', 'rem-mention', 'rem-channel', 'rem-role', 'rem-spoiler']);
    expect(r[0]).toMatchObject({ props: { emoteId: '123456789012345678', name: 'rem_wave', animated: 'false' }, text: ':rem_wave:' });
    expect(r[1].props.animated).toBe('true');
    expect(r[2].props).toEqual({ ts: '1700000000', fmt: 'R' });
    expect(r[6].text).toBe('secret');
  });
  it('defaults the timestamp format to f and accepts <@!id>', () => {
    const r = els('<t:1700000000> <@!323456789012345678>');
    expect(r[0].props.fmt).toBe('f');
    expect(r[1].props.userId).toBe('323456789012345678');
  });
  it('never touches code', () => {
    expect(els('`<:rem_wave:123456789012345678>`\n\n```\n<:x:123456789012345678>\n```')).toEqual([]);
  });
  it('never rewrites link text', () => {
    expect(els('[<:rem_wave:123456789012345678>](https://example.com)')).toEqual([]);
  });
  it('leaves near-misses as text', () => {
    expect(els('<:a:1> <t:abc> <@x> I <3 you || not closed')).toEqual([]);
  });
  it('emoteUrl', () => {
    expect(emoteUrl('1', true)).toBe('https://cdn.discordapp.com/emojis/1.gif?size=48');
    expect(emoteUrl('1', false, 20)).toBe('https://cdn.discordapp.com/emojis/1.webp?size=20');
  });
  it('hides only a half-typed token at the end', () => {
    expect(hidePartialDiscordToken('hi <:rem_wa')).toBe('hi ');
    expect(hidePartialDiscordToken('hi <:rem_wave:12')).toBe('hi ');
    expect(hidePartialDiscordToken('at <t:17000')).toBe('at ');
    expect(hidePartialDiscordToken('yo <@')).toBe('yo ');
    expect(hidePartialDiscordToken('I <3')).toBe('I <3');
    expect(hidePartialDiscordToken('a < b')).toBe('a < b');
    expect(hidePartialDiscordToken('<:x:123456789012345678> ok')).toBe('<:x:123456789012345678> ok');
  });
});
