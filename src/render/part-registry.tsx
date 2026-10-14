'use client';

import * as React from 'react';
import { ChatMarkdown, type ChatMarkdownProps, type Density } from './chat-markdown';
import { ImagePart } from './image-part';
import { SafeLink, isSafeHref } from './safe-link';
import { UnsupportedPart } from './unsupported-part';
import { stripThinking } from '../protocol/thinking';
import type { FilePart, SourceRef, TextPart } from '../protocol/parts';

export interface PartCtx {
  seed: string;
  streaming: boolean;
  density: Density;
  debug: boolean;
  /** What this text part's [n] markers cite (#2091 R4). */
  sources?: SourceRef[];
  /** The app's ChatMarkdown props (links, citations, plugins, image hosts); text and file parts use them. */
  markdown?: Partial<ChatMarkdownProps>;
}
export interface PartRenderer {
  matches(type: string): boolean;
  validate(p: unknown): boolean;
  Component: React.ComponentType<{ part: never; ctx: PartCtx }>;
}

const isObj = (p: unknown): p is Record<string, unknown> => typeof p === 'object' && p !== null;

const TextRenderer: PartRenderer = {
  matches: (t) => t === 'text',
  validate: (p) => isObj(p) && typeof p.text === 'string',
  Component: (({ part, ctx }: { part: TextPart; ctx: PartCtx }) => (
    <ChatMarkdown {...ctx.markdown} text={stripThinking(part.text)} seed={ctx.seed} streaming={ctx.streaming} density={ctx.density} sources={ctx.sources} />
  )) as PartRenderer['Component'],
};

const FileRenderer: PartRenderer = {
  matches: (t) => t === 'file',
  validate: (p) => isObj(p) && typeof p.url === 'string' && typeof p.mediaType === 'string',
  Component: (({ part, ctx }: { part: FilePart; ctx: PartCtx }) => {
    if (part.mediaType.startsWith('image/')) {
      return <ImagePart src={part.url} alt={part.name} width={part.width} height={part.height} imageOpts={ctx.markdown?.imageOpts} />;
    }
    // Same link policy as markdown links: unsafe URLs never anchor, and the app's renderLink applies.
    const label = part.name ?? part.url;
    if (!isSafeHref(part.url)) return <span>{label}</span>;
    const { renderLink } = ctx.markdown ?? {};
    return renderLink ? <>{renderLink({ href: part.url, children: label })}</> : <SafeLink href={part.url}>{label}</SafeLink>;
  }) as PartRenderer['Component'],
};

/** Tool parts are laid out by MessageParts as chip rows; this entry only declares them valid. */
const ToolRenderer: PartRenderer = {
  matches: (t) => t.startsWith('tool-'),
  validate: (p) => isObj(p) && typeof p.toolCallId === 'string' && typeof p.state === 'string',
  Component: () => null,
};

export { UnsupportedPart };

export const RENDERERS: PartRenderer[] = [TextRenderer, ToolRenderer, FileRenderer];

export class PartBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode; resetKey: number },
  { failed: boolean; key: number }
> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: { resetKey: number }, state: { failed: boolean; key: number }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  componentDidCatch(error: unknown) { console.error('[chat] part renderer failed', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function PartView({ part, ctx, renderers = RENDERERS }: { part: { type: string }; ctx: PartCtx; renderers?: PartRenderer[] }) {
  const r = renderers.find((x) => x.matches(part.type));
  const fallback = <UnsupportedPart part={part} debug={ctx.debug} />;
  if (!r || !r.validate(part)) return fallback;
  const C = r.Component;
  const text = (part as { text?: unknown }).text;
  const resetKey = typeof text === 'string' ? text.length : JSON.stringify(part).length;
  return (
    <PartBoundary fallback={fallback} resetKey={resetKey}>
      <C part={part as never} ctx={ctx} />
    </PartBoundary>
  );
}
