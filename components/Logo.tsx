import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

type Variant = 'dark' | 'light';

type Props = {
  variant?: Variant;
  width?: number;
  height?: number;
  style?: any;
};

const LOGOS: Record<Variant, any> = {
  dark: require('../assets/images/Logo-CCTC-QR-dark.png'),
  light: require('../assets/images/Logo-CCTC-QR.jpg'),
};

/**
 * Reusable QR-ATT logo.
 *
 * • `variant="dark"` (default) — black background; blends into the deep-navy
 *   anamorphic theme. Use on screens, headers, and dark cards.
 * • `variant="light"` — light/white background; use for splash screens,
 *   onboarding, print, or any light-context surface.
 */
export default function Logo({ variant = 'dark', width = 100, height = 100, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={LOGOS[variant]}
        style={[styles.image, { width, height }]}
        contentFit="cover"
        accessibilityLabel="QR Attendance logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
