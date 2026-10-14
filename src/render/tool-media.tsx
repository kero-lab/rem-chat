'use client';

import * as React from 'react';
import { toolNameOf, type ToolPart } from '../protocol/parts';
import { isAllowedChatImage } from './image-allowlist';
import { useReducedMotion } from 'motion/react';
import { ImagePart } from './image-part';
import type { ImageAllowOpts } from './image-part';

/** Tools whose call should hold a placeholder tile while they run. Add names as image tools appear. */
const IMAGE_TOOLS = new Set(['generate_image']);
export function isImageTool(name: string): boolean {
  return IMAGE_TOOLS.has(name);
}

function DefaultNavLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return <a href={href} className={className}>{children}</a>;
}

const DEFAULT_RATIO = 4 / 3;
/** The tile never exceeds 320 px on either side. */
const TILE_MAX = 320;
const FADE_MS = 300;

function dimsRatio(w: unknown, h: unknown): number | null {
  return typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? w / h : null;
}

/** Best guess at the image's shape before it exists: media dims, then the requested size, then 4:3. */
function expectedRatio(part: ToolPart): number {
  const m = part.media?.[0];
  const input = (part.input ?? {}) as { width?: unknown; height?: unknown };
  return dimsRatio(m?.width, m?.height) ?? dimsRatio(input.width, input.height) ?? DEFAULT_RATIO;
}

/**
 * Media a tool call produced, under its chip (#2091 R2). An image tool shows
 * a dot-matrix placeholder while it runs, then crossfades to the image.
 */
export function ToolMedia({
  part,
  imageOpts,
  renderGenerating,
  openHref,
  renderNavLink,
}: {
  part: ToolPart;
  imageOpts?: ImageAllowOpts;
  /** The app's placeholder tile while the image draws. Gets a neutral pulsing box by default. */
  renderGenerating?: (state: { startedAt?: number; still: boolean; label?: React.ReactNode }) => React.ReactNode;
  /** Where "still rendering" points (a gallery). No link when absent. */
  openHref?: string;
  /** Renders the gallery link (e.g. next/link). A plain <a> when absent. */
  renderNavLink?: (p: { href: string; className: string; children: React.ReactNode }) => React.ReactNode;
}) {
  const image = isImageTool(toolNameOf(part));
  const media = part.media?.[0];
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  // Only a call watched while drawing crossfades; a reloaded transcript just fades the image in.
  const [sawRunning] = React.useState(running);
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [placeholderGone, setPlaceholderGone] = React.useState(false);
  const [natural, setNatural] = React.useState<number | null>(null);
  const reduced = useReducedMotion();
  const NavLink = renderNavLink ?? DefaultNavLink;

  React.useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => setPlaceholderGone(true), reduced ? 0 : FADE_MS);
    return () => clearTimeout(id);
  }, [loaded, reduced]);

  if (part.state === 'output-error') return null; // the chip already says it failed
  if (!image && !media) return null;
  if (media && !media.mediaType.startsWith('image/')) return null;
  // Off-allowlist media keeps ImagePart's click-to-load guard, outside the tile.
  if (media && !isAllowedChatImage(media.url, imageOpts)) return <ImagePart src={media.url} alt={media.name} imageOpts={imageOpts} />;

  const ratio = Math.min(2, Math.max(0.5, natural ?? expectedRatio(part)));
  const width = Math.round(Math.min(TILE_MAX, TILE_MAX * ratio));
  const label = failed ? (
    'Image unavailable'
  ) : media ? (
    sawRunning ? undefined : null
  ) : running ? undefined : (
    <span>
      {openHref ? (
        <>
          Still rendering — it&apos;ll be in the{' '}
          <NavLink href={openHref} className="text-rem underline-offset-2 hover:underline">gallery</NavLink>
        </>
      ) : (
        'Still rendering'
      )}
    </span>
  );

  return (
    <div
      data-slot="tool-media"
      style={{ aspectRatio: String(ratio), width: `min(100%, ${width}px)` }}
      className="relative mb-1 mt-2 overflow-hidden rounded-lg border border-border bg-rem-faint motion-safe:transition-[width,aspect-ratio] motion-safe:duration-300 motion-safe:ease-out"
    >
      {!placeholderGone && (
        <div
          className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}
        >
          {renderGenerating ? (
            renderGenerating({ startedAt: part.startedAt, still: failed || (!running && !(media && sawRunning)), label })
          ) : (
            <div className="relative h-full w-full">
              <div className="h-full w-full animate-pulse bg-muted" />
              {label && <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted-foreground">{label}</div>}
            </div>
          )}
        </div>
      )}
      {media && !failed && (
        <ImagePart
          fill
          imageOpts={imageOpts}
          src={media.url}
          alt={media.name}
          width={media.width}
          height={media.height}
          onLoad={(img) => {
            setNatural(dimsRatio(img.naturalWidth, img.naturalHeight));
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
