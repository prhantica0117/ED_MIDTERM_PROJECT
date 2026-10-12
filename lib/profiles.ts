import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  student_no?: string | null;
  // education / advisory data (registration form)
  education?: string | null;
  department?: string | null;
  year_level?: string | null;
  block?: string | null;
  strand?: string | null;
  grade_level?: string | null;
  section?: string | null;
  is_advisory?: boolean | null;
  created_at?: string | null;
};

const PROFILE_COLUMNS =
  'id, email, full_name, role, student_no, education, department, year_level, block, strand, grade_level, section, is_advisory, created_at';

/** Fetch a user's profile row (role lives here — mirrored from auth metadata). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

/**
 * Update profile fields. Everyone may change their own display fields; the
 * admin Users screen additionally passes `role` (RLS allows role updates
 * only for admins, so non-admin callers still can't escalate).
 */
export async function updateProfile(
  userId: string,
  updates: Partial<{
    full_name: string;
    student_no: string;
    role: Role;
    education: string | null;
    department: string | null;
    year_level: string | null;
    block: string | null;
    strand: string | null;
    grade_level: string | null;
    section: string | null;
    is_advisory: boolean;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  return { error: error?.message ?? null };
}

/**
 * Admin: list every account (teachers can also read profiles so they can
 * display attendee names and per-department summaries — RLS policies).
 */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
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

export type AdminCreateUserInput = {
  email: string;
  password: string;
  full_name: string;
  role: Role;
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

function mapRpcError(message: string): string {
  if (/already exists/i.test(message)) return 'An account with that email already exists.';
  if (/administrators/i.test(message)) return 'You are not authorized to manage users.';
  if (/Invalid role/i.test(message)) return message;
  return message;
}

/**
 * Admin: create a full login (auth user + profile) through the SECURITY
 * DEFINER RPC `admin_create_user` — the anon key alone cannot create logins.
 */
export async function adminCreateUser(
  input: AdminCreateUserInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_create_user', {
    p_email: input.email.trim().toLowerCase(),
    p_password: input.password,
    p_full_name: input.full_name.trim(),
    p_role: input.role,
    p_student_no: input.student_no?.trim() || null,
    p_education: input.education || null,
    p_department: input.department || null,
    p_year_level: input.year_level || null,
    p_block: input.block || null,
    p_strand: input.strand || null,
    p_grade_level: input.grade_level || null,
    p_section: input.section?.trim() || null,
    p_is_advisory: input.is_advisory ?? false,
  });

  return { error: error ? mapRpcError(error.message) : null };
}

/** Admin: delete a login (and its profile/attendance via cascades). */
export async function adminDeleteUser(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  return { error: error ? mapRpcError(error.message) : null };
}