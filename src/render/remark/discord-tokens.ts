import { visit, SKIP } from 'unist-util-visit';

/**
 * Discord inline tokens → custom elements (#2091). Ported from KeroHub
 * src/lib/discord-markup.tsx. Only the tokens; CommonMark handles the rest.
 * Each element keeps readable text children, so it degrades to text if the
 * sanitizer ever drops it.
 */
const TOKEN =
  /<(a?):([A-Za-z0-9_~]{2,32}):(\d{15,22})>|<t:(-?\d{1,13})(?::([tTdDfFR]))?>|<@!?(\d{15,22})>|<#(\d{15,22})>|<@&(\d{15,22})>|\|\|([^|\n]+?)\|\|/g;

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

function el(hName: string, hProperties: Record<string, string>, text: string): MdNode {
  return { type: 'discordToken', data: { hName, hProperties }, children: [{ type: 'text', value: text }] };
}

export function remarkDiscordTokens() {
  return (tree: MdNode) => {
    visit(tree as never, (node: MdNode, index: number | undefined, parent: MdNode | undefined) => {
      if (node.type === 'link' || node.type === 'linkReference') return SKIP;
      if (node.type !== 'text' || !parent || index === undefined) return;
      const v = node.value ?? '';
      const out: MdNode[] = [];
      let last = 0;
      for (const m of v.matchAll(TOKEN)) {
        if (m.index! > last) out.push({ type: 'text', value: v.slice(last, m.index) });
        if (m[3]) out.push(el('rem-emote', { emoteId: m[3], name: m[2], animated: m[1] === 'a' ? 'true' : 'false' }, `:${m[2]}:`));
        else if (m[4]) out.push(el('rem-time', { ts: m[4], fmt: m[5] ?? 'f' }, m[0]));
        else if (m[6]) out.push(el('rem-mention', { userId: m[6] }, '@user'));
        else if (m[7]) out.push(el('rem-channel', { channelId: m[7] }, '#channel'));
        else if (m[8]) out.push(el('rem-role', { roleId: m[8] }, '@role'));
        else out.push(el('rem-spoiler', {}, m[9]));
        last = m.index! + m[0].length;
      }
      if (!out.length) return;
      if (last < v.length) out.push({ type: 'text', value: v.slice(last) });
      parent.children!.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}

export const DISCORD_ALLOWED_TAGS: Record<string, string[]> = {
  'rem-emote': ['emoteId', 'name', 'animated'],
  'rem-time': ['ts', 'fmt'],
  'rem-mention': ['userId'],
  'rem-channel': ['channelId'],
  'rem-role': ['roleId'],
  'rem-spoiler': [],
};

export function emoteUrl(id: string, animated: boolean, size = 48): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=${size}`;
}

const PARTIAL_AT_END = /<(?:a?:[\w~]*(?::\d*)?|t:-?\d*(?::[a-zA-Z]?)?|@[!&]?\d*|#\d*)$/;
/** While streaming, a token split across chunks would flash as raw text; hide its head until it completes. */
export function hidePartialDiscordToken(text: string): string {
  return text.replace(PARTIAL_AT_END, '');
}
