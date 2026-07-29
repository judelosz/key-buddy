import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config';

const colors = tailwindConfig.theme.extend.colors;

describe('Parlor Pastel text tokens', () => {
  it.each([
    ['rose', colors.rose.ink, colors.rose.soft],
    ['amber', colors.amber.ink, colors.amber.soft],
    ['mint', colors.mint.ink, colors.mint.soft],
    ['peri', colors.peri.ink, colors.peri.soft],
  ])('%s ink clears WCAG AA on its soft surface and paper', (_name, ink, soft) => {
    expect(contrastRatio(ink, soft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, colors.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
