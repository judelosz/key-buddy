import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { AppShell } from '@/ui/shell/AppShell';
import { useAuthStore } from '@/auth/authStore';

const user = {
  id: 'pianist-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'jude@example.com',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2026-08-18T00:00:00.000Z',
} satisfies User;

describe('AppShell account rail', () => {
  const originalSignOut = useAuthStore.getState().signOut;

  afterEach(() => {
    cleanup();
    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      profile: null,
      signOut: originalSignOut,
    });
  });

  it('offers the signed-in pianist a working sign-out action in the left rail', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      status: 'signed-in',
      user,
      profile: { userId: user.id, displayName: 'Jude' },
      signOut,
    });

    render(
      <AppShell screen="missions" onNavigate={vi.fn()}>
        <div>Mission content</div>
      </AppShell>,
    );

    expect(screen.getByTestId('rail-account-control')).toHaveTextContent('Jude');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });
});
