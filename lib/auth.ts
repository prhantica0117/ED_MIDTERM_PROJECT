import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

let listeners: Array<(session: Session | null) => void> = [];
let globalSession: Session | null = null;
let globalLoading = true;

// Helper to notify all subscription hooks when session changes
export function setAuth(session: Session | null) {
  globalSession = session;
  globalLoading = false;
  listeners.forEach((listener) => listener(session));
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(globalSession);
  const [loading, setLoading] = useState(globalLoading);

  useEffect(() => {
    // Register listener for auth state changes
    const listener = (newSession: Session | null) => {
      setSession(newSession);
      setLoading(false);
    };

    listeners.push(listener);

    // Initial session fetch
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ?? null);
    });

    // Listen for Supabase auth state events (SIGNED_OUT, SIGNED_IN)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session);
    });

    return () => {
      listeners = listeners.filter((l) => l !== listener);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
  };
}

/**
 * Sign in existing user with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (data?.session) {
    setAuth(data.session);
  }

  return { data, error };
}

/**
 * Register new user and set custom metadata (name, role, personnel ID and
 * education data). A database trigger copies this metadata into `profiles`
 * on sign-up.
 * NOTE: registration only offers student/teacher — administrator accounts
 * are promoted by an existing admin (or seeded via SQL / admin_create_user).
 */
export type SignUpMetadata = {
  full_name?: string;
  role?: 'student' | 'teacher';
  student_no?: string;
  education?: string;
  department?: string;
  year_level?: string;
  block?: string;
  strand?: string;
  grade_level?: string;
  section?: string;
  is_advisory?: boolean;
};

export async function signUp(email: string, password: string, metadata?: SignUpMetadata) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (data?.session) {
    setAuth(data.session);
  }

  return { data, error };
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    // 1. Tell Supabase to invalidate session
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out of Supabase:', error);
  } finally {
    // 2. FORCE local auth state to null so listeners immediately see session = null
    setAuth(null);
  }
}