import { visit, SKIP } from 'unist-util-visit';

// `[phrase][n]` (markdown reference-link syntax, which Rem writes) or a bare `[n]`. The phrase holds no
// brackets or newline, and is never itself a bare number or blank, so `[1][2]` stays two citations.
const CITE = /(?:\[(?!\d{1,2}\]|\s*\])([^\[\]\n]{1,200})\][ \t]?)?\[(\d{1,2})\]/g;
type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

/**
 * "[n]" → a `rem-cite` element, but ONLY when source n exists (#2091 R4). "[phrase][n]" → one
 * element whose text is the phrase (kind=phrase), so no literal brackets are left behind. `ns` lists the call's
 * source numbers, holes included, so [n] for a dropped result stays literal. Text
 * nodes only, so code spans/blocks and link text stay literal; with no sources
 * yet (still streaming) the marker stays text and upgrades when they arrive.
 */
export function remarkCitations(opts: { ns?: readonly number[] } = {}) {
  const ns = new Set(opts.ns ?? []);
  return (tree: MdNode) => {
    if (!ns.size) return;
    visit(tree as never, (node: MdNode, index: number | undefined, parent: MdNode | undefined) => {
      if (node.type === 'link' || node.type === 'linkReference') return SKIP;
      if (node.type !== 'text' || !parent || index === undefined) return;
      const v = node.value ?? '';
      const out: MdNode[] = [];
      let last = 0;
      for (const m of v.matchAll(CITE)) {
        const n = Number(m[2]);
        if (!ns.has(n)) continue; // an uncited `[phrase][n]` stays literal, whole
        const phrase = m[1]?.trim();
        if (m.index! > last) out.push({ type: 'text', value: v.slice(last, m.index) });
        out.push(
          phrase
            ? { type: 'citation', data: { hName: 'rem-cite', hProperties: { n: String(n), kind: 'phrase' } }, children: [{ type: 'text', value: phrase }] }
            : { type: 'citation', data: { hName: 'rem-cite', hProperties: { n: String(n) } }, children: [{ type: 'text', value: `[${n}]` }] },
        );
        last = m.index! + m[0].length;
      }
      if (!out.length) return;
      if (last < v.length) out.push({ type: 'text', value: v.slice(last) });
      parent.children!.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
