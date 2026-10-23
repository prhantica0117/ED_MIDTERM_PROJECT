import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import CheckboxField from '@/components/CheckboxField';
import EducationFields from '@/components/EducationFields';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import {
  EMPTY_EDUCATION_FORM,
  validateEducationForm,
  type EducationForm,
} from '@/constants/education';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signUp } from '@/lib/auth';
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from '@/lib/validation';

type Role = 'student' | 'teacher';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [isAdvisory, setIsAdvisory] = useState<boolean | null>(null);
  const [eduForm, setEduForm] = useState<EducationForm>(EMPTY_EDUCATION_FORM);
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const patchEducation = (patch: Partial<EducationForm>) =>
    setEduForm((prev) => ({ ...prev, ...patch }));

  const switchRole = (next: Role) => {
    setRole(next);
    setIsAdvisory(null);
    setEduForm(EMPTY_EDUCATION_FORM);
    setError(null);
  };

  // Education details are always required for students, and for teachers who
  // answer "Yes" to the Advisory Teacher question.
  const needsEducation = role === 'student' || isAdvisory === true;

  // Event: user presses "Create Account" → validate → register
  const handleRegister = async () => {
    setError(null);

    const nameError = validateName(fullName, 'Full name');
    if (nameError) return setError(nameError);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    if (!studentNo.trim()) return setError('Student/Personnel ID is required.');

    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);

    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) return setError(confirmError);

    if (role === 'teacher' && isAdvisory === null) {
      return setError('Please indicate whether you are an Advisory Teacher.');
    }

    if (needsEducation) {
      const eduError = validateEducationForm(eduForm);
      if (eduError) return setError(eduError);
    }

    if (!agreed) {
      return setError('You must agree to the Data Privacy Act before registering.');
    }

    setLoading(true);
    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        role,
        student_no: studentNo.trim(),
        education: needsEducation ? eduForm.education : '',
        department: needsEducation ? eduForm.department : '',
        year_level: needsEducation ? eduForm.year_level : '',
        block: needsEducation ? eduForm.block : '',
        strand: needsEducation ? eduForm.strand : '',
        grade_level: needsEducation ? eduForm.grade_level : '',
        section: needsEducation ? eduForm.section.trim() : '',
        is_advisory: role === 'teacher' && isAdvisory === true,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" subtitle="School Event Management" />
            </View>

            {success ? (
              <GlassCard style={styles.card}>
                <View style={styles.successIcon}>
                  <Ionicons name="mail-open-outline" size={34} color={COLORS.accent} />
                </View>
                <Text style={styles.successTitle}>Check your email!</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Verify your account, then come back and
                  sign in.
                </Text>
                <AppButton
                  theme="primary"
                  title="Back to Sign In"
                  icon="log-in-outline"
                  onPress={() => router.replace('/login')}
                />
              </GlassCard>
            ) : (
              <GlassCard style={styles.card}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Register to start recording attendance</Text>

                <FormField
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Juan Dela Cruz"
                  autoCapitalize="words"
                  editable={!loading}
                  icon="person-outline"
                />
                <FormField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                  icon="mail-outline"
                />
                <FormField
                  label="Student / Personnel ID"
                  value={studentNo}
                  onChangeText={setStudentNo}
                  placeholder="e.g. 2026-0001"
                  autoCapitalize="characters"
                  editable={!loading}
                  icon="card-outline"
                />

                <Text style={styles.label}>I am a…</Text>
                <View style={styles.roleRow}>
                  {(['student', 'teacher'] as const).map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.roleChip, role === option && styles.roleChipActive]}
                      onPress={() => switchRole(option)}
                    >
                      <Ionicons
                        name={option === 'student' ? 'book-outline' : 'school-outline'}
                        size={18}
                        color={role === option ? COLORS.accent : COLORS.textSecondary}
                      />
                      <Text
                        style={[styles.roleChipText, role === option && styles.roleChipTextActive]}
                      >
                        {option === 'student' ? 'Student' : 'Teacher'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {role === 'teacher' ? (
                  <>
                    <Text style={styles.label}>Are you an Advisory Teacher?</Text>
                    <View style={styles.roleRow}>
                      <Pressable
                        style={[styles.roleChip, isAdvisory === true && styles.roleChipActive]}
                        onPress={() => {
                          setIsAdvisory(true);
                          setError(null);
                        }}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color={isAdvisory === true ? COLORS.accent : COLORS.textSecondary}
                        />
                        <Text
                          style={[
                            styles.roleChipText,
                            isAdvisory === true && styles.roleChipTextActive,
                          ]}
                        >
                          Yes
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleChip, isAdvisory === false && styles.roleChipActive]}
                        onPress={() => {
                          setIsAdvisory(false);
                          setEduForm(EMPTY_EDUCATION_FORM);
                          setError(null);
                        }}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={isAdvisory === false ? COLORS.accent : COLORS.textSecondary}
                        />
                        <Text
                          style={[
                            styles.roleChipText,
                            isAdvisory === false && styles.roleChipTextActive,
                          ]}
                        >
                          No
                        </Text>
                      </Pressable>
                    </View>
                    <Text style={styles.roleHint}>
                      Advisory teachers choose the block/section they handle — used when creating
                      class schedules.
                    </Text>
                  </>
                ) : null}

                {needsEducation ? (
                  <EducationFields
                    title={role === 'student' ? 'Education Details' : 'Advisory Class'}
                    form={eduForm}
                    onChange={patchEducation}
                    disabled={loading}
                  />
                ) : null}

                <FormField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 chars, letter + number"
                  secureTextEntry
                  editable={!loading}
                  icon="lock-closed-outline"
                />
                <FormField
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  secureTextEntry
                  editable={!loading}
                  icon="lock-closed-outline"
                />

                <View style={styles.privacyBox}>
                  <CheckboxField
                    label="I agree to the Data Privacy Act of 2012 (RA 10173)"
                    description="I consent to the collection and processing of my personal information — name, ID, education details and attendance records — solely for the school's event/class attendance system."
                    checked={agreed}
                    onToggle={() => {
                      setAgreed((prev) => !prev);
                      setError(null);
                    }}
                    disabled={loading}
                    danger
                  />
                </View>

                <Text style={styles.roleHint}>
                  Administrator accounts are assigned by the school system administrator.
                </Text>

                {error ? (
                  <FeedbackBanner tone="error" title="Registration failed" message={error} />
                ) : null}

                <AppButton
                  theme="primary"
                  title="Create Account"
                  icon="person-add-outline"
                  onPress={handleRegister}
                  loading={loading}
                />
              </GlassCard>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>
                Already have an account? Sign In
              </Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingVertical: SPACING.xl,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  roleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  roleChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  roleHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  privacyBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  link: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(11, 48, 152, 0.45)',
    borderColor: COLORS.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
});
