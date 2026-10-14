import { visit, SKIP } from 'unist-util-visit';
import { nameToEmoji } from 'gemoji';
import { KAOMOJI_MAP } from './kaomoji';

/** FNV-1a 32-bit: deterministic, tiny, good enough to pick from a short list. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Same message, same face: random picks flickered on every re-render (#2091). */
export function pickKaomoji(category: string, seed: string, n: number): string | null {
  const items = KAOMOJI_MAP[category];
  if (!items?.length) return null;
  return items[hashSeed(`${seed}:${category}:${n}`) % items.length];
}

const PATTERN = /\[KAOMOJI:(\w+)\]|(?<![\w:]):([a-z0-9_+-]{1,40}):(?![\w:])/gi;

type MdNode = { type: string; value?: string; children?: MdNode[] };

export function remarkEmoji(options: { seed: string }) {
  return (tree: MdNode) => {
    let n = 0;
    visit(tree as never, (node: MdNode) => {
      // Task 5's Discord token elements keep `:name:` as their readable fallback text.
      if (node.type === 'discordToken') return SKIP;
      if (node.type !== 'text') return;
      const v = node.value ?? '';
      if (!v.includes(':') && !v.includes('[KAOMOJI')) return;
      node.value = v.replace(PATTERN, (match, kao: string | undefined, code: string | undefined) => {
        if (kao) return pickKaomoji(kao, options.seed, n++) ?? '';
        const key = code!.toLowerCase();
        return Object.hasOwn(nameToEmoji, key) ? nameToEmoji[key] : match;
      });
      return SKIP;
    });
  };
}
