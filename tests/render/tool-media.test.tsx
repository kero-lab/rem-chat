import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ToolMedia, isImageTool } from '../../src/render/tool-media';
import type { ToolPart } from '../../src/protocol/parts';

describe('ToolMedia (#2091)', () => {
  const running: ToolPart = { type: 'tool-generate_image', toolCallId: 'g', state: 'input-available', startedAt: Date.now() - 14_000 };
  it('shows the dot-matrix placeholder with a Drawing timer by default while running', () => {
    const { container, getByText } = render(<ToolMedia part={running} />);
    expect(container.querySelector('[data-slot="image-placeholder"] canvas')).not.toBeNull();
    expect(getByText(/Drawing… 0:1\d/)).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });
  it('lets the app supply the placeholder', () => {
    const { getByTestId } = render(<ToolMedia part={running} renderGenerating={() => <div data-testid="mine" />} />);
    expect(getByTestId('mine')).toBeTruthy();
  });
  it('renders the image when media arrives', () => {
    const done = { ...running, state: 'output-available', media: [{ type: 'file', url: 'https://cdn.kero-ara.com/u/a.png', mediaType: 'image/png', name: 'Generated image' }] } as ToolPart;
    const { getByAltText } = render(<ToolMedia part={done} />);
    expect(getByAltText('Generated image').getAttribute('src')).toBe('https://cdn.kero-ara.com/u/a.png');
  });
  it('says the image is still rendering when the call finished without media', () => {
    const { getByText } = render(<ToolMedia part={{ ...running, state: 'output-available' }} />);
    expect(getByText(/Still rendering/)).toBeTruthy();
  });
  it('links the gallery only when openHref is given', () => {
    const done = { ...running, state: 'output-available' } as ToolPart;
    expect(render(<ToolMedia part={done} />).container.querySelector('a')).toBeNull();
    expect(render(<ToolMedia part={done} openHref="/studio/image" />).container.querySelector('a')?.getAttribute('href')).toBe('/studio/image');
  });
  it('routes the gallery link through renderNavLink', () => {
    const done = { ...running, state: 'output-available' } as ToolPart;
    const { getByTestId } = render(<ToolMedia part={done} openHref="/studio/image" renderNavLink={({ href, children }) => <i data-testid="nav" data-href={href}>{children}</i>} />);
    expect(getByTestId('nav').getAttribute('data-href')).toBe('/studio/image');
  });
  it('the default placeholder fills its tile', () => {
    const { container } = render(<ToolMedia part={running} />);
    expect(container.querySelector('[data-slot="image-placeholder"]')!.className).toContain('inset-0');
  });
  it('honours imageOpts for auto-loading', () => {
    const done = { ...running, state: 'output-available', media: [{ type: 'file', url: 'https://img.example/a.png', mediaType: 'image/png', name: 'x' }] } as ToolPart;
    expect(render(<ToolMedia part={done} />).container.querySelector('img')).toBeNull();
    expect(render(<ToolMedia part={done} imageOpts={{ extraHosts: ['img.example'] }} />).container.querySelector('img')).not.toBeNull();
  });
  it('renders nothing for non-image tools without media', () => {
    const { container } = render(<ToolMedia part={{ ...running, type: 'tool-web_search' }} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders nothing for a failed image call', () => {
    const { container } = render(<ToolMedia part={{ ...running, state: 'output-error' }} />);
    expect(container.firstChild).toBeNull();
  });
  it('isImageTool is true for generate_image only', () => {
    expect(isImageTool('generate_image')).toBe(true);
    expect(isImageTool('web_search')).toBe(false);
  });
});

describe('failed generate_image part renders no tile (#2091 R3b)', () => {
  it('output-error with outcome error -> nothing', () => {
    const part: ToolPart = { type: 'tool-generate_image', toolCallId: 'g', state: 'output-error', outcome: 'error', errorText: 'boom' };
    const { container } = render(<ToolMedia part={part} />);
    expect(container.firstChild).toBeNull();
  });
});
