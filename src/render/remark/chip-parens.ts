import { visit } from 'unist-util-visit';

type MdNode = { type: string; value?: string; children?: MdNode[] };

/**
 * "([tracker](url))" → just the chip (#2091). Every link renders as a LinkChip, and a pill sitting inside
 * literal brackets reads as broken. Only brackets that wrap nothing but one link go; "(see [x](u))" stays.
 * Run after remarkIssueRefs so "(#2091)" unwraps too.
 */
export function remarkChipParens() {
  return (tree: MdNode) => {
    visit(tree as never, (node: MdNode) => {
      const kids = node.children;
      if (!kids) return;
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].type !== 'link') continue;
        const before = kids[i - 1];
        const after = kids[i + 1];
        if (before?.type !== 'text' || after?.type !== 'text') continue;
        if (!/\(\s*$/.test(before.value ?? '') || !/^\s*\)/.test(after.value ?? '')) continue;
        before.value = (before.value ?? '').replace(/\(\s*$/, '');
        after.value = (after.value ?? '').replace(/^\s*\)/, '');
      }
      // Drop text nodes the trim emptied, so the chip isn't padded by empty siblings.
      node.children = kids.filter((k) => k.type !== 'text' || k.value !== '');
    });
  };
}
