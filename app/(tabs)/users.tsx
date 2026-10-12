import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FeedbackBanner from '@/components/FeedbackBanner';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { GUTTER, SPACING } from '@/constants/theme';
import { getAttendanceHistory } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { listProfiles, setUserRole, type Profile, type Role } from '@/lib/profiles';
import { ROLE_LABEL, canManageUsers, useRole } from '@/lib/roles';

const ROLES: Role[] = ['student', 'teacher', 'admin'];

function roleTone(role: Role): 'student' | 'teacher' | 'admin' {
  return role;
}

export default function UsersScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listProfiles();
    setProfiles(rows);

    // attendance count per student (demonstrates relationships)
    const counts: Record<string, number> = {};
    await Promise.all(
      rows
        .filter((p) => p.role === 'student')
        .map(async (p) => {
          const history = await getAttendanceHistory(p.id);
          counts[p.id] = history.length;
        })
    );
    setAttendanceCounts(counts);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Event: admin selects a new role → update DB → pill refreshes
  const handleRoleChange = async (profile: Profile, nextRole: Role) => {
    if (profile.id === user?.id) {
      setBanner({ tone: 'error', message: 'You cannot change your own role.' });
      return;
    }
    if (profile.role === nextRole) return;

    setSavingId(profile.id);
    const { error } = await setUserRole(profile.id, nextRole);
    setSavingId(null);

    if (error) {
      setBanner({ tone: 'error', message: error });
      Alert.alert('Update failed', error);
    } else {
      setBanner({
        tone: 'success',
        message: `${profile.full_name ?? profile.email} is now ${ROLE_LABEL[nextRole]}.`,
      });
      load();
    }
  };

  // ── Authorization guard ───────────────────────────────────────────────
  if (!roleLoading && !canManageUsers(role)) {
    return (
      <View style={styles.container}>
        <Header title="User Management" />
        <View style={styles.centered}>
          <GlassCard style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={48} color={COLORS.crimsonLight} />
            <Text style={styles.lockTitle}>Unauthorized</Text>
            <Text style={styles.lockText}>
              Only administrators can manage user accounts and roles.
            </Text>
          </GlassCard>
        </View>
      </View>
    );
  }

  if (loading && !roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="User Management" />
        <LoadingState label="Loading users…" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="User Management" subtitle={`${profiles.length} accounts`} />

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListHeaderComponent={
          banner ? (
            <FeedbackBanner tone={banner.tone} message={banner.message} />
          ) : (
            <Text style={styles.hint}>
              Tap a user to change their role. Changes apply immediately (RLS-protected).
            </Text>
          )
        }
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="No users found" message="Try refreshing." />
        }
        renderItem={({ item }) => {
          const isSelf = item.id === user?.id;
          const expanded = expandedId === item.id;
          return (
            <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
              <GlassCard style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={20} color={COLORS.textOnPrimary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.name}>
                      {item.full_name ?? 'Unnamed user'}
                      {isSelf ? '  (you)' : ''}
                    </Text>
                    <Text style={styles.email}>{item.email ?? '—'}</Text>
                  </View>
                  <StatusPill label={ROLE_LABEL[item.role]} tone={roleTone(item.role)} small />
                </View>

                {item.role === 'student' ? (
                  <Text style={styles.count}>
                    ✔ {attendanceCounts[item.id] ?? 0} recorded attendance
                  </Text>
                ) : null}

                {expanded && !isSelf ? (
                  <View style={styles.roleRow}>
                    {ROLES.map((r) => (
                      <Pressable
                        key={r}
                        style={[styles.roleChip, item.role === r && styles.roleChipActive]}
                        disabled={savingId === item.id}
                        onPress={() => handleRoleChange(item, r)}
                      >
                        <Text
                          style={[styles.roleChipText, item.role === r && styles.roleChipTextActive]}
                        >
                          {ROLE_LABEL[r]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {expanded && isSelf ? (
                  <Text style={styles.selfNote}>
                    Your own role cannot be changed here — ask another administrator.
                  </Text>
                ) : null}
              </GlassCard>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER },
  lockCard: { alignItems: 'center', padding: SPACING.xxl, gap: SPACING.sm },
  lockTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  lockText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACING.xxxl },
  hint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  card: { marginBottom: SPACING.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11, 48, 152, 0.55)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  email: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  count: { fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
  roleRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.md, flexWrap: 'wrap' },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  roleChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.20)',
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  roleChipTextActive: { color: COLORS.textPrimary },
  selfNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
});
