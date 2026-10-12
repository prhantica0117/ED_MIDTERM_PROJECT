import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';

type Props = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
};

/** Square glass checkbox row — Data Privacy agreement + target audience filters. */
export default function CheckboxField({
  label,
  checked,
  onToggle,
  description,
  disabled = false,
  danger = false,
}: Props) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.disabled]}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.box, checked && styles.boxChecked, danger && checked && styles.boxDanger]}>
        {checked ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  disabled: { opacity: 0.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.accent,
  },
  boxDanger: {
    backgroundColor: COLORS.crimson,
    borderColor: COLORS.crimsonLight,
  },
  body: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 20 },
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
});
