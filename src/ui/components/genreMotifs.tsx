/**
 * Genre iconography (design decision C2, 2026-07-28): soft inline-SVG motifs
 * for the three home genres — blues (piano keys), gospel (church window),
 * country (road to the horizon). Low-contrast furniture for big surfaces,
 * drawn in Parlor Pastel tokens; no external assets.
 */
interface MotifProps {
  size?: number;
  className?: string;
}

/** Blues — a tilted run of piano keys. */
export function PianoMotif({ size = 72, className = '' }: MotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="8" y="20" width="56" height="34" rx="6" fill="#E7E9FB" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={11 + i * 8} y="23" width="7" height="28" rx="2" fill="#FFFFFF" />
      ))}
      {[0, 1, 3, 4].map((i) => (
        <rect key={i} x={16 + i * 8} y="23" width="4.6" height="17" rx="1.5" fill="#7681CE" />
      ))}
    </svg>
  );
}

/** Gospel — an arched church window with warm light. */
export function ChurchWindowMotif({ size = 72, className = '' }: MotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M22 58V30c0-9 6-16 14-16s14 7 14 16v28H22Z" fill="#FCEFD2" />
      <path d="M27 58V31c0-6.5 4-11 9-11s9 4.5 9 11v27" stroke="#C79445" strokeWidth="2.5" />
      <line x1="36" y1="20" x2="36" y2="58" stroke="#C79445" strokeWidth="2" />
      <line x1="23" y1="42" x2="49" y2="42" stroke="#C79445" strokeWidth="2" />
      <rect x="18" y="58" width="36" height="4" rx="2" fill="#E9DFCB" />
    </svg>
  );
}

/** Country — a road running to the horizon under a big sky. */
export function RoadMotif({ size = 72, className = '' }: MotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="52" cy="22" r="8" fill="#F6D08A" />
      <path d="M6 46c14-6 46-6 60 0v2H6v-2Z" fill="#E2F2EA" />
      <path d="M30 62 36 46l6 16H30Z" fill="#D9C9B2" />
      <path d="M36 48v3M36 55v3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
