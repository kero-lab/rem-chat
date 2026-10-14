import { describe, it, expect } from 'vitest';
import { blobRadius, drawFrame, fieldAt, litAt, sphereCentres, DEFAULT_STYLE, type PlaceholderStyle } from '../../src/render/image-gen-placeholder';

// #2091 R3: metaball field — spheres must bridge when they approach, not just overlap two dot clusters.
describe('placeholder metaball field', () => {
  const W = 320;
  const H = 480;
  const R = blobRadius(W, H);
  const pair = (gap: number) => [{ x: 160 - gap / 2, y: 240 }, { x: 160 + gap / 2, y: 240 }];

  it('blobs are large: radius 0.22–0.32 of the short side', () => {
    expect(R / Math.min(W, H)).toBeGreaterThanOrEqual(0.22);
    expect(R / Math.min(W, H)).toBeLessThanOrEqual(0.32);
  });
  it('a single sphere lights its centre', () => {
    expect(litAt(160, 240, [{ x: 160, y: 240 }], R)).toBe(1);
  });
  // R4 softening widened the skirt: dark by 1.4R (was 1.13R), so the R3 "dark at 1.3R" moved out.
  it('a single sphere is dark beyond 1.4R', () => {
    expect(litAt(160 + 1.4 * R, 240, [{ x: 160, y: 240 }], R)).toBe(0);
  });
  // The soft skirt tints the gap faintly before a neck forms; "no bridge" means no neck, dark by 3R.
  it('two spheres far apart form no neck: midpoint < 0.1 at 2.6R, dark at 3R', () => {
    expect(litAt(160, 240, pair(2.6 * R), R)).toBeLessThan(0.1);
    expect(litAt(160, 240, pair(3 * R), R)).toBe(0);
  });
  it('soft edges: a lone blob fades from 0.9 to 0.1 lit over at least 0.5R (~4 dot rows on a 320 px tile)', () => {
    const c = [{ x: 0, y: 0 }];
    const lastAbove = (v: number) => { let d = 0; for (let x = 0; x <= 1.6 * R; x += 0.25) if (litAt(x, 0, c, R) >= v) d = x; return d; };
    expect((lastAbove(0.1) - lastAbove(0.9)) / R).toBeGreaterThanOrEqual(0.5);
  });
  it('the same spheres close together light the midpoint — the bridge', () => {
    expect(litAt(160, 240, pair(1.6 * R), R)).toBeGreaterThan(0.9);
  });
  // R4: the softer band lifts a lone edge from 0.12 to ~0.37 at 0.95R, so the neck is shown as a ratio, not "< 0.2".
  // At 1.9R apart (midpoint 0.95R from each) the neck is ~0.98 lit; at exactly 2R it is 0.904, too close to 0.9 to pin.
  it('the bridge forms before the lone blobs would touch (metaball neck, not overlap)', () => {
    const loneEdge = litAt(160 + 0.95 * R, 240, [{ x: 160, y: 240 }], R); // a lone sphere is dim at 0.95R
    expect(loneEdge).toBeLessThan(0.4);
    const neck = litAt(160, 240, pair(1.9 * R), R); // yet a midpoint 0.95R from TWO spheres is lit
    expect(neck).toBeGreaterThan(0.9);
    expect(neck / loneEdge).toBeGreaterThan(2.4);
  });
  it('the field sums: two spheres add', () => {
    const one = fieldAt(160, 240, [{ x: 100, y: 240 }], R);
    const two = fieldAt(160, 240, [{ x: 100, y: 240 }, { x: 220, y: 240 }], R);
    expect(two).toBeCloseTo(one * 2, 6);
  });
  it('the reduced-motion rest pose shows at least one merged pair', () => {
    const c = sphereCentres(W, H, null);
    const merged = c.some((a, i) => c.some((b, j) => j > i && litAt((a.x + b.x) / 2, (a.y + b.y) / 2, c, R) > 0.9 && Math.hypot(a.x - b.x, a.y - b.y) > R));
    expect(merged).toBe(true);
  });
  it('spheres drift and approach: over 12 s some pair fuses (< 1.6R) and some pair is fully apart (> 2.6R)', () => {
    let near = false;
    let far = false;
    for (let t = 0; t < 12; t += 0.1) {
      const c = sphereCentres(W, H, t);
      for (let i = 0; i < c.length; i++)
        for (let j = i + 1; j < c.length; j++) {
          const d = Math.hypot(c[i].x - c[j].x, c[i].y - c[j].y);
          if (d < 1.6 * R) near = true;
          if (d > 2.6 * R) far = true;
        }
    }
    expect(near && far).toBe(true);
  });
  it('the grid is a clear dot matrix: ~8 px pitch, ~1.1 px dots', () => {
    expect(DEFAULT_STYLE.grid.pitch).toBe(8);
    expect(DEFAULT_STYLE.grid.dotR).toBeCloseTo(1.1, 2);
  });
  it('dot radius, alpha and tint all follow the lit amount linearly (no early-saturating rim)', () => {
    const fills: { style: string; r: number }[] = [];
    let style = '';
    let r = 0;
    const ctx = {
      clearRect() {}, beginPath() {}, moveTo() {}, drawImage() {}, putImageData() {},
      arc(_x: number, _y: number, rad: number) { r = rad; },
      fill() { fills.push({ style, r }); },
      set fillStyle(v: string) { style = v; },
    } as unknown as CanvasRenderingContext2D;
    const dot = [100, 100, 100] as const;
    const rem = [0, 200, 250] as const;
    drawFrame(ctx, W, H, null, { dot, rem });
    const { dotR, dotRMax, dotAlpha } = DEFAULT_STYLE.grid;
    expect(fills.length).toBeGreaterThan(5);
    for (const f of fills) {
      const k = (f.r - dotR) / (dotRMax - dotR);
      const [cr, cg, cb, a] = f.style.match(/[\d.]+/g)!.map(Number);
      expect(a).toBeCloseTo(dotAlpha + (1 - dotAlpha) * k, 2);
      for (const [c, i] of [[cr, 0], [cg, 1], [cb, 2]] as const) expect(c).toBeCloseTo(dot[i] + (rem[i] - dot[i]) * k, -0.5);
    }
  });
});

describe('PlaceholderStyle (#2091 R4)', () => {
  const W = 320;
  const H = 480;
  it('one style object drives size, rest pose and motion', () => {
    const custom: PlaceholderStyle = {
      ...DEFAULT_STYLE,
      blob: { ...DEFAULT_STYLE.blob, radius: 0.3 },
      motion: { spheres: [{ fx: 0.5, fy: 0.5, ax: 0, ay: 0, px: 7, py: 7, phase: 0 }], rest: [[0.1, 0.2]] },
    };
    expect(blobRadius(W, H, custom)).toBeCloseTo(96, 6);
    expect(sphereCentres(W, H, null, custom)).toEqual([{ x: 32, y: 96 }]);
    expect(sphereCentres(W, H, 3, custom)).toEqual([{ x: 160, y: 240 }]);
  });
  it('a wider band in the style softens the edge', () => {
    const c = [{ x: 0, y: 0 }];
    const R = blobRadius(W, H);
    const hard: PlaceholderStyle = { ...DEFAULT_STYLE, blob: { ...DEFAULT_STYLE.blob, band: [0.4, 0.6] } };
    expect(litAt(1.1 * R, 0, c, R, hard)).toBe(0);
    expect(litAt(1.1 * R, 0, c, R)).toBeGreaterThan(0);
  });
});
