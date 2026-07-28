import type { ReactNode } from 'react';

/** One of a skill's two locks (🖐 Hands / 🧠 Head) — lit when open. Shared by
 * the Progress skill grid and the onboarding two-lock explainer. */
export function LockPip({ on, icon, title }: { on: boolean; icon: ReactNode; title: string }) {
  return (
    <span
      title={title}
      className={`flex h-6 w-6 items-center justify-center rounded-full ${
        on ? 'bg-mint-soft text-mint-deep' : 'bg-sand text-ink-soft'
      }`}
    >
      {icon}
    </span>
  );
}
