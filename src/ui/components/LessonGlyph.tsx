import type { ExerciseType } from '@/core/curriculum/types';

interface LessonGlyphProps {
  type: ExerciseType;
  boss?: boolean;
  stretch?: boolean;
  size?: number;
}

/** Filled game-entity symbols; functional navigation continues to use Lucide. */
export function LessonGlyph({ type, boss = false, stretch = false, size = 22 }: LessonGlyphProps) {
  if (boss || stretch) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 21V4.5c3.8-2.4 7.1 2.1 11-1.1v10.1c-3.9 3.2-7.2-1.3-11 1.1"
          fill="currentColor"
          opacity={stretch ? 1 : 0.82}
        />
        {stretch && <path d="m17.5 3 .8 1.7 1.8.3-1.3 1.3.3 1.9-1.6-.9-1.7.9.4-1.9L15.5 5l1.8-.3.2-1.7Z" fill="currentColor" />}
      </svg>
    );
  }

  const kind = glyphKind(type);
  if (kind === 'listen') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 10a7 7 0 0 1 14 0v4h-3v-4a4 4 0 1 0-8 0v4H5v-4Z" fill="currentColor" />
        <rect x="4" y="12" width="5" height="7" rx="2.5" fill="currentColor" />
        <rect x="15" y="12" width="5" height="7" rx="2.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'note') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="3" />
        <path d="m14 14 5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.7" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'rhythm') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {[4, 9.5, 15, 20].map((x, index) => (
          <rect key={x} x={x - 1.7} y={index % 2 === 0 ? 5 : 8} width="3.4" height={index % 2 === 0 ? 14 : 11} rx="1.7" fill="currentColor" />
        ))}
      </svg>
    );
  }
  if (kind === 'theory') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z" fill="currentColor" opacity=".78" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'ear') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15.5 15.5c0 4-2.2 6-5 6-2 0-3.5-1.2-3.5-3 0-2.2 2-2.6 2-5.5a5 5 0 1 1 10 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M11 13a2.5 2.5 0 1 1 4.5 1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'chord') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="13" width="5" height="8" rx="2" fill="currentColor" />
        <rect x="9.5" y="8" width="5" height="13" rx="2" fill="currentColor" opacity=".82" />
        <rect x="16" y="3" width="5" height="18" rx="2" fill="currentColor" opacity=".64" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4v12.2a3.5 3.5 0 1 1-2.5-3.35V6l11-2v9.2a3.5 3.5 0 1 1-2.5-3.35V2.5L9 4Z" fill="currentColor" />
    </svg>
  );
}

function glyphKind(
  type: ExerciseType,
): 'listen' | 'note' | 'rhythm' | 'theory' | 'ear' | 'chord' | 'song' {
  if (type === 'listen') return 'listen';
  if (type === 'note-id') return 'note';
  if (type === 'rhythm-tap') return 'rhythm';
  if (type === 'theory-quiz') return 'theory';
  if (type === 'interval-ear' || type === 'chord-ear') return 'ear';
  if (type === 'build-chord') return 'chord';
  return 'song';
}
