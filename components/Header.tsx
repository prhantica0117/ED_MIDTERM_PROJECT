import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { SPACING } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
};

export default function Header({ title, subtitle, align = 'center' }: Props) {
  const isLeft = align === 'left';

  return (
    <View style={[styles.container, isLeft ? styles.alignLeft : styles.alignCenter]}>
      <View style={styles.logoCircle}>
        <MaterialIcons name="school" size={32} color={COLORS.primary} />
      </View>
      <View style={isLeft ? undefined : styles.textBlockCentered}>
        <Text style={[styles.title, isLeft ? styles.textLeft : styles.textCenter]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, isLeft ? styles.textLeft : styles.textCenter]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: SPACING.xxl,
  },
  alignCenter: {
    alignItems: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  textBlockCentered: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  textCenter: {
    textAlign: 'center',
  },
  textLeft: {
    textAlign: 'left',
  },
});
