import { visit } from 'unist-util-visit';

type MdNode = { type: string; value?: string };

/**
 * Rem never needs raw HTML (#2091): tag-like prose such as `Promise<void>` or `a <b> c`
 * was parsed as HTML and swallowed or bolded the rest of the line. Every mdast `html`
 * node, block or inline, becomes literal text. Streamdown's sanitize/harden stay as defense.
 */
export function remarkHtmlAsText() {
  return (tree: MdNode) => {
    visit(tree as never, 'html', (node: MdNode) => {
      node.type = 'text';
    });
  };
}
