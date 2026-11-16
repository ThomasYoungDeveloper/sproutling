import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string | null;
}

type Result = { error?: string };

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  username: string | null;
  /** True after opening a reset-password link; the app should ask for a new password. */
  recovering: boolean;
  lastEmail: string;
  signUp: (p: { email: string; password: string; username: string }) => Promise<Result & { needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<Result>;
  sendReset: (email: string) => Promise<Result>;
  setNewPassword: (password: string) => Promise<Result>;
  saveUsername: (name: string) => Promise<Result>;
  checkUsername: (name: string) => Promise<boolean | null>;
}

const Ctx = createContext<AuthCtx | null>(null);
const LAST_EMAIL = 'sproutling/last-email';
const site = () => (typeof window !== 'undefined' && window.location ? window.location.origin : undefined);

export function friendlyAuthError(msg: string): string {
  if (/invalid login/i.test(msg)) return 'That email and password don’t match. Try again or reset your password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox (and spam) for a link from Sproutling.';
  if (/already registered|already been registered/i.test(msg)) return 'That email already has an account. Try signing in instead.';
  if (/not authorized|email_address_not_authorized/i.test(msg)) return 'We can’t send email to that address yet. Sproutling is in a private test, so ask whoever invited you to add your email.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a minute and try again.';
  if (/password/i.test(msg) && /(6|characters|short)/i.test(msg)) return 'Use a password with at least 6 characters.';
  if (/valid email|invalid email/i.test(msg)) return 'That doesn’t look like an email address.';
  if (/network|fetch/i.test(msg)) return 'Can’t reach Sproutling right now. Check your connection.';
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [lastEmail, setLastEmail] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL).then((e) => e && setLastEmail(e)).catch(() => {});
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user?.id]);

  const remember = (email: string) => {
    setLastEmail(email);
    AsyncStorage.setItem(LAST_EMAIL, email).catch(() => {});
  };

  const signUp = useCallback(async ({ email, password, username: name }: { email: string; password: string; username: string }) => {
    const clean = email.trim();
    remember(clean);
    const { data, error } = await supabase.auth.signUp({
      email: clean,
      password,
      options: { emailRedirectTo: site(), data: { username: name.trim() } },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    // Supabase hides "already registered" to prevent account fishing: an empty identities list means it exists.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'That email already has an account. Try signing in instead.' };
    }
    return { needsConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const clean = email.trim();
    remember(clean);
    const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: site() } });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: site() });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

  const setNewPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: friendlyAuthError(error.message) };
    setRecovering(false);
    return {};
  }, []);

  const checkUsername = useCallback(async (name: string) => {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name.trim())) return false;
    const { data, error } = await supabase.rpc('username_available', { name: name.trim() });
    return error ? null : Boolean(data);
  }, []);

  const saveUsername = useCallback(
    async (name: string) => {
      if (!user) return { error: 'Sign in first.' };
      const clean = name.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(clean)) return { error: 'Use 3–20 letters, numbers or underscores.' };
      const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', user.id);
      if (error) return { error: /duplicate|unique/i.test(error.message) ? 'That name is taken. Try another.' : error.message };
      setUsername(clean);
      return {};
    },
    [user],
  );

  return (
    <Ctx.Provider value={{ user, loading, username, recovering, lastEmail, signUp, signIn, signOut, resendConfirmation, sendReset, setNewPassword, saveUsername, checkUsername }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
