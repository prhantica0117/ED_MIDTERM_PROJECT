import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  student_no?: string | null;
  created_at?: string | null;
};

/** Fetch a user's profile row (role lives here — mirrored from auth metadata). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, student_no, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

/**
 * Update own profile fields. Students may only change display fields —
 * role changes go through setUserRole (admin only, enforced by RLS).
 */
export async function updateProfile(
  userId: string,
  updates: { full_name?: string; student_no?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  return { error: error?.message ?? null };
}

/**
 * Admin: list every account (teachers can also read profiles so they can
 * display attendee names — enforced by RLS policies).
 */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, student_no, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Profile[];
}

/** Fast id → profile lookup for rendering attendee lists. */
export async function getProfilesMap(): Promise<Record<string, Profile>> {
  const profiles = await listProfiles();
  const map: Record<string, Profile> = {};
  profiles.forEach((p) => {
    map[p.id] = p;
  });
  return map;
}

/**
 * Admin: change another user's role (user management).
 * Blocked by RLS for anyone who is not an admin.
 */
export async function setUserRole(
  userId: string,
  role: Role
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  return { error: error?.message ?? null };
}