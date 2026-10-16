import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { signIn } from '@/lib/auth';
import { validateEmail } from '@/lib/validation';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Event: user presses "Sign In" → handler → validate + authenticate
  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Incorrect email or password.'
            : authError.message
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error. Please try again.');
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

            <GlassCard style={styles.card}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to record or manage attendance</Text>

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
                placeholder="Enter your password"
                secureTextEntry
                showPasswordToggle
                editable={!loading}
                icon="lock-closed-outline"
              />

              {error ? (
                <FeedbackBanner tone="error" title="Sign in failed" message={error} />
              ) : null}

              <AppButton
                theme="primary"
                title="Sign In"
                icon="log-in-outline"
                onPress={handleLogin}
                loading={loading}
              />
            </GlassCard>

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
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACING.xxxl,
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
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  link: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});