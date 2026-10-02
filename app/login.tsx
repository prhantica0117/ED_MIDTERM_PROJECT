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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(email.trim(), password);

      if (authError) {
        setError(authError.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
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

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to record your attendance</Text>

            <View style={styles.form}>
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
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                editable={!loading}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>

            <Link href="/register" style={styles.link}>
              Don't have an account? Sign Up
            </Link>
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
    backgroundColor: COLORS.card,
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
});