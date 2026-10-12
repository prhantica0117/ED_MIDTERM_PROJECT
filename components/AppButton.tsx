import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  theme?: Variant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({
  title,
  icon,
  theme,
  onPress,
  disabled,
  loading = false,
  style,
}: Props) {
  const variant: Variant = theme ?? 'secondary';

  const iconColor =
    variant === 'primary' || variant === 'danger'
      ? COLORS.textOnPrimary
      : variant === 'ghost'
        ? COLORS.accent
        : COLORS.textPrimary;

  return (
    <View style={[styles.buttonOuter, style]}>
      <Pressable
        style={({ pressed }) => [
          styles.buttonInner,
          variant === 'primary' && styles.primaryFill,
          variant === 'secondary' && styles.secondaryFill,
          variant === 'danger' && styles.dangerFill,
          variant === 'ghost' && styles.ghostFill,
          pressed && styles.pressed,
          (disabled || loading) && styles.disabled,
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        android_ripple={
          variant === 'ghost' || variant === 'secondary'
            ? { color: 'rgba(76, 121, 255, 0.35)' }
            : { color: 'rgba(255,255,255,0.25)' }
        }
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'secondary' ? COLORS.accent : COLORS.textOnPrimary}
            style={styles.icon}
          />
        ) : (
          icon && <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
        )}
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'danger' && styles.dangerLabel,
            variant === 'ghost' && styles.ghostLabel,
          ]}
        >
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  buttonInner: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
  },
  primaryFill: {
    backgroundColor: COLORS.primary,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    ...SHADOW.card,
  },
  secondaryFill: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: COLORS.border,
  },
  dangerFill: {
    backgroundColor: COLORS.crimson,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    ...SHADOW.card,
  },
  ghostFill: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  label: {
    fontSize: 16,
  },
  primaryLabel: {
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  secondaryLabel: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dangerLabel: {
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  ghostLabel: {
    fontWeight: '600',
    color: COLORS.accent,
  },
});