import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  username: string | null;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  saveUsername: (name: string) => Promise<{ error?: string }>;
}

const Ctx = createContext<AuthCtx | null>(null);

function friendly(msg: string): string {
  if (/invalid login/i.test(msg)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(msg)) return 'Check your email and tap the confirmation link first.';
  if (/already registered/i.test(msg)) return 'That email already has an account. Try signing in.';
  if (/password/i.test(msg) && /6/.test(msg)) return 'Use a password with at least 6 characters.';
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
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

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) return { error: friendly(error.message) };
    return { needsConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: friendly(error.message) } : {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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

  return <Ctx.Provider value={{ user, loading, username, signUp, signIn, signOut, saveUsername }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
