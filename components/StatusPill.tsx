import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';

export type PillTone =
  | 'open'
  | 'closed'
  | 'present'
  | 'late'
  | 'absent'
  | 'student'
  | 'teacher'
  | 'admin'
  | 'info';

type Props = {
  label: string;
  tone?: PillTone;
  small?: boolean;
};

const TONES: Record<PillTone, { bg: string; fg: string; border: string }> = {
  open: { bg: 'rgba(47, 191, 113, 0.16)', fg: '#5FE0A0', border: 'rgba(47, 191, 113, 0.45)' },
  closed: { bg: COLORS.crimsonTint, fg: '#FF8F93', border: 'rgba(189, 27, 32, 0.55)' },
  present: { bg: 'rgba(47, 191, 113, 0.16)', fg: '#5FE0A0', border: 'rgba(47, 191, 113, 0.45)' },
  late: { bg: 'rgba(245, 165, 36, 0.16)', fg: '#F7C46B', border: 'rgba(245, 165, 36, 0.45)' },
  absent: { bg: COLORS.crimsonTint, fg: '#FF8F93', border: 'rgba(189, 27, 32, 0.55)' },
  student: { bg: 'rgba(76, 121, 255, 0.16)', fg: '#93AEFF', border: 'rgba(76, 121, 255, 0.45)' },
  teacher: { bg: COLORS.brownTint, fg: '#D2A78F', border: 'rgba(110, 69, 54, 0.75)' },
  admin: { bg: COLORS.crimsonTint, fg: '#FF8F93', border: 'rgba(189, 27, 32, 0.55)' },
  info: { bg: 'rgba(76, 121, 255, 0.14)', fg: '#93AEFF', border: 'rgba(76, 121, 255, 0.40)' },
};

/** Small rounded status/role badge in the brand palette. */
export default function StatusPill({ label, tone = 'info', small = false }: Props) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.pill,
        small ? styles.pillSmall : styles.pillNormal,
        { backgroundColor: t.bg, borderColor: t.border },
      ]}
    >
      <Text style={[styles.text, small && styles.textSmall, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillNormal: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  pillSmall: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 10,
  },
});