import { useState, type FormEvent } from 'react';
import { Cloud, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuthStore } from '@/auth/authStore';
import { KeyBuddyMark } from '@/ui/components/KeyBuddyMark';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export function AuthScreen() {
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  if (recoveryMode) return <RecoveryForm />;
  return <SignInForm />;
}
function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-rose-soft/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-peri-soft/60 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-surface shadow-lift lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden bg-amber-soft/70 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <KeyBuddyMark size={58} />
            <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.2em] text-amber-ink">
              Key-Buddy
            </p>
            <h1 className="mt-3 max-w-sm font-display text-4xl font-semibold leading-tight text-ink">
              Your piano progress, wherever you practice.
            </h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-ink-soft">
              Sign in to keep your missions, mastery, timing history, and practice plan together.
            </p>
          </div>
          <div className="mt-12 grid gap-3 text-sm text-ink-soft">
            <p className="flex items-center gap-2"><Cloud size={17} /> Progress saved to your account</p>
            <p className="flex items-center gap-2"><LockKeyhole size={17} /> Only you can see your practice data</p>
          </div>
        </section>
        <section className="p-6 sm:p-10 lg:p-12">{children}</section>
      </div>
    </main>
  );
}

function SignInForm() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const notice = useAuthStore((s) => s.notice);
  const error = useAuthStore((s) => s.error);
  const clearFeedback = useAuthStore((s) => s.clearFeedback);

  const switchMode = (next: Mode) => {
    clearFeedback();
    setMode(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'sign-up') await signUp(displayName, email, password);
      else if (mode === 'forgot') await sendPasswordReset(email);
      else await signIn(email, password);
    } catch {
      // Store owns learner-facing error copy.
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'sign-up' ? 'Create your pianist profile' : mode === 'forgot' ? 'Reset your password' : 'Welcome back';
  const subtitle = mode === 'sign-up'
    ? 'One account, one pianist, with progress saved privately.'
    : mode === 'forgot'
      ? 'We’ll send a secure reset link to your email.'
      : 'Pick up from the exact mission you left.';

  return (
    <AuthFrame>
      <div className="flex items-center gap-3 lg:hidden">
        <KeyBuddyMark size={48} />
        <span className="font-display text-xl font-semibold text-ink">Key-Buddy</span>
      </div>
      <h2 className="mt-7 font-display text-3xl font-semibold tracking-tight text-ink lg:mt-0">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{subtitle}</p>

      <form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}>
        {mode === 'sign-up' && (
          <Field label="Display name" icon={<UserRound size={17} />}>
            <input
              required
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="auth-input"
              placeholder="Jude"
              maxLength={80}
            />
          </Field>
        )}
        <Field label="Email" icon={<Mail size={17} />}>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-input"
            placeholder="you@example.com"
          />
        </Field>
        {mode !== 'forgot' && (
          <Field label="Password" icon={<LockKeyhole size={17} />}>
            <input
              required
              type="password"
              minLength={10}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input"
              placeholder="10+ characters with letters and numbers"
            />
          </Field>
        )}

        {error && <Feedback tone="error">{error}</Feedback>}
        {notice && <Feedback tone="notice">{notice}</Feedback>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-rose px-5 py-3 font-display text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:shadow-lift active:translate-y-px disabled:opacity-50"
        >
          {busy ? 'One moment…' : mode === 'sign-up' ? 'Create profile' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {mode === 'sign-in' && (
          <>
            <button type="button" onClick={() => switchMode('sign-up')} className="font-semibold text-rose-ink hover:underline">Create an account</button>
            <button type="button" onClick={() => switchMode('forgot')} className="text-ink-soft hover:text-ink hover:underline">Forgot password?</button>
          </>
        )}
        {mode !== 'sign-in' && (
          <button type="button" onClick={() => switchMode('sign-in')} className="font-semibold text-rose-ink hover:underline">Back to sign in</button>
        )}
      </div>
    </AuthFrame>
  );
}

function RecoveryForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const error = useAuthStore((s) => s.error);
  const notice = useAuthStore((s) => s.notice);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updatePassword(password);
    } catch {
      // Store owns learner-facing error copy.
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h2 className="font-display text-3xl font-semibold text-ink">Choose a new password</h2>
      <p className="mt-2 text-sm text-ink-soft">Use at least 10 characters with letters and numbers.</p>
      <form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}>
        <Field label="New password" icon={<LockKeyhole size={17} />}>
          <input required type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" />
        </Field>
        {error && <Feedback tone="error">{error}</Feedback>}
        {notice && <Feedback tone="notice">{notice}</Feedback>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-rose px-5 py-3 font-display text-sm font-semibold text-ink shadow-soft disabled:opacity-50">
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthFrame>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">{icon}{label}</span>
      {children}
    </label>
  );
}

function Feedback({ tone, children }: { tone: 'error' | 'notice'; children: React.ReactNode }) {
  return (
    <p className={`rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-rose-soft text-rose-ink' : 'bg-mint-soft text-mint-ink'}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
