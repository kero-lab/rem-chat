'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ImageOff, X } from 'lucide-react';
import { isAllowedChatImage } from './image-allowlist';

export type ImageAllowOpts = { extraHosts?: string[]; extraSuffixes?: string[] };

function hostOf(src: string): string | null {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.host : null;
  } catch {
    return null;
  }
}

/**
 * Chat images (#2091 §4.4, §5.3): allowlisted hosts auto-load; anything else waits for a click.
 * `fill` sizes the image to a positioned parent (ToolMedia's tile) instead of the text flow.
 */
export function ImagePart({
  src,
  alt,
  width,
  height,
  fill = false,
  onLoad,
  onError,
  imageOpts,
}: {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  onLoad?: (img: HTMLImageElement) => void;
  onError?: () => void;
  /** Hosts beyond the package defaults that auto-load. */
  imageOpts?: ImageAllowOpts;
}) {
  const allowed = isAllowedChatImage(src, imageOpts);
  const host = src ? hostOf(src) : null;
  const [optedIn, setOptedIn] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  /** Where the last press on the lightbox started and ended: only backdrop-to-backdrop closes it. */
  const press = React.useRef({ down: false, up: false });
  const label = alt || 'Image';

  if (!src || (!allowed && !host)) return <span className="italic text-muted-foreground">{alt || src || ''}</span>;

  if (failed) return <span className="italic text-muted-foreground">{alt || 'Image unavailable'}</span>;

  if (!allowed && !optedIn) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOptedIn(true);
        }}
        className="my-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/40 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10"
      >
        <ImageOff className="h-3.5 w-3.5" /> Load image from {host}
      </button>
    );
  }

  const ratio = width && height ? `${width} / ${height}` : undefined;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Trigger, so Radix returns focus here on close. Our preventDefault skips its own toggle; setOpen opens. */}
      <Dialog.Trigger asChild>
      <button
        type="button"
        aria-label={`Open image: ${label}`}
        onClick={(e) => {
          // Inside a markdown link the click must open the lightbox, not follow the link.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          fill
            ? 'absolute inset-0 block h-full w-full cursor-zoom-in rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            : // The skeleton lives on the button: the image itself is invisible until it fades in.
              `my-2 block max-w-full cursor-zoom-in rounded-md ${loaded ? '' : 'bg-muted motion-safe:animate-pulse'}`
        }
      >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary chat media */}
          <img
            src={src}
            alt={alt ?? ''}
            loading="lazy"
            onLoad={(e) => {
              setLoaded(true);
              onLoad?.(e.currentTarget);
            }}
            onError={() => {
              setFailed(true);
              onError?.();
            }}
            style={!fill && ratio ? { aspectRatio: ratio, maxWidth: Math.min(width!, 480), width: '100%', height: 'auto' } : undefined}
            className={`${
              fill
                ? 'h-full w-full object-contain'
                : `max-h-80 max-w-full rounded-md border border-border object-contain ${!ratio && !loaded ? 'min-h-24 w-full max-w-xs' : ''}`
            } motion-safe:transition-opacity motion-safe:duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
      </button>
      </Dialog.Trigger>
      {/* z-[120]: above the Cmd+K palette (z-[100]/[101], blurred backdrop) and its context menus (z-[110]).
          Radix preventDefaults Esc in the capture phase, so the palette's document handler leaves the sheet open. */}
      <Dialog.Portal>
        <Dialog.Overlay data-slot="lightbox-overlay" className="fixed inset-0 z-[120] bg-black/80" />
        {/* Content covers the overlay (inset-4), so an "outside" click lands here: its own empty area closes;
            the image and the close button do not. A drag between the image and the backdrop (either way)
            also clicks Content, their common ancestor, so the press must start AND end on the backdrop. */}
        <Dialog.Content
          className="fixed inset-4 z-[120] flex cursor-zoom-out items-center justify-center outline-none"
          onPointerDown={(e) => {
            press.current = { down: e.target === e.currentTarget, up: false };
          }}
          onPointerUp={(e) => {
            press.current.up = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (press.current.down && press.current.up && e.target === e.currentTarget) setOpen(false);
            press.current = { down: false, up: false };
          }}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary chat media */}
          <img src={src} alt={alt ?? ''} className="max-h-full max-w-full cursor-default rounded-md object-contain" />
          <Dialog.Close aria-label="Close" className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
