'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import type { RemMarkState } from '../turns';

const LABEL: Record<RemMarkState, string> = {
  idle: 'Rem',
  thinking: 'Rem is thinking',
  streaming: 'Rem is replying',
  error: 'Rem hit an error',
};

/**
 * Optical centring (#2091 R2). The head circle is geometrically concentric with the ring, but the drawn weight
 * is not: scripts/craft/rem-mark-centroid.mjs measured the area centroid of circle stroke + hair stroke (strokes
 * only, because RemIcon is outline-only) at (+0.0222, +0.0279) of the 1170 viewBox from centre, i.e. low-right.
 * These are HALF that offset (a full move over-corrects); the icon is nudged opposite to where its weight sits.
 */
const OPTICAL_DX = 0.0111;
const OPTICAL_DY = 0.01397;

/** Rem's mark (#2091 D11): her silhouette in a Rem-blue ring. State lives in the ring only — never emotes, never inferred emotion. */
/** `icon` is the app's RemIcon (the package ships no logo asset); it is sized and nudged here. */
export function RemMark({ state, icon, size = 28, className }: { state: RemMarkState; icon: ReactNode; size?: number; className?: string }) {
  return (
    <span
      data-slot="rem-mark"
      data-state={state}
      role="img"
      aria-label={LABEL[state]}
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full bg-rem-faint', className)}
      style={{ width: size, height: size }}
    >
      <span
        data-slot="rem-mark-ring"
        aria-hidden
        className={cn(
          // The ring stays Rem blue on error: blue is her identity, and the error belongs to the alert row (rem-chat#1).
          'absolute inset-0 rounded-full border-2 border-rem',
          state === 'thinking' &&
            'border-rem-soft border-t-rem motion-safe:animate-[rem-ring-sweep_1.6s_linear_infinite]',
        )}
      />
      <span
        aria-hidden
        data-slot="rem-mark-icon"
        className="inline-flex h-[58%] w-[58%] items-center justify-center text-rem [&>svg]:h-full [&>svg]:w-full"
        style={{ transform: `translate(${-OPTICAL_DX * 100}%, ${-OPTICAL_DY * 100}%)` }}
      >
        {icon}
      </span>
    </span>
  );
}
