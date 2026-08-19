import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthScreen } from '@/ui/auth/AuthScreen';
import { useAuthStore } from '@/auth/authStore';

describe('AuthScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'signed-out',
      user: null,
      profile: null,
      recoveryMode: false,
      notice: undefined,
      error: undefined,
    });
  });

  afterEach(cleanup);

  it('moves between sign-in, account creation, and password recovery', () => {
    render(<AuthScreen />);

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your pianist profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('shows the recovery form after a password-recovery session', () => {
    useAuthStore.setState({ recoveryMode: true });
    render(<AuthScreen />);

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('minlength', '10');
  });
});
