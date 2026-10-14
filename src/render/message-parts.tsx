'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { toParts } from '../protocol/normalize';
import { citationSourcesFor } from '../protocol/sources';
import { isToolPart, type Part, type ToolCard, type ToolPart } from '../protocol/parts';
import type { ChatMessage } from '../protocol/types';
import { ChatMarkdown, type ChatMarkdownProps, type Density } from './chat-markdown';
import { PartBoundary, PartView, RENDERERS, UnsupportedPart, type PartRenderer } from './part-registry';
import { ToolCallDetails } from './tool-call-details';
import { ToolChip } from './tool-chip';
import { ToolMedia } from './tool-media';

/** Card kind -> the app's component (#2140). A kind with no entry renders nothing; its chip still shows. */
export type CardRegistry = Record<string, (props: { card: ToolCard; part: ToolPart }) => React.ReactNode>;
type ToolMediaProps = React.ComponentProps<typeof ToolMedia>;
export type ToolMediaOptions = Pick<ToolMediaProps, 'imageOpts' | 'renderGenerating' | 'openHref' | 'renderNavLink'>;

type Group = { kind: 'tools'; parts: ToolPart[]; start: number } | { kind: 'part'; part: Part; index: number };

function group(parts: Part[]): Group[] {
  const out: Group[] = [];
  parts.forEach((p, i) => {
    const prev = out[out.length - 1];
    if (isToolPart(p) && prev?.kind === 'tools') prev.parts.push(p);
    else if (isToolPart(p)) out.push({ kind: 'tools', parts: [p], start: i });
    else out.push({ kind: 'part', part: p, index: i });
  });
  return out;
}

function ChipRow({ parts, toolMedia }: { parts: ToolPart[]; toolMedia?: ToolMediaOptions }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  // Keep the last-opened call rendered while the panel animates closed.
  const [shownId, setShownId] = React.useState<string | null>(null);
  const reduced = useReducedMotion();
  const shown = parts.find((p) => p.toolCallId === (openId ?? shownId));
  // Both setters run from the event handler: a state updater must stay pure.
  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) setShownId(next);
  };
  return (
    <div className="my-1.5">
      <div data-chip-row className="flex flex-wrap gap-1.5">
        {parts.map((p) => (
          <ToolChip key={p.toolCallId} part={p} open={p.toolCallId === openId} onToggle={() => toggle(p.toolCallId)} />
        ))}
      </div>
      {parts.map((p) => (
        <ToolMedia key={`m-${p.toolCallId}`} part={p} {...toolMedia} />
      ))}
      <motion.div
        data-slot="tool-details"
        aria-hidden={!openId}
        inert={!openId}
        initial={false}
        animate={{ height: openId ? 'auto' : 0, opacity: openId ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => {
          if (!openId) setShownId(null);
        }}
        className="overflow-hidden"
      >
        {shown && <ToolCallDetails args={shown.input} result={shown.output} error={shown.errorText} />}
      </motion.div>
    </div>
  );
}

/** One message's parts in stream order (#2091 §4.3). Only the last part streams. Cards follow the reply (#2140). */
export function MessageParts({
  message,
  streaming = false,
  density = 'comfortable',
  debug = false,
  markdown,
  cards,
  renderers,
  toolMedia,
}: {
  message: ChatMessage;
  streaming?: boolean;
  density?: Density;
  debug?: boolean;
  /** Passed to every ChatMarkdown (text parts, file links): renderLink, renderCitation, remarkPlugins, imageOpts, discordTokens. */
  markdown?: Partial<ChatMarkdownProps>;
  cards?: CardRegistry;
  /** Replaces the default renderer for an exact part type (`text`, `file`, or a `data-*` type). */
  renderers?: Partial<Record<Part['type'], PartRenderer>>;
  toolMedia?: ToolMediaOptions;
}) {
  const parts = React.useMemo(() => toParts(message), [message]);
  const groups = React.useMemo(() => group(parts), [parts]);
  const registry = React.useMemo(
    () => [
      ...Object.entries(renderers ?? {}).flatMap(([type, r]) => (r ? [{ ...r, matches: (t: string) => t === type }] : [])),
      ...RENDERERS,
    ],
    [renderers],
  );
  // Tool media follows the markdown image policy unless the app says otherwise.
  const media = React.useMemo(
    () => (toolMedia?.imageOpts || !markdown?.imageOpts ? toolMedia : { ...toolMedia, imageOpts: markdown.imageOpts }),
    [toolMedia, markdown?.imageOpts],
  );
  const lastIndex = parts.length - 1;
  const cardViews = parts.flatMap((p) => {
    if (!isToolPart(p) || !p.card) return [];
    const Card = cards?.[p.card.kind];
    return Card ? [{ part: p, card: p.card, Card }] : [];
  });
  return (
    <div className="flex min-w-0 flex-col">
      {groups.map((g) =>
        g.kind === 'tools' ? (
          <ChipRow key={`t${g.start}`} parts={g.parts} toolMedia={media} />
        ) : (
          <PartView
            key={`p${g.index}`}
            part={g.part}
            renderers={registry}
            ctx={{ seed: `${message.id}:${g.index}`, streaming: streaming && g.index === lastIndex, density, debug, sources: citationSourcesFor(parts, g.index), markdown }}
          />
        ),
      )}
      {cardViews.length > 0 && (
        <div data-slot="cards" className="flex min-w-0 flex-col">
          {cardViews.map(({ part, card, Card }) => (
            <PartBoundary
              key={part.toolCallId}
              resetKey={JSON.stringify(card).length}
              fallback={<UnsupportedPart part={{ type: `card-${card.kind}`, fallbackText: card.fallbackText }} debug={debug} />}
            >
              <Card card={card} part={part} />
            </PartBoundary>
          ))}
        </div>
      )}
    </div>
  );
}
