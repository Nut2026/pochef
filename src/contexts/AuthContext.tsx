import type { User } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) { console.error('Failed to fetch profile:', error); return null; }
  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (usernameOrEmail: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (username: string, email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateColorScheme: (scheme: 'light' | 'dark') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Applies the color scheme to document and next-themes class */
function applyTheme(scheme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(scheme);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const p = await getProfile(user.id);
    setProfile(p);
    if (p?.color_scheme) applyTheme(p.color_scheme);
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          getProfile(session.user.id).then(p => {
            setProfile(p);
            if (p?.color_scheme) applyTheme(p.color_scheme);
          });
        }
      })
      .catch(err => toast.error(`Session error: ${err.message}`))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(p => {
          setProfile(p);
          if (p?.color_scheme) applyTheme(p.color_scheme);
        });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateColorScheme = async (scheme: 'light' | 'dark') => {
    if (!user) return;
    applyTheme(scheme);
    setProfile(prev => prev ? { ...prev, color_scheme: scheme } : prev);
    await supabase.from('profiles').update({ color_scheme: scheme }).eq('id', user.id);
  };

  // Login: accepts username or email
  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail);
      let email = usernameOrEmail;

      if (!isEmail) {
        // It's a username — look up stored email in profiles
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', usernameOrEmail)
          .maybeSingle();
        if (profileRow?.email) {
          email = profileRow.email;
        } else {
          return { error: new Error('User not found') };
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (username: string, email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, updateColorScheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
