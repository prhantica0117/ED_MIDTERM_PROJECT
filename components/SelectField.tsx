import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import GlassCard from '@/components/GlassCard';
import { COLORS } from '@/constants/colors';
import type { SelectOption } from '@/constants/education';
import { RADIUS, SPACING } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Glass dropdown — React Native has no native select, so this opens a modal
 * with the option list. Used for every education / target selector in the app.
 */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
  disabled = false,
  icon,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[
          styles.shell,
          !!error && styles.shellError,
          disabled && styles.shellDisabled,
        ]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={selected ? COLORS.accent : COLORS.textMuted}
            style={styles.icon}
          />
        ) : null}
        <Text
          style={[styles.value, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
      </Pressable>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={COLORS.crimsonLight} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
            <GlassCard strong style={styles.sheet}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <ScrollView style={styles.optionScroll} bounces={false}>
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {option.label}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={18} color={COLORS.accent} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    minHeight: 50,
  },
  shellError: { borderColor: COLORS.crimsonLight },
  shellDisabled: { opacity: 0.5 },
  icon: { marginRight: SPACING.sm },
  value: { flex: 1, fontSize: 16, color: COLORS.textPrimary, paddingVertical: SPACING.md },
  placeholder: { color: COLORS.textMuted },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  errorText: { fontSize: 13, color: COLORS.crimsonLight, flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 26, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  sheetWrap: { width: '100%', maxWidth: 360 },
  sheet: { padding: SPACING.lg },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  optionScroll: { maxHeight: 320 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  optionActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.14)',
  },
  optionText: { fontSize: 15, color: COLORS.textSecondary, flex: 1 },
  optionTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  closeBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  closeText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
});
