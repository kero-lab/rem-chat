// #2091 2b-1 live check: "( [tracker](url) )" rendered a chip inside literal brackets.
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkChipParens } from '../../src/render/remark/chip-parens';

type N = { type: string; value?: string; url?: string; children?: N[] };
const run = (md: string) => {
  const p = unified().use(remarkParse);
  p.use(remarkChipParens);
  const tree = p.runSync(p.parse(md)) as N;
  return (tree.children![0].children ?? []).map((n) => (n.type === 'text' ? `T(${n.value})` : `${n.type}`)).join(' ');
};

describe('remarkChipParens', () => {
  it('drops brackets that wrap a lone link', () => {
    expect(run('a sensible price. ([tracker](https://x.example/t))')).toBe('T(a sensible price. ) link');
  });
  it('keeps the punctuation after the closing bracket', () => {
    expect(run('see it ([Wikipedia](https://en.wikipedia.org/wiki/X)). Next')).toBe('T(see it ) link T(. Next)');
  });
  it('leaves brackets that hold more than the link', () => {
    expect(run('note (see [x](https://x.example/)) end')).toBe('T(note (see ) link T() end)');
    expect(run('both ([a](https://a.example/), [b](https://b.example/))')).toBe('T(both () link T(, ) link T())');
  });
  it('leaves an unclosed bracket alone', () => {
    expect(run('odd ([x](https://x.example/) end')).toBe('T(odd () link T( end)');
  });
  it('a link that is the whole paragraph in brackets', () => {
    expect(run('([x](https://x.example/))')).toBe('link');
  });
});
