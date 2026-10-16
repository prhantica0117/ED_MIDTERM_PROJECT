import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  secureTextEntry?: boolean;
  /** Show an eye icon that lets the user reveal/hide the password. Opt-in. */
  showPasswordToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  editable?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
};

/**
 * Consistent label + glass input + inline validation error used by every
 * form in the app (login, register, event editor…).
 */
export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline,
  editable = true,
  icon,
  hint,
  showPasswordToggle,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const canToggle = !!showPasswordToggle && !!secureTextEntry;
  const hidden = !!secureTextEntry && !revealed;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          !!error && styles.inputShellError,
          multiline && styles.multilineShell,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.accent : COLORS.textMuted}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          editable={editable}
        />
        {canToggle ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={COLORS.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={COLORS.crimsonLight} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 2,
  },
  inputShellFocused: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(76, 121, 255, 0.10)',
  },
  inputShellError: {
    borderColor: COLORS.crimsonLight,
  },
  multilineShell: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: SPACING.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.md,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.crimsonLight,
    flex: 1,
  },
});