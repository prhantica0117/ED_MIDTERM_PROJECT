import { View, StyleSheet, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '@/constants/colors';
import { GUTTER, RADIUS, SPACING } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="search-off" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>
          The screen you're looking for doesn't exist or has moved.
        </Text>
        <Link href="/" style={styles.button}>
          Go back to Home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.xxl,
  },
  button: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
});
