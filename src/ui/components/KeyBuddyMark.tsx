/**
 * Key-Buddy's compact signature: one warm octave with the recognizable 2+3
 * black-key rhythm. It stays legible at favicon/nav size without becoming a
 * generic piano-outline icon.
 */
export function KeyBuddyMark({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-2xl bg-amber-soft shadow-soft"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.68} height={size * 0.58} viewBox="0 0 34 28" fill="none">
        <rect x="1" y="2" width="32" height="24" rx="6" className="fill-surface stroke-amber-deep" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <path
            key={index}
            d={`M${3 + index * 4.1} 4v19`}
            className="stroke-line"
            strokeWidth="1"
          />
        ))}
        {[7.2, 11.3, 19.5, 23.6, 27.7].map((x) => (
          <rect key={x} x={x} y="3" width="3" height="12" rx="1.5" className="fill-ink" />
        ))}
        <path
          d="M7 22c4 2 16 2 20 0"
          className="stroke-amber-deep"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
