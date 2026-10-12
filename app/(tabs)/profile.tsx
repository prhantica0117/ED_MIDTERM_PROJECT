import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { educationLabel, educationLine } from '@/constants/education';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, type Profile } from '@/lib/profiles';
import { ROLE_LABEL } from '@/lib/roles';

/**
 * Profile tab — strictly read-only personal information, laid out exactly as
 * required:
 *   (centered) profile picture icon
 *   Role  |  Education
 *   FULL NAME
 *   Student / Personnel ID
 *   Education line — e.g. "BS Information Technology l 3rd Year l Block D"
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchProfile = async () => {
        if (!user) {
          if (isMounted) setLoading(false);
          return;
        }
        if (isMounted) setLoading(true);
        const p = await getProfile(user.id);
        if (isMounted) {
          setProfile(p);
          setLoading(false);
        }
      };

      fetchProfile();
      return () => {
        isMounted = false;
      };
    }, [user])
  );

  // Event: "Sign Out" pressed → invalidate session → redirect to login
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Sign Out Error', err?.message || 'Failed to sign out.');
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="My Profile" />
        <LoadingState label="Loading profile…" />
      </View>
    );
  }

  const tone =
    profile?.role === 'admin' ? 'admin' : profile?.role === 'teacher' ? 'teacher' : 'student';
  const levelLabel = educationLabel(profile?.education);
  const detailLine = educationLine(profile);

  return (
    <View style={styles.container}>
      <Header title="My Profile" subtitle="Your personal information" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Centered personal information card (read-only) ─────────── */}
        <GlassCard style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={38} color={COLORS.textOnPrimary} />
          </View>

          {/* Role with the Education level beside it */}
          <View style={styles.roleRow}>
            <StatusPill label={profile ? ROLE_LABEL[profile.role] : '—'} tone={tone} />
            {levelLabel ? (
              <View style={styles.eduBadge}>
                <Ionicons name="school-outline" size={13} color={COLORS.accent} />
                <Text style={styles.eduBadgeText}>{levelLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Full name */}
          <Text style={styles.fullName}>{profile?.full_name ?? 'Unnamed user'}</Text>

          {/* Student / Personnel ID */}
          <Text style={styles.studentId}>
            ID: {profile?.student_no || 'Not set'}
          </Text>

          {/* Education details line */}
          {detailLine ? <Text style={styles.eduLine}>{detailLine}</Text> : null}

          {profile?.is_advisory && profile?.role === 'teacher' ? (
            <Text style={styles.advisoryNote}>Advisory Teacher</Text>
          ) : null}
        </GlassCard>

        {/* ── Additional read-only account info ──────────────────────── */}
        <GlassCard style={styles.infoCard}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'N/A'}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile ? ROLE_LABEL[profile.role] : 'N/A'}</Text>

          {profile?.role === 'teacher' && !profile?.is_advisory ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>Advisory</Text>
              <Text style={styles.value}>Not an advisory teacher</Text>
            </>
          ) : null}
        </GlassCard>

        <View style={styles.actions}>
          <AppButton
            theme="danger"
            title={signingOut ? 'Signing Out…' : 'Sign Out'}
            icon="log-out-outline"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xxxl,
  },
  hero: {
    alignItems: 'center',
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(11, 48, 152, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  eduBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(76, 121, 255, 0.40)',
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  eduBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fullName: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  studentId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  eduLine: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },
  advisoryNote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D2A78F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  infoCard: { padding: SPACING.lg, marginBottom: SPACING.xl },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  value: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  actions: { marginTop: 'auto' },
});
