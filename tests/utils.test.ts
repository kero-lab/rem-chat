import { cn, formatDurationMs } from '../src/lib/utils';

describe('formatDurationMs', () => {
  it('formats ms, s and min', () => {
    expect(formatDurationMs(450)).toBe('450ms');
    expect(formatDurationMs(1500)).toBe('2s');
    expect(formatDurationMs(45_000)).toBe('45s');
    expect(formatDurationMs(135_000)).toBe('2m 15s');
    expect(formatDurationMs(120_000)).toBe('2m');
  });
});

describe('cn', () => {
  it('merges conflicting tailwind classes', () => {
    expect(cn('p-2', false, 'p-4')).toBe('p-4');
  });
});
