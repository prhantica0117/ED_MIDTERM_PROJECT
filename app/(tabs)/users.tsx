import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import EducationFields from '@/components/EducationFields';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import { EmptyState, LoadingState } from '@/components/EmptyState';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import StatusPill from '@/components/StatusPill';
import { COLORS } from '@/constants/colors';
import {
  EMPTY_EDUCATION_FORM,
  educationFormFrom,
  educationLine,
  educationLabel,
  validateEducationForm,
  type EducationForm,
} from '@/constants/education';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { getAttendanceHistory } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import {
  adminCreateUser,
  adminDeleteUser,
  listProfiles,
  setUserRole,
  updateProfile,
  type Profile,
  type Role,
} from '@/lib/profiles';
import { ROLE_LABEL, canManageUsers, useRole } from '@/lib/roles';
import { validateEmail, validateName, validatePassword } from '@/lib/validation';

const ROLES: Role[] = ['student', 'teacher', 'admin'];

function roleTone(role: Role): 'student' | 'teacher' | 'admin' {
  return role;
}

/** One modal shared by Create and Edit (fields differ per mode). */
type ModalMode = { mode: 'create' } | { mode: 'edit'; profile: Profile } | null;

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

  // create / edit modal state
  const [modal, setModal] = useState<ModalMode>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formId, setFormId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('student');
  const [formAdvisory, setFormAdvisory] = useState<boolean | null>(null);
  const [formEdu, setFormEdu] = useState<EducationForm>(EMPTY_EDUCATION_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // ── CREATE / EDIT modal helpers ──────────────────────────────────────
  const openCreate = () => {
    setModal({ mode: 'create' });
    setFormName('');
    setFormEmail('');
    setFormId('');
    setFormPassword('');
    setFormRole('student');
    setFormAdvisory(null);
    setFormEdu(EMPTY_EDUCATION_FORM);
    setFormError(null);
  };

  const openEdit = (profile: Profile) => {
    setModal({ mode: 'edit', profile });
    setFormName(profile.full_name ?? '');
    setFormEmail(profile.email ?? '');
    setFormId(profile.student_no ?? '');
    setFormPassword('');
    setFormRole(profile.role);
    setFormAdvisory(profile.role === 'teacher' ? !!profile.is_advisory : null);
    setFormEdu(educationFormFrom(profile));
    setFormError(null);
  };

  const closeModal = () => {
    setModal(null);
    setFormError(null);
  };

  const needsEducation = formRole === 'student' || formAdvisory === true;

  const handleSaveModal = async () => {
    setFormError(null);

    const nameError = validateName(formName, 'Full name');
    if (nameError) return setFormError(nameError);
    if (!formId.trim()) return setFormError('Student/Personnel ID is required.');
    if (formRole === 'teacher' && formAdvisory === null) {
      return setFormError('Indicate whether this teacher is an Advisory Teacher.');
    }
    if (needsEducation) {
      const eduError = validateEducationForm(formEdu);
      if (eduError) return setFormError(eduError);
    }

    setSaving(true);
    try {
      if (modal?.mode === 'create') {
        const emailError = validateEmail(formEmail);
        if (emailError) {
          setFormError(emailError);
          return;
        }
        const passwordError = validatePassword(formPassword);
        if (passwordError) {
          setFormError(passwordError);
          return;
        }

        const { error } = await adminCreateUser({
          email: formEmail,
          password: formPassword,
          full_name: formName,
          role: formRole,
          student_no: formId,
          education: needsEducation ? formEdu.education : '',
          department: needsEducation ? formEdu.department : '',
          year_level: needsEducation ? formEdu.year_level : '',
          block: needsEducation ? formEdu.block : '',
          strand: needsEducation ? formEdu.strand : '',
          grade_level: needsEducation ? formEdu.grade_level : '',
          section: needsEducation ? formEdu.section : '',
          is_advisory: formRole === 'teacher' && formAdvisory === true,
        });

        if (error) {
          setFormError(error);
          return;
        }
        setBanner({ tone: 'success', message: `${formName} was created successfully.` });
      } else if (modal?.mode === 'edit') {
        const { error } = await updateProfile(modal.profile.id, {
          full_name: formName.trim(),
          student_no: formId.trim(),
          role: formRole,
          education: needsEducation ? formEdu.education : null,
          department: needsEducation ? formEdu.department : null,
          year_level: needsEducation ? formEdu.year_level : null,
          block: needsEducation ? formEdu.block : null,
          strand: needsEducation ? formEdu.strand : null,
          grade_level: needsEducation ? formEdu.grade_level : null,
          section: needsEducation ? formEdu.section.trim() : null,
          is_advisory: formRole === 'teacher' && formAdvisory === true,
        });
        if (error) {
          setFormError(error);
          return;
        }
        setBanner({ tone: 'success', message: `${formName} was updated.` });
      }

      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  // Event: admin deletes a user (auth login + profile cascade)
  const handleDelete = (profile: Profile) => {
    if (profile.id === user?.id) {
      setBanner({ tone: 'error', message: 'You cannot delete your own account.' });
      return;
    }
    Alert.alert(
      'Delete user?',
      `${profile.full_name ?? profile.email} and their login will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await adminDeleteUser(profile.id);
            if (error) {
              setBanner({ tone: 'error', message: error });
              Alert.alert('Delete failed', error);
            } else {
              setBanner({
                tone: 'success',
                message: `${profile.full_name ?? profile.email} was deleted.`,
              });
              load();
            }
          },
        },
      ]
    );
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
          <View>
            {banner ? <FeedbackBanner tone={banner.tone} message={banner.message} /> : null}
            <AppButton
              theme="primary"
              title="Create User"
              icon="person-add-outline"
              onPress={openCreate}
            />
            <Text style={styles.hint}>
              Tap a user to change their role, edit their details or delete the account.
              Changes apply immediately (RLS-protected).
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="No users found" message="Try refreshing." />
        }
        renderItem={({ item }) => {
          const isSelf = item.id === user?.id;
          const expanded = expandedId === item.id;
          const detailLine = educationLine(item);
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
                    {item.student_no ? (
                      <Text style={styles.personnelId}>ID: {item.student_no}</Text>
                    ) : null}
                  </View>
                  <StatusPill label={ROLE_LABEL[item.role]} tone={roleTone(item.role)} small />
                </View>

                {detailLine ? (
                  <Text style={styles.eduLine}>
                    {educationLabel(item.education) ? `${educationLabel(item.education)} · ` : ''}
                    {detailLine}
                    {item.is_advisory ? ' · Advisory' : ''}
                  </Text>
                ) : null}

                {item.role === 'student' ? (
                  <Text style={styles.count}>
                    ✔ {attendanceCounts[item.id] ?? 0} recorded attendance
                  </Text>
                ) : null}

                {expanded && !isSelf ? (
                  <>
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

                    <View style={styles.actionsRow}>
                      <Pressable style={styles.actionChip} onPress={() => openEdit(item)}>
                        <Ionicons name="create-outline" size={14} color={COLORS.accent} />
                        <Text style={styles.actionText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionChip, styles.actionChipDanger]}
                        onPress={() => handleDelete(item)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#FF8F93" />
                        <Text style={[styles.actionText, { color: '#FF8F93' }]}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {expanded && isSelf ? (
                  <Text style={styles.selfNote}>
                    Your own account cannot be edited or deleted here — ask another
                    administrator.
                  </Text>
                ) : null}
              </GlassCard>
            </Pressable>
          );
        }}
      />

      {/* ── Create / Edit user modal ────────────────────────────────── */}
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modal?.mode === 'edit' ? 'Edit User' : 'Create User'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <FormField
                label="Full Name"
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Juan Dela Cruz"
                autoCapitalize="words"
                icon="person-outline"
              />
              <FormField
                label="Email"
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="user@school.edu"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={modal?.mode === 'create'}
                icon="mail-outline"
                hint={modal?.mode === 'edit' ? 'Email cannot be changed here.' : undefined}
              />
              <FormField
                label="Student / Personnel ID"
                value={formId}
                onChangeText={setFormId}
                placeholder="e.g. 2026-0001"
                autoCapitalize="characters"
                icon="card-outline"
              />

              {modal?.mode === 'create' ? (
                <FormField
                  label="Password"
                  value={formPassword}
                  onChangeText={setFormPassword}
                  placeholder="Min. 8 chars, letter + number"
                  secureTextEntry
                  icon="lock-closed-outline"
                />
              ) : null}

              <Text style={styles.formLabel}>Role</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.roleChip, formRole === r && styles.roleChipActive]}
                    onPress={() => {
                      setFormRole(r);
                      if (r !== 'teacher') setFormAdvisory(null);
                      if (r !== 'student') setFormEdu(EMPTY_EDUCATION_FORM);
                      setFormError(null);
                    }}
                  >
                    <Text
                      style={[styles.roleChipText, formRole === r && styles.roleChipTextActive]}
                    >
                      {ROLE_LABEL[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {formRole === 'teacher' ? (
                <>
                  <Text style={styles.formLabel}>Advisory Teacher?</Text>
                  <View style={styles.roleRow}>
                    <Pressable
                      style={[styles.roleChip, formAdvisory === true && styles.roleChipActive]}
                      onPress={() => setFormAdvisory(true)}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          formAdvisory === true && styles.roleChipTextActive,
                        ]}
                      >
                        Yes
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.roleChip, formAdvisory === false && styles.roleChipActive]}
                      onPress={() => {
                        setFormAdvisory(false);
                        setFormEdu(EMPTY_EDUCATION_FORM);
                      }}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          formAdvisory === false && styles.roleChipTextActive,
                        ]}
                      >
                        No
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {needsEducation ? (
                <EducationFields
                  form={formEdu}
                  onChange={(patch) => setFormEdu((prev) => ({ ...prev, ...patch }))}
                />
              ) : null}

              {formError ? (
                <FeedbackBanner tone="error" title="Cannot save" message={formError} />
              ) : null}

              <AppButton
                theme="primary"
                title={modal?.mode === 'edit' ? 'Save Changes' : 'Create Account'}
                icon={modal?.mode === 'edit' ? 'save-outline' : 'person-add-outline'}
                onPress={handleSaveModal}
                loading={saving}
              />
              <AppButton theme="ghost" title="Cancel" icon="close-outline" onPress={closeModal} />
            </ScrollView>
          </GlassCard>
        </View>
      </Modal>
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
  personnelId: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  eduLine: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: SPACING.sm,
    fontWeight: '600',
  },
  count: { fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
    marginBottom: SPACING.sm,
  },
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
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionChipDanger: {
    borderColor: 'rgba(189, 27, 32, 0.55)',
    backgroundColor: 'rgba(189, 27, 32, 0.14)',
  },
  actionText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  selfNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 26, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: GUTTER,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalScroll: { flexGrow: 0 },
});

