'use client';

import * as React from 'react';
import { Streamdown, defaultRemarkPlugins, type Components } from 'streamdown';
import { code } from '@streamdown/code';
import remarkBreaks from 'remark-breaks';
import { remarkDiscordTokens, DISCORD_ALLOWED_TAGS, hidePartialDiscordToken } from './remark/discord-tokens';
import { remarkEmoji } from './remark/emoji';
import { remarkChipParens } from './remark/chip-parens';
import { remarkCitations } from './remark/citations';
import { remarkHtmlAsText } from './remark/html-as-text';
import { sourceAt } from '../protocol/sources';
import type { SourceRef } from '../protocol/parts';
import { DISCORD_TOKEN_COMPONENTS } from './discord-token-view';
import { CitationMark, CitationLink } from './citation';
import { ImagePart, type ImageAllowOpts } from './image-part';
import { SafeLink, isSafeHref } from './safe-link';
import { cn } from '../lib/utils';

export type Density = 'compact' | 'comfortable';
type RenderLink = (props: { href: string; children: React.ReactNode }) => React.ReactNode;
type RenderCitation = (p: { n: string; kind?: 'phrase'; source: SourceRef; children?: React.ReactNode }) => React.ReactNode;
type PluginList = NonNullable<React.ComponentProps<typeof Streamdown>['remarkPlugins']>;

export interface ChatMarkdownProps {
  text: string;
  /** Picks the kaomoji variants; the same seed always renders the same faces. */
  seed?: string;
  streaming?: boolean;
  density?: Density;
  /** The web_search results this text's [n] markers cite (#2091 R4). */
  sources?: SourceRef[];
  /** App plugins, appended after the built-in ones (e.g. RemHub's issue refs). */
  remarkPlugins?: PluginList;
  /** Render Discord tokens (<:emote:id>, <@id>, <t:ts>, ||spoiler||). Off by default. */
  discordTokens?: boolean;
  /** Custom link renderer. Only ever called with an href that passed `isSafeHref`. */
  renderLink?: RenderLink;
  /** Custom citation renderer. Only called when the source url passed `isSafeHref`. */
  renderCitation?: RenderCitation;
  imageOpts?: ImageAllowOpts;
  className?: string;
}

/** Ride on context: COMPONENTS must keep identity or streamdown re-renders every finished block (#2091). */
const CitationContext = React.createContext<SourceRef[] | undefined>(undefined);
const LinkContext = React.createContext<RenderLink | undefined>(undefined);
const CitationRenderContext = React.createContext<RenderCitation | undefined>(undefined);
const ImageOptsContext = React.createContext<ImageAllowOpts | undefined>(undefined);

function Citation({ n, kind, children }: { n?: string; kind?: string; children?: React.ReactNode }) {
  const sources = React.useContext(CitationContext);
  const renderCitation = React.useContext(CitationRenderContext);
  const found = n ? sourceAt(sources, Number(n)) : undefined;
  // A source url is model/tool-supplied: never anchor or hand an unsafe one to the app.
  const source = found && isSafeHref(found.url) ? found : undefined;
  if (source && renderCitation) return <>{renderCitation({ n: n!, kind: kind === 'phrase' ? 'phrase' : undefined, source, children })}</>;
  if (kind === 'phrase') return source ? <CitationLink n={n!} source={source}>{children}</CitationLink> : <>[{children}][{n}]</>;
  return source ? <CitationMark n={n!} source={source} /> : <>{children}</>;
}

function ChatAnchor({ href, children }: { href?: unknown; children?: React.ReactNode }) {
  const renderLink = React.useContext(LinkContext);
  const h = typeof href === 'string' ? href : undefined;
  if (!h || !isSafeHref(h)) return <span>{children}</span>;
  return renderLink ? <>{renderLink({ href: h, children })}</> : <SafeLink href={h}>{children}</SafeLink>;
}

function ChatImage({ src, alt, width, height }: { src?: unknown; alt?: unknown; width?: unknown; height?: unknown }) {
  const imageOpts = React.useContext(ImageOptsContext);
  return (
    <ImagePart
      src={typeof src === 'string' ? src : undefined}
      alt={typeof alt === 'string' ? alt : undefined}
      width={width ? Number(width) : undefined}
      height={height ? Number(height) : undefined}
      imageOpts={imageOpts}
    />
  );
}

// Module constants: streamdown memoises blocks only while these keep identity (#2091).
const BASE_COMPONENTS = {
  a: ChatAnchor,
  img: ChatImage,
  inlineCode: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary">{children}</code>
  ),
  'rem-cite': Citation,
};
// Custom tags (rem-emote…) hit Components' string index; a cast to Components would spread every intrinsic key.
const COMPONENTS = BASE_COMPONENTS as unknown as Components;
const DISCORD_COMPONENTS = {
  ...BASE_COMPONENTS,
  ...(DISCORD_TOKEN_COMPONENTS as Record<string, React.ComponentType<Record<string, unknown>>>),
} as unknown as Components;
const CITE_TAGS = { 'rem-cite': ['n', 'kind'] };
const DISCORD_TAGS = { ...DISCORD_ALLOWED_TAGS, ...CITE_TAGS };
const PLUGINS = { code };
const CONTROLS = { code: true, table: true, mermaid: false } as const;
const SHIKI_THEME = ['github-light', 'github-dark'] as const;
const DEFAULT_REMARK = Object.values(defaultRemarkPlugins);

/** The one chat renderer (#2091 §4.4): streamdown + our chips and image policy; Discord tokens when asked. */
export function ChatMarkdown({
  text,
  seed = '',
  streaming = false,
  density = 'comfortable',
  sources,
  remarkPlugins: extraPlugins,
  discordTokens = false,
  renderLink,
  renderCitation,
  imageOpts,
  className,
}: ChatMarkdownProps) {
  // A string key: the plugin list (and streamdown's block memo) only changes when the numbers do.
  const citeKey = sources?.map((s) => s.n).join(',') ?? '';
  const remarkPlugins = React.useMemo(
    // remark-breaks: Rem writes Discord-style text, where a single newline is a line break.
    () => [
      ...DEFAULT_REMARK,
      remarkBreaks,
      remarkHtmlAsText,
      ...(discordTokens ? [remarkDiscordTokens] : []),
      // App plugins (issue refs) first: chip-parens must see the links they make, so "(#2091)" unwraps.
      ...(extraPlugins ?? []),
      remarkChipParens,
      [remarkCitations, { ns: citeKey ? citeKey.split(',').map(Number) : [] }] as const,
      [remarkEmoji, { seed }] as const,
    ],
    [seed, citeKey, discordTokens, extraPlugins],
  );
  const imageKey = JSON.stringify(imageOpts ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content so an inline object does not re-render every block
  const stableImageOpts = React.useMemo(() => imageOpts, [imageKey]);
  return (
    <LinkContext.Provider value={renderLink}>
      <CitationRenderContext.Provider value={renderCitation}>
      <ImageOptsContext.Provider value={stableImageOpts}>
        <CitationContext.Provider value={sources}>
          <div className={cn('chat-markdown min-w-0 break-words', density === 'compact' ? 'text-xs leading-snug' : 'text-sm leading-relaxed [&_pre_code]:text-[13px] [&_:not(pre)>code]:text-[13px]', className)}>
            <Streamdown
              mode="streaming"
              isAnimating={streaming}
              parseIncompleteMarkdown
              remarkPlugins={remarkPlugins as never}
              allowedTags={discordTokens ? DISCORD_TAGS : CITE_TAGS}
              components={discordTokens ? DISCORD_COMPONENTS : COMPONENTS}
              plugins={PLUGINS}
              controls={CONTROLS}
              shikiTheme={SHIKI_THEME as never}
              lineNumbers={false}
            >
              {streaming && discordTokens ? hidePartialDiscordToken(text) : text}
            </Streamdown>
          </div>
        </CitationContext.Provider>
      </ImageOptsContext.Provider>
      </CitationRenderContext.Provider>
    </LinkContext.Provider>
  );
}
