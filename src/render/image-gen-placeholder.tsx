'use client';

import * as React from 'react';
import { Brush } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

/**
 * While Rem draws (#2091 R3): a crisp dot matrix that a few large Rem-blue
 * metaballs drift through. Where two approach, the summed field crosses the
 * threshold between them first, so they fuse with a smooth neck and pull
 * apart again. Fills its positioned parent; ToolMedia owns the tile.
 */

type RGB = readonly [number, number, number];
export interface DotColours {
  dot: RGB;
  rem: RGB;
}
export interface Sphere {
  /** Rest centre as a fraction of the tile. */
  fx: number;
  fy: number;
  /** Lissajous amplitude as a fraction of the tile. */
  ax: number;
  ay: number;
  /** Periods in seconds (6–11 s). */
  px: number;
  py: number;
  phase: number;
}
/** A smoothstep band over field values: 0 at or below `[0]`, 1 at or above `[1]`. */
export type Band = readonly [low: number, high: number];

/**
 * Every tunable of the placeholder in one place (#2091 R4). The renderer reads only this, so a future
 * variant (a different motion, or one driven by real progress) is a new style object, not a new renderer.
 */
export interface PlaceholderStyle {
  grid: {
    /** Dot spacing in CSS px. */
    pitch: number;
    /** Resting dot radius, and the radius of a fully lit dot. */
    dotR: number;
    dotRMax: number;
    /** Resting dots: muted-foreground at this alpha. */
    dotAlpha: number;
    /** The lit amount is quantised to this many steps so a frame is a handful of batched fills. */
    levels: number;
  };
  blob: {
    /** Radius as a fraction of the tile's short side. */
    radius: number;
    /** Kernel reach in blob radii. */
    reach: number;
    /** Field values the lit amount ramps across: wider = softer edges. */
    band: Band;
  };
  motion: {
    spheres: readonly Sphere[];
    /** Rest pose (reduced motion, still tiles) as tile fractions. */
    rest: readonly (readonly [number, number])[];
  };
  glow: {
    alpha: number;
    /** Its own, wider band, so the halo reaches past the dots. */
    band: Band;
  };
}

/**
 * Soft blobs (Ara, 2026-10-05: "a bit more softening"). The band 0.08–0.9 spreads a lone blob's edge from
 * 0.60R to 1.14R (it was 0.66R–1.01R), and dot radius, alpha and tint all follow the lit amount linearly,
 * so the edge fades over a few dot rows. Two blobs still fuse solid by 2R apart (midpoint lit 0.90) while a
 * lone blob at R is only 0.29 lit, and at 2.6R apart there is no neck (midpoint 0.09).
 */
export const DEFAULT_STYLE: PlaceholderStyle = {
  grid: { pitch: 8, dotR: 1.1, dotRMax: 1.1 * 2.4, dotAlpha: 0.55, levels: 16 },
  blob: { radius: 0.22, reach: 1.6, band: [0.08, 0.9] },
  // Paths share the tile centre so pairs meet every few seconds; each has its own 6–11 s Lissajous.
  motion: {
    spheres: [
      { fx: 0.32, fy: 0.4, ax: 0.2, ay: 0.22, px: 7, py: 9.5, phase: 0 },
      { fx: 0.68, fy: 0.45, ax: 0.2, ay: 0.24, px: 9, py: 6.5, phase: 2.4 },
      { fx: 0.5, fy: 0.68, ax: 0.28, ay: 0.16, px: 11, py: 8, phase: 4.4 },
    ],
    // A fused pair, and a third blob only just reaching for it.
    rest: [
      [0.3, 0.36],
      [0.54, 0.48],
      [0.82, 0.84],
    ],
  },
  glow: { alpha: 0.2, band: [0.02, 0.9] },
};

export const blobRadius = (w: number, h: number, style: PlaceholderStyle = DEFAULT_STYLE) => style.blob.radius * Math.min(w, h);

/** Sphere centres at time `t` seconds; `null` is the rest pose. */
export function sphereCentres(w: number, h: number, t: number | null, style: PlaceholderStyle = DEFAULT_STYLE): { x: number; y: number }[] {
  if (t === null) return style.motion.rest.map(([fx, fy]) => ({ x: fx * w, y: fy * h }));
  const tau = Math.PI * 2;
  return style.motion.spheres.map((s) => ({
    x: w * (s.fx + s.ax * Math.sin((tau * t) / s.px + s.phase)),
    y: h * (s.fy + s.ay * Math.sin((tau * t) / s.py + s.phase * 1.7)),
  }));
}

/**
 * Metaball field: Σ (1 − d²/(reach·R)²)² over every sphere in reach. A compact
 * Wyvill-style kernel rather than R²/d², whose tails add up across the
 * spheres and lift the whole tile off black.
 */
export function fieldAt(x: number, y: number, centres: readonly { x: number; y: number }[], r: number, style: PlaceholderStyle = DEFAULT_STYLE): number {
  const s2 = (style.blob.reach * r) ** 2;
  let f = 0;
  for (const c of centres) {
    const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
    if (d2 >= s2) continue;
    const u = 1 - d2 / s2;
    f += u * u;
  }
  return f;
}

function smoothstep(f: number, [lo, hi]: Band): number {
  const k = Math.min(1, Math.max(0, (f - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
}

/** How lit a point is, 0–1: the threshold band, not a per-sphere falloff, is what bridges two blobs. */
export function litAt(x: number, y: number, centres: readonly { x: number; y: number }[], r: number, style: PlaceholderStyle = DEFAULT_STYLE): number {
  return smoothstep(fieldAt(x, y, centres, r, style), style.blob.band);
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Grid origin: centred in the tile, with dot centres on pixel centres so resting dots stay crisp. */
function gridOf(w: number, h: number, pitch: number) {
  const cols = Math.max(1, Math.floor(w / pitch));
  const rows = Math.max(1, Math.floor(h / pitch));
  const snap = (v: number) => Math.round(v - 0.5) + 0.5;
  return { cols, rows, ox: snap((w - (cols - 1) * pitch) / 2), oy: snap((h - (rows - 1) * pitch) / 2) };
}

/** The glow is the field itself at one texel per dot, upscaled with smoothing: it follows the fused shape. */
let glowCanvas: HTMLCanvasElement | null = null;
let glowData: ImageData | null = null;
function glowLayer(cols: number, rows: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData } | null {
  if (typeof document === 'undefined') return null;
  glowCanvas ??= document.createElement('canvas');
  const g = glowCanvas.getContext('2d');
  if (!g) return null;
  if (glowCanvas.width !== cols || glowCanvas.height !== rows || !glowData) {
    glowCanvas.width = cols;
    glowCanvas.height = rows;
    glowData = g.createImageData(cols, rows);
  }
  return { c: glowCanvas, g, img: glowData };
}

/** One frame in CSS pixels. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number | null,
  colours: DotColours,
  style: PlaceholderStyle = DEFAULT_STYLE,
) {
  ctx.clearRect(0, 0, w, h);
  const { pitch, dotR, dotRMax, dotAlpha, levels } = style.grid;
  const centres = sphereCentres(w, h, t, style);
  const r = blobRadius(w, h, style);
  const { cols, rows, ox, oy } = gridOf(w, h, pitch);
  const { dot, rem } = colours;
  const buckets: number[][] = Array.from({ length: levels + 1 }, () => []);
  const glow = glowLayer(cols, rows);
  const px = glow?.img.data;
  for (let j = 0; j < rows; j++) {
    const y = oy + j * pitch;
    for (let i = 0; i < cols; i++) {
      const x = ox + i * pitch;
      const f = fieldAt(x, y, centres, r, style);
      buckets[Math.round(smoothstep(f, style.blob.band) * levels)].push(x, y);
      if (px) {
        const o = (j * cols + i) * 4;
        px[o] = rem[0];
        px[o + 1] = rem[1];
        px[o + 2] = rem[2];
        px[o + 3] = Math.round(smoothstep(f, style.glow.band) * 255);
      }
    }
  }
  if (glow) {
    glow.g.putImageData(glow.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = style.glow.alpha;
    ctx.drawImage(glow.c, ox - pitch / 2, oy - pitch / 2, cols * pitch, rows * pitch);
    ctx.globalAlpha = 1;
  }
  for (let level = 0; level <= levels; level++) {
    const pts = buckets[level];
    if (!pts.length) continue;
    // Radius, alpha and tint all follow the lit amount linearly: no early saturation, so no hard rim.
    const k = level / levels;
    const rgb = [0, 1, 2].map((i) => Math.round(mix(dot[i], rem[i], k)));
    ctx.fillStyle = `rgba(${rgb.join(',')},${mix(dotAlpha, 1, k).toFixed(3)})`;
    const rad = mix(dotR, dotRMax, k);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      ctx.moveTo(pts[i] + rad, pts[i + 1]);
      ctx.arc(pts[i], pts[i + 1], rad, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/** Resolves any CSS colour (hex, oklch, …) to RGB through a 1×1 canvas. */
function readColours(el: Element): DotColours | null {
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!probe) return null;
  const cs = getComputedStyle(el);
  const rgb = (name: string, fallback: string): RGB => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = fallback;
    probe.fillStyle = cs.getPropertyValue(name).trim() || fallback;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };
  return { dot: rgb('--muted-foreground', 'gray'), rem: rgb('--rem', 'steelblue') };
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `Drawing… 0:14`, counted from the call's start and ticking on whole seconds. */
function ElapsedLabel({ startedAt }: { startedAt?: number }) {
  const [mountedAt] = React.useState(() => Date.now());
  const origin = startedAt ?? mountedAt;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      id = setTimeout(tick, 1000 - (Math.max(0, t - origin) % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, [origin]);
  return (
    <>
      <Brush aria-hidden className="h-3 w-3 shrink-0 text-rem" />
      <span className="tabular-nums">{`Drawing… ${formatElapsed(now - origin)}`}</span>
    </>
  );
}

export function ImageGenPlaceholder({
  startedAt,
  still = false,
  label,
  style = DEFAULT_STYLE,
}: {
  startedAt?: number;
  /** Draw one rest frame and stop (the call ended without an image). */
  still?: boolean;
  /** Replaces the elapsed timer; `null` hides the label. */
  label?: React.ReactNode;
  /**
   * The look and motion; one object so variants swap in without touching the renderer.
   * Must be a stable reference (a module constant or memoised): a new object each render restarts the animation.
   */
  style?: PlaceholderStyle;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const animate = !still && !reduced;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // jsdom, or no 2D context: the label alone still works
    let colours = readColours(canvas);
    let w = 0;
    let h = 0;
    let raf = 0;
    let onScreen = true;
    const t0 = performance.now();
    const paint = (t: number | null) => {
      if (!colours || !w || !h) return;
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      drawFrame(ctx, w, h, t, colours, style);
    };
    const frame = () => {
      paint((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!animate) paint(null);
      else if (!document.hidden && onScreen) frame();
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.width;
      h = box.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      if (!raf) paint(animate ? (performance.now() - t0) / 1000 : null);
    };
    resize();
    sync();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    // Theme flips toggle the `dark` class on <html>: re-read the tokens.
    const mo = new MutationObserver(() => {
      colours = readColours(canvas);
      if (!raf) paint(animate ? (performance.now() - t0) / 1000 : null);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [animate, style]);

  return (
    <div data-slot="image-placeholder" className="absolute inset-0">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {label !== null && (
        <div
          data-slot="image-placeholder-label"
          className="absolute bottom-2 left-2 right-2 flex w-fit max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground backdrop-blur-sm"
        >
          {label ?? <ElapsedLabel startedAt={startedAt} />}
        </div>
      )}
    </div>
  );
}
