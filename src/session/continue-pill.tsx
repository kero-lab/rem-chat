import { CornerUpLeft } from 'lucide-react';

const rtf = new Intl.RelativeTimeFormat('en', { style: 'narrow' });

/** Compact relative time ("3h ago", "2d ago"); under a minute reads "Just now". */
function relativeCompact(at: number, now = Date.now()): string {
  const mins = Math.floor((now - at) / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return rtf.format(-days, 'day');
  if (hours > 0) return rtf.format(-hours, 'hour');
  if (mins > 0) return rtf.format(-mins, 'minute');
  return 'Just now';
}

/** Offered only after an idle reset: picks the previous chat back up. */
export function ContinuePill({ onContinue, lastActivityAt }: { onContinue: () => void; lastActivityAt: number | null }) {
  return (
    <button
      type="button"
      data-slot="continue-pill"
      aria-label="Continue previous chat"
      onClick={onContinue}
      className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-rem/40 bg-rem-faint px-3 py-1 text-xs text-rem hover:border-rem"
    >
      <CornerUpLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="shrink-0">Continue</span>
      {lastActivityAt !== null && <span className="shrink-0 text-muted-foreground">· {relativeCompact(lastActivityAt)}</span>}
    </button>
  );
}
