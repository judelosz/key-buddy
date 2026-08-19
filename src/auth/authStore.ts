import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface PianistProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'error';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: PianistProfile | null;
  recoveryMode: boolean;
  notice?: string;
  error?: string;
  init: () => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  clearFeedback: () => void;
}

let initPromise: Promise<void> | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export const useAuthStore = create<AuthState>((set, get) => {
  const loadProfile = async (user: User): Promise<PianistProfile> => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        userId: data.user_id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url ?? undefined,
      };
    }

    const fallback =
      (typeof user.user_metadata.display_name === 'string' && user.user_metadata.display_name.trim()) ||
      user.email?.split('@')[0] ||
      'Pianist';
    const { data: inserted, error: insertError } = await client
      .from('profiles')
      .upsert({ user_id: user.id, display_name: fallback }, { onConflict: 'user_id' })
      .select('user_id, display_name, avatar_url')
      .single();
    if (insertError) throw insertError;
    return {
      userId: inserted.user_id,
      displayName: inserted.display_name,
      avatarUrl: inserted.avatar_url ?? undefined,
    };
  };

  const applySession = async (session: Session | null): Promise<void> => {
    if (!session) {
      set({ status: 'signed-out', user: null, profile: null });
      return;
    }
    try {
      const profile = await loadProfile(session.user);
      set({ status: 'signed-in', user: session.user, profile, error: undefined });
    } catch (error) {
      set({ status: 'error', user: session.user, profile: null, error: errorMessage(error) });
    }
  };

  return {
    status: 'loading',
    user: null,
    profile: null,
    recoveryMode: false,

    init: () => {
      initPromise ??= (async () => {
        if (!isSupabaseConfigured()) {
          set({
            status: 'error',
            error: 'Account services are not configured for this build.',
          });
          return;
        }
        const client = getSupabaseClient();
        client.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') set({ recoveryMode: true });
          queueMicrotask(() => void applySession(session));
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        await applySession(data.session);
      })().catch((error: unknown) => {
        set({ status: 'error', error: errorMessage(error) });
      });
      return initPromise;
    },

    signUp: async (displayName, email, password) => {
      set({ error: undefined, notice: undefined });
      try {
        const { data, error } = await getSupabaseClient().auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          await applySession(data.session);
        } else {
          set({
            status: 'signed-out',
            notice: 'Check your email to confirm your account, then come back to sign in.',
          });
        }
      } catch (error) {
        set({ error: errorMessage(error) });
        throw error;
      }
    },

    signIn: async (email, password) => {
      set({ error: undefined, notice: undefined });
      try {
        const { data, error } = await getSupabaseClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await applySession(data.session);
      } catch (error) {
        set({ error: errorMessage(error) });
        throw error;
      }
    },

    signOut: async () => {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      set({ status: 'signed-out', user: null, profile: null, notice: undefined, error: undefined });
    },

    sendPasswordReset: async (email) => {
      set({ error: undefined, notice: undefined });
      try {
        const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        set({ notice: 'Password reset email sent. You can close this tab after it arrives.' });
      } catch (error) {
        set({ error: errorMessage(error) });
        throw error;
      }
    },

    updatePassword: async (password) => {
      set({ error: undefined, notice: undefined });
      try {
        const { error } = await getSupabaseClient().auth.updateUser({ password });
        if (error) throw error;
        set({ recoveryMode: false, notice: 'Your password has been updated.' });
      } catch (error) {
        set({ error: errorMessage(error) });
        throw error;
      }
    },

    updateDisplayName: async (displayName) => {
      const profile = get().profile;
      if (!profile) return;
      const clean = displayName.trim();
      if (!clean) throw new Error('Display name cannot be empty.');
      const { error } = await getSupabaseClient()
        .from('profiles')
        .update({ display_name: clean })
        .eq('user_id', profile.userId);
      if (error) throw error;
      set({ profile: { ...profile, displayName: clean }, notice: 'Profile updated.', error: undefined });
    },

    clearFeedback: () => set({ notice: undefined, error: undefined }),
  };
});
