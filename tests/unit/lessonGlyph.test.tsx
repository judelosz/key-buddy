import { render, screen } from '@testing-library/react';
import { LessonGlyph, lessonGlyphKind } from '@/ui/components/LessonGlyph';

describe('LessonGlyph', () => {
  it('maps every currently authored mission activity to a relevant visual verb', () => {
    expect(lessonGlyphKind('listen')).toBe('listen');
    expect(lessonGlyphKind('note-id')).toBe('keyboard');
    expect(lessonGlyphKind('rhythm-tap')).toBe('rhythm');
    expect(lessonGlyphKind('theory-quiz')).toBe('theory');
    expect(lessonGlyphKind('interval-ear')).toBe('interval-ear');
    expect(lessonGlyphKind('chord-ear')).toBe('chord-ear');
    expect(lessonGlyphKind('build-chord')).toBe('chord');
    expect(lessonGlyphKind('feel-id')).toBe('feel');
    expect(lessonGlyphKind('fragment')).toBe('phrase');
    expect(lessonGlyphKind('play-chart')).toBe('song');
  });

  it('uses the challenge flag for a boss while preserving a compact SVG footprint', () => {
    const { container } = render(<LessonGlyph type="play-chart" boss size={20} />);
    const glyph = container.querySelector('svg[data-glyph="challenge"]');
    expect(glyph).toBeInTheDocument();
    expect(glyph).toHaveAttribute('width', '20');
    expect(glyph).toHaveAttribute('height', '20');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
