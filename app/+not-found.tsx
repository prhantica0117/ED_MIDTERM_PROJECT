import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import GlassCard from '@/components/GlassCard';
import { COLORS } from '@/constants/colors';
import { GUTTER, SPACING } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <MaterialIcons name="explore-off" size={48} color={COLORS.accent} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.text}>The screen you are looking for does not exist.</Text>
        <Link href="/(tabs)" style={styles.link}>
          Go to Home
        </Link>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: GUTTER,
  },
  card: {
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  text: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
  },
});