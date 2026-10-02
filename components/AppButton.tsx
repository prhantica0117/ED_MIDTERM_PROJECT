import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap; // Made icon optional
  theme?: Variant;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({ title, icon, theme, onPress, disabled, style }: Props) {
  const variant: Variant = theme ?? 'secondary';

  const iconColor =
    variant === 'primary' || variant === 'danger'
      ? COLORS.textOnPrimary
      : variant === 'ghost'
        ? COLORS.primary
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
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        android_ripple={
          variant === 'ghost' || variant === 'secondary'
            ? { color: COLORS.primaryTint }
            : { color: 'rgba(255,255,255,0.2)' }
        }
      >
        {icon && <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />}
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
    borderColor: COLORS.primary,
    ...SHADOW.card,
  },
  secondaryFill: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  dangerFill: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
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
    color: COLORS.primary,
  },
});