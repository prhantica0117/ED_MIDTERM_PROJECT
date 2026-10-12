import { useCallback, useEffect, useState } from 'react';

import { getProfile, type Profile, type Role } from './profiles';

export type { Role };

/** Roles that may manage events and view attendance for their own events. */
export function isStaff(role?: Role | null): boolean {
  return role === 'teacher' || role === 'admin';
}

/** Only students record attendance through the scanner. */
export function canScan(role?: Role | null): boolean {
  return role === 'student';
}

export function canManageEvents(role?: Role | null): boolean {
  return isStaff(role);
}

export function canViewAllAttendance(role?: Role | null): boolean {
  return role === 'admin';
}

export function canManageUsers(role?: Role | null): boolean {
  return role === 'admin';
}

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Administrator',
};

/**
 * Loads the signed-in user's profile/role once and revalidates silently
 * whenever `reload()` is called (e.g. on screen focus).
 *
 * `loading` only reflects the very first load so screens don't flash a
 * spinner on every focus.
 */
export function useRole(userId?: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoaded(true);
      return;
    }
    try {
      const next = await getProfile(userId);
      setProfile(next);
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    profile,
    role: profile?.role ?? null,
    loading: !loaded,
    reload,
  };
}