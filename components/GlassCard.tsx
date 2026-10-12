import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stronger, more opaque panel — used over live camera previews etc. */
  strong?: boolean;
  padded?: boolean;
};

/**
 * Translucent "glass" surface used for every card in the app so the
 * anamorphic background bleeds through. Never opaque white.
 */
export default function GlassCard({ children, style, strong = false, padded = true }: Props) {
  return (
    <View
      style={[
        styles.card,
        strong && styles.strong,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },
  strong: {
    backgroundColor: 'rgba(5, 11, 34, 0.82)',
  },
  padded: {
    padding: SPACING.lg,
  },
});