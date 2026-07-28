import { describe, it, expect } from 'vitest';
import { GRADE_COLORS } from '@/ui/components/FallingNotes';
import tailwindConfig from '../../tailwind.config';

/**
 * The falling-notes canvas can't read Tailwind classes, so its grade colors
 * are hand-mirrored from the `grade.*` tokens. This pins the two against
 * silent drift (design-system rule, CLAUDE.md §4a).
 */
describe('GRADE_COLORS ↔ tailwind grade tokens', () => {
  it('every canvas grade color matches its tailwind token exactly', () => {
    const colors = (
      tailwindConfig.theme?.extend?.colors as Record<string, unknown> | undefined
    )?.grade as Record<string, string> | undefined;
    expect(colors).toBeDefined();
    expect(GRADE_COLORS).toEqual(colors);
  });
});
