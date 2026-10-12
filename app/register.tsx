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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import FormField from '@/components/FormField';
import GlassCard from '@/components/GlassCard';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signUp } from '@/lib/auth';
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from '@/lib/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Event: user presses "Create Account" → validate → register
  const handleRegister = async () => {
    setError(null);

    const nameError = validateName(fullName, 'Full name');
    if (nameError) return setError(nameError);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);

    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) return setError(confirmError);

    setLoading(true);
    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        role,
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

                <Text style={styles.label}>I am a…</Text>
                <View style={styles.roleRow}>
                  {(['student', 'teacher'] as const).map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.roleChip, role === option && styles.roleChipActive]}
                      onPress={() => setRole(option)}
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
    </View>
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