'use client';

import * as React from 'react';
import { emoteUrl } from './remark/discord-tokens';
import { cn } from '../lib/utils';

type P = Record<string, unknown> & { children?: React.ReactNode };
const chip = 'inline-block rounded bg-blue-500/15 px-1 py-0.5 text-[0.9em] font-medium text-blue-400';

export function DiscordEmote({ emoteId, name, animated }: P) {
  const id = String(emoteId ?? '');
  if (!/^\d{15,22}$/.test(id)) return <>{`:${String(name ?? '')}:`}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Discord CDN emote, size fixed by em
    <img
      src={emoteUrl(id, animated === 'true')}
      alt={`:${String(name)}:`}
      title={`:${String(name)}:`}
      className="inline-block align-[-0.3em]"
      style={{ height: '1.375em', width: '1.375em' }}
      loading="lazy"
      draggable={false}
    />
  );
}

function formatTs(epoch: number, fmt: string): string {
  const d = new Date(epoch * 1000);
  switch (fmt) {
    case 't': return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    case 'T': return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case 'd': return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    case 'D': return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'F': return d.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    case 'R': {
      const diff = d.getTime() - Date.now();
      const abs = Math.abs(diff);
      const past = diff < 0;
      if (abs < 60_000) return 'just now';
      const [n, u] = abs < 3_600_000 ? [Math.round(abs / 60_000), 'm'] : abs < 86_400_000 ? [Math.round(abs / 3_600_000), 'h'] : [Math.round(abs / 86_400_000), 'd'];
      return past ? `${n}${u} ago` : `in ${n}${u}`;
    }
    default: return d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

export function DiscordTime({ ts, fmt, children }: P) {
  const epoch = Number(ts);
  if (!Number.isFinite(epoch)) return <>{children}</>;
  const d = new Date(epoch * 1000);
  if (Number.isNaN(d.getTime())) return <>{children}</>;
  return (
    <time
      dateTime={d.toISOString()}
      title={d.toLocaleString()}
      suppressHydrationWarning
      className="inline-block rounded bg-muted/60 px-1 py-0.5 text-[0.9em] font-medium tabular-nums"
    >
      {formatTs(epoch, String(fmt ?? 'f'))}
    </time>
  );
}

export const DiscordMention = ({ children }: P) => <span className={chip}>{children}</span>;
export const DiscordChannel = ({ children }: P) => <span className={chip}>{children}</span>;
export const DiscordRole = ({ children }: P) => <span className={chip}>{children}</span>;

export function DiscordSpoiler({ children }: P) {
  const [shown, setShown] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      aria-label={shown ? undefined : 'Spoiler, click to reveal'}
      className={cn('rounded px-0.5 transition-colors', shown ? 'bg-muted/40' : 'bg-muted-foreground/40 text-transparent')}
    >
      {children}
    </button>
  );
}

export const DISCORD_TOKEN_COMPONENTS = {
  'rem-emote': DiscordEmote,
  'rem-time': DiscordTime,
  'rem-mention': DiscordMention,
  'rem-channel': DiscordChannel,
  'rem-role': DiscordRole,
  'rem-spoiler': DiscordSpoiler,
};
