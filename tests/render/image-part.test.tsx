import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, createEvent, waitFor } from '@testing-library/react';
import { ImagePart } from '../../src/render/image-part';

describe('ImagePart (#2091)', () => {
  it('auto-loads allowlisted hosts', () => {
    const { container } = render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="x" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.discordapp.com/x.png');
  });
  it('never creates an <img> for other hosts until clicked', () => {
    const { container } = render(<ImagePart src="https://evil.example/a.png?q=secret" alt="a" />);
    expect(container.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /load image from evil\.example/i }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://evil.example/a.png?q=secret');
  });
  it.each(['data:image/png;base64,AAAA', '//evil.example/x.png', 'javascript:alert(1)'])('refuses to auto-load %s', (src) => {
    const { container } = render(<ImagePart src={src} alt="a" />);
    expect(container.querySelector('img')).toBeNull();
  });
  it('reserves the aspect ratio when dimensions are known', () => {
    const { container } = render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="x" width={400} height={200} />);
    expect((container.querySelector('img') as HTMLImageElement).style.aspectRatio).toBe('400 / 200');
  });
  it('opens a lightbox', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: cat/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('an empty src shows the alt text only', () => {
    const { container } = render(<ImagePart src="" alt="missing" />);
    expect(container.textContent).toContain('missing');
    expect(container.querySelector('button')).toBeNull();
  });
  it('opening the lightbox inside a link does not follow the link', () => {
    render(<a href="https://x.example/"><ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" /></a>);
    const btn = screen.getByRole('button', { name: /open image: cat/i });
    const ev = createEvent.click(btn);
    fireEvent(btn, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('click-to-load inside a link does not follow the link', () => {
    const { container } = render(<a href="https://x.example/"><ImagePart src="https://evil.example/a.png" alt="a" /></a>);
    const btn = screen.getByRole('button', { name: /load image from evil\.example/i });
    const ev = createEvent.click(btn);
    fireEvent(btn, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(container.querySelector('img')).not.toBeNull();
  });
  it('falls back to alt text when the image fails to load', () => {
    const { container } = render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('cat');
  });
  it('says "Image unavailable" on failure with no alt', () => {
    const { container } = render(<ImagePart src="https://cdn.discordapp.com/x.png" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.textContent).toContain('Image unavailable');
  });
  it('does not render the lightbox image before opening', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('an invalid src with no alt shows the src, never an empty span', () => {
    const { container } = render(<ImagePart src="javascript:alert(1)" />);
    expect(container.textContent).toBe('javascript:alert(1)');
  });
  it('the lightbox stacks above the Cmd+K palette (z-[100]/[101]) and its context menus (z-[110])', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: cat/i }));
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('z-[120]');
    const overlay = document.querySelector('[data-slot="lightbox-overlay"]');
    expect(overlay?.className).toContain('z-[120]');
  });
  it('Esc closes only the lightbox: the palette sees it already handled, focus returns to the image', async () => {
    let paletteSaw: boolean | null = null;
    const onDoc = (e: KeyboardEvent) => { if (e.key === 'Escape') paletteSaw = e.defaultPrevented; };
    document.addEventListener('keydown', onDoc);
    try {
      render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
      const btn = screen.getByRole('button', { name: /open image: cat/i });
      btn.focus();
      fireEvent.click(btn);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(paletteSaw).toBe(true);
      await waitFor(() => expect(document.activeElement).toBe(btn)); // Radix restores focus a tick after unmount
    } finally {
      document.removeEventListener('keydown', onDoc);
    }
  });
  it('a click on the empty area around the lightbox image closes it (#2091 R4)', async () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    const btn = screen.getByRole('button', { name: /open image: cat/i });
    btn.focus();
    fireEvent.click(btn);
    // A real click: the press starts and ends on the backdrop (a drag to/from the image must not close it).
    fireEvent.pointerDown(screen.getByRole('dialog'));
    fireEvent.pointerUp(screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });
  it('a click on the lightbox image itself keeps it open (#2091 R4)', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: cat/i }));
    fireEvent.click(screen.getByRole('dialog').querySelector('img')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('a drag from the image to the backdrop does not close it, nor the reverse (#2091 R4)', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: cat/i }));
    const content = screen.getByRole('dialog');
    const img = content.querySelector('img')!;
    // Down and up on different elements: the browser sends click to their common ancestor, Content.
    fireEvent.pointerDown(img);
    fireEvent.pointerUp(content);
    fireEvent.click(content);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(content);
    fireEvent.pointerUp(img);
    fireEvent.click(content);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('down and up both on the backdrop still closes it (#2091 R4)', () => {
    render(<ImagePart src="https://cdn.discordapp.com/x.png" alt="cat" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: cat/i }));
    const content = screen.getByRole('dialog');
    fireEvent.pointerDown(content);
    fireEvent.pointerUp(content);
    fireEvent.click(content);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('imageOpts.origin allows the app origin', () => {
    const { container } = render(<ImagePart src="https://hub.example/a.png" alt="a" imageOpts={{ origin: 'https://hub.example' }} />);
    expect(container.querySelector('img')).not.toBeNull();
  });
});
