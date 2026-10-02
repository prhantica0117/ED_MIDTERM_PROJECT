import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signUp } from '@/lib/auth';

type Field = 'fullName' | 'email' | 'password' | 'confirmPassword';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [focused, setFocused] = useState<Field | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(
        email.trim(),
        password,
        { full_name: fullName.trim(), role }
      );

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch (err) {
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
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register to start recording attendance</Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email!</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Click the link to verify your
                  account, then come back and sign in.
                </Text>
                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={[styles.input, focused === 'fullName' && styles.inputFocused]}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocused('fullName')}
                  onBlur={() => setFocused(null)}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!loading}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, focused === 'email' && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, focused === 'password' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={[styles.input, focused === 'confirmPassword' && styles.inputFocused]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocused('confirmPassword')}
                  onBlur={() => setFocused(null)}
                  placeholder="Re-enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>I am a...</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    style={[
                      styles.roleChip,
                      role === 'student' && styles.roleChipActive,
                    ]}
                    onPress={() => setRole('student')}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'student' && styles.roleChipTextActive,
                      ]}
                    >
                      Student
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleChip,
                      role === 'teacher' && styles.roleChipActive,
                    ]}
                    onPress={() => setRole('teacher')}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'teacher' && styles.roleChipTextActive,
                      ]}
                    >
                      Teacher
                    </Text>
                  </Pressable>
                </View>

                {error && <Text style={styles.error}>{error}</Text>}

                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
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
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xxxl,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: SPACING.xxxl,
  },
  form: {
    marginBottom: SPACING.xxl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  roleChip: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    padding: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
});