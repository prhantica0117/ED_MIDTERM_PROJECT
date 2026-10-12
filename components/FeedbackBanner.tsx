import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';

export type BannerTone = 'success' | 'error' | 'warning' | 'info';

type Props = {
  tone?: BannerTone;
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

const TONES: Record<
  BannerTone,
  { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; tint: string }
> = {
  success: {
    bg: 'rgba(47, 191, 113, 0.14)',
    border: 'rgba(47, 191, 113, 0.55)',
    icon: 'checkmark-circle',
    tint: '#5FE0A0',
  },
  error: {
    bg: 'rgba(189, 27, 32, 0.18)',
    border: COLORS.crimsonLight,
    icon: 'close-circle',
    tint: '#FF8F93',
  },
  warning: {
    bg: 'rgba(245, 165, 36, 0.14)',
    border: 'rgba(245, 165, 36, 0.55)',
    icon: 'warning',
    tint: '#F7C46B',
  },
  info: {
    bg: 'rgba(76, 121, 255, 0.14)',
    border: 'rgba(76, 121, 255, 0.55)',
    icon: 'information-circle',
    tint: '#93AEFF',
  },
};

/**
 * Inline feedback banner for loading/success/error/empty/invalid-QR/
 * duplicate/closed-event/unauthorized messages — replaces native alerts so
 * feedback matches the app's aesthetic.
 */
export default function FeedbackBanner({
  tone = 'info',
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
}: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={t.icon} size={22} color={t.tint} style={styles.icon} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: t.tint }]}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
        {onRetry ? (
          <Text style={styles.retry} onPress={onRetry}>
            {retryLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  icon: {
    marginRight: SPACING.md,
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  retry: {
    marginTop: SPACING.sm,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
  },
});