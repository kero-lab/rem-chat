'use client';

import * as React from 'react';
import type { SourceRef } from '../protocol/parts';

const REL = 'noopener noreferrer nofollow';

/** A bare "[n]" web citation (#2091 §11.1): a Rem-blue superscript number. No hover preview here; that lives in the app. */
export function CitationMark({ n, source }: { n: string; source: SourceRef }) {
  return (
    <sup className="mx-px text-[0.68em] leading-none">
      <a
        href={source.url}
        target="_blank"
        rel={REL}
        data-citation={n}
        aria-label={`Source ${n}: ${source.title}`}
        className="relative rounded-sm font-semibold tabular-nums text-rem no-underline before:absolute before:-inset-x-1.5 before:-inset-y-1.5 before:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rem/60"
      >
        {n}
      </a>
    </sup>
  );
}

/** "[phrase][n]" (#2091): the phrase itself is the link, with a small superscript n tying it to the Sources row. */
export function CitationLink({ n, source, children }: { n: string; source: SourceRef; children?: React.ReactNode }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel={REL}
      data-citation={n}
      aria-label={`${React.Children.toArray(children).join('')} (source ${n}: ${source.title})`}
      className="rounded-sm text-rem underline decoration-rem/45 decoration-dotted decoration-1 underline-offset-[3px] [box-decoration-break:clone] hover:decoration-rem hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rem/60"
    >
      {children}
      <sup className="ml-px inline-block text-[0.68em] font-semibold tabular-nums">{n}</sup>
    </a>
  );
}
