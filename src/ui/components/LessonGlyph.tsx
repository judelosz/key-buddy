import type { ExerciseType } from '@/core/curriculum/types';

interface LessonGlyphProps {
  type: ExerciseType;
  boss?: boolean;
  stretch?: boolean;
  size?: number;
}

export type LessonGlyphKind =
  | 'challenge'
  | 'listen'
  | 'keyboard'
  | 'rhythm'
  | 'theory'
  | 'interval-ear'
  | 'chord-ear'
  | 'chord'
  | 'feel'
  | 'phrase'
  | 'song'
  | 'compare';

/**
 * One explicit visual verb per activity family. Keep this exhaustive enough
 * that new mini-games never silently fall back to an unrelated song symbol.
 */
export function lessonGlyphKind(type: ExerciseType): LessonGlyphKind {
  switch (type) {
    case 'listen':
      return 'listen';
    case 'note-id':
    case 'scale-key-id':
      return 'keyboard';
    case 'rhythm-tap':
    case 'count-beats':
      return 'rhythm';
    case 'theory-quiz':
    case 'interval-spelling':
      return 'theory';
    case 'interval-ear':
    case 'melodic-dictation':
    case 'name-that-lick':
      return 'interval-ear';
    case 'chord-ear':
    case 'progression-ear':
      return 'chord-ear';
    case 'build-chord':
      return 'chord';
    case 'feel-id':
      return 'feel';
    case 'fragment':
      return 'phrase';
    case 'play-chart':
      return 'song';
    case 'what-changed':
      return 'compare';
  }
}

/** Custom game-entity symbols; functional navigation continues to use Lucide. */
export function LessonGlyph({ type, boss = false, stretch = false, size = 20 }: LessonGlyphProps) {
  const kind: LessonGlyphKind = boss || stretch ? 'challenge' : lessonGlyphKind(type);
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
    'data-glyph': kind,
    className: 'block shrink-0',
  } as const;

  if (kind === 'challenge') {
    return (
      <svg {...svgProps}>
        <path d="M6 21V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M7 4.5c3.5-2 6.3 1.8 10-.8v8.5c-3.7 2.6-6.5-1.2-10 .8V4.5Z"
          fill="currentColor"
          opacity={stretch ? 1 : 0.82}
        />
        {stretch && (
          <path
            d="m18.3 13.8.65 1.35 1.5.22-1.08 1.05.25 1.48-1.32-.7-1.33.7.26-1.48-1.08-1.05 1.49-.22.66-1.35Z"
            fill="currentColor"
          />
        )}
      </svg>
    );
  }

  if (kind === 'listen') {
    return (
      <svg {...svgProps}>
        <path d="M5 11a7 7 0 0 1 14 0v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="3.5" y="12" width="5" height="7.5" rx="2.5" fill="currentColor" />
        <rect x="15.5" y="12" width="5" height="7.5" rx="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (kind === 'keyboard') {
    return (
      <svg {...svgProps}>
        <rect x="2.5" y="5" width="19" height="14" rx="2.3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.25 5v14M12 5v14M16.75 5v14" stroke="currentColor" strokeWidth="1.3" opacity=".6" />
        <path d="M5.8 5h3v6h-3zM10.5 5h3v6h-3zM15.25 5h3v6h-3z" fill="currentColor" />
        <circle cx="14.4" cy="15.2" r="1.65" fill="currentColor" />
      </svg>
    );
  }

  if (kind === 'rhythm') {
    return (
      <svg {...svgProps}>
        <path d="M8.5 3.5h7L18.3 21H5.7L8.5 3.5Z" fill="currentColor" opacity=".16" />
        <path d="M8.5 3.5h7L18.3 21H5.7L8.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m12 14 3.1-6.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="14" r="2" fill="currentColor" />
        <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'theory') {
    return (
      <svg {...svgProps}>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z" fill="currentColor" opacity=".68" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" fill="currentColor" />
        <path d="M8 7h2M14 7h2.5M14 11h2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
      </svg>
    );
  }

  if (kind === 'interval-ear' || kind === 'chord-ear') {
    return (
      <svg {...svgProps}>
        <path
          d="M13.8 15.2c0 3.8-2 5.8-4.7 5.8-1.9 0-3.2-1.15-3.2-2.8 0-2.1 1.8-2.45 1.8-5.1a4.7 4.7 0 1 1 9.4 0"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path d="M9.8 13a2.2 2.2 0 1 1 4 1.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {kind === 'interval-ear' ? (
          <>
            <circle cx="18.2" cy="5" r="1.4" fill="currentColor" />
            <circle cx="21" cy="8.2" r="1.4" fill="currentColor" opacity=".68" />
          </>
        ) : (
          <>
            <circle cx="19.2" cy="4" r="1.25" fill="currentColor" />
            <circle cx="21" cy="7.2" r="1.25" fill="currentColor" opacity=".78" />
            <circle cx="19.2" cy="10.4" r="1.25" fill="currentColor" opacity=".58" />
          </>
        )}
      </svg>
    );
  }

  if (kind === 'chord') {
    return (
      <svg {...svgProps}>
        <rect x="2.5" y="5" width="19" height="14" rx="2.3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.25 5v14M12 5v14M16.75 5v14" stroke="currentColor" strokeWidth="1.3" opacity=".48" />
        <circle cx="4.9" cy="15.1" r="1.45" fill="currentColor" />
        <circle cx="9.6" cy="15.1" r="1.45" fill="currentColor" />
        <circle cx="19.1" cy="15.1" r="1.45" fill="currentColor" />
      </svg>
    );
  }

  if (kind === 'feel') {
    return (
      <svg {...svgProps}>
        <path d="M3.5 9c3.8-4.2 10.6-4.2 15.5-.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m17.2 5.8 2.2 3-3.6.3" fill="currentColor" />
        <rect x="3" y="13" width="10" height="4.5" rx="2.25" fill="currentColor" />
        <circle cx="19" cy="15.25" r="2.35" fill="currentColor" opacity=".72" />
      </svg>
    );
  }

  if (kind === 'phrase') {
    return (
      <svg {...svgProps}>
        <path d="M3.5 8c4.4-4.4 12.5-4.4 17 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="5.5" cy="16.5" rx="3" ry="2.2" transform="rotate(-18 5.5 16.5)" fill="currentColor" />
        <ellipse cx="12" cy="13" rx="3" ry="2.2" transform="rotate(-18 12 13)" fill="currentColor" opacity=".82" />
        <ellipse cx="18.5" cy="16.5" rx="3" ry="2.2" transform="rotate(-18 18.5 16.5)" fill="currentColor" opacity=".64" />
      </svg>
    );
  }

  if (kind === 'compare') {
    return (
      <svg {...svgProps}>
        <rect x="3" y="5" width="6" height="6" rx="2" fill="currentColor" opacity=".72" />
        <rect x="15" y="13" width="6" height="6" rx="2" fill="currentColor" />
        <path d="M10.5 8h6l-2-2M13.5 16h-6l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <path d="M6 5v11.2a3.2 3.2 0 1 1-2.2-3V7l14-2v8.2a3.2 3.2 0 1 1-2.2-3V3.2L6 5Z" fill="currentColor" />
      <path d="M7.5 4.8h8.2" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}
