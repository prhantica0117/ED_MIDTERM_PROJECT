import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';
import { ROLE_LABEL } from '@/lib/roles';
import { validateName } from '@/lib/validation';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
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
          setDraftName(p?.full_name ?? '');
          setLoading(false);
        }
      };

      fetchProfile();
      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const handleSaveName = async () => {
    if (!user) return;

    const nameError = validateName(draftName, 'Name');
    if (nameError) {
      Alert.alert('Invalid name', nameError);
      return;
    }

    setSaving(true);
    const { error } = await updateProfile(user.id, { full_name: draftName.trim() });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) => (prev ? { ...prev, full_name: draftName.trim() } : prev));
      setEditing(false);
    }
  };

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

  return (
    <View style={styles.container}>
      <Header title="My Profile" subtitle="Account details and settings" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={34} color={COLORS.textOnPrimary} />
          </View>
          <Text style={styles.heroName}>{profile?.full_name ?? 'Unnamed user'}</Text>
          <Text style={styles.heroEmail}>{user?.email ?? 'N/A'}</Text>
          <StatusPill label={profile ? ROLE_LABEL[profile.role] : '—'} tone={tone} />
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.label}>Full Name</Text>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your full name"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />
              <Pressable style={styles.saveButton} onPress={handleSaveName} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? '…' : 'Save'}</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => setEditing(false)}>
                <Text style={styles.cancelButtonText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.valueRow}>
              <Text style={styles.value}>{profile?.full_name || 'Tap to add your name'}</Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          <View style={styles.divider} />

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'N/A'}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{profile ? ROLE_LABEL[profile.role] : 'N/A'}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.idValue}>{user?.id ?? 'N/A'}</Text>
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
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(11, 48, 152, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroName: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  heroEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
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
  value: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editHint: { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  saveButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 13 },
  cancelButton: {
    backgroundColor: 'rgba(189, 27, 32, 0.20)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(189, 27, 32, 0.55)',
  },
  cancelButtonText: { color: '#FF8F93', fontWeight: '700', fontSize: 13 },
  idValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  actions: { marginTop: 'auto' },
});

