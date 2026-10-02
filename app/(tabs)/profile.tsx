// app/(tabs)/profile.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

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
        try {
          const p = await getProfile(user.id);
          if (isMounted) {
            setProfile(p);
            setDraftName(p?.full_name ?? '');
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        } finally {
          if (isMounted) setLoading(false);
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
    setSaving(true);
    try {
      const { error } = await updateProfile(user.id, {
        full_name: draftName.trim(),
      });

      if (error) {
        Alert.alert('Error', error);
      } else {
        setProfile((prev) =>
          prev ? { ...prev, full_name: draftName.trim() } : prev
        );
        setEditing(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update name.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      // Force immediate redirect to login screen
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Sign Out Error', err?.message || 'Failed to sign out.');
      setSigningOut(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="My Profile" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          {profile?.role === 'teacher' ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Teacher</Text>
            </View>
          ) : (
            <View style={[styles.roleBadge, styles.roleBadgeStudent]}>
              <Text style={[styles.roleBadgeText, styles.roleBadgeStudentText]}>Student</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
              />
              <Pressable
                onPress={handleSaveName}
                disabled={saving}
                style={styles.saveButton}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.nameRow}>
              <Text style={styles.value}>
                {profile?.full_name || 'Tap to add your name'}
              </Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          <View style={styles.divider} />

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'N/A'}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.idValue}>{user?.id ?? 'N/A'}</Text>
        </View>

        <View style={styles.actionContainer}>
          <AppButton
            theme="danger"
            title="Sign Out"
            icon="log-out-outline"
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  roleBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeStudent: {
    backgroundColor: COLORS.primaryTint,
  },
  roleBadgeText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  roleBadgeStudentText: {
    color: COLORS.primaryDark,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
    ...SHADOW.card,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  idValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editHint: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  actionContainer: {
    marginTop: 'auto',
    marginBottom: 16,
  },
});