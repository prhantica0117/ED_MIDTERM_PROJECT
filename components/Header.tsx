import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { COLORS } from '@/constants/colors';
import { SPACING } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
};

export default function Header({ title, subtitle, align = 'center' }: Props) {
  const isLeft = align === 'left';

  // Entrance (fade + scale-in + rise) then a gentle looping idle pulse
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [entrance, pulse]);

  const opacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const entranceScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const scale = Animated.multiply(entranceScale, pulseScale);

  return (
    <View style={[styles.container, isLeft ? styles.alignLeft : styles.alignCenter]}>
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImage}
            contentFit="cover"
            accessibilityLabel="QR Attendance logo"
          />
        </View>
      </Animated.View>
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
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderColor: COLORS.glassBorder,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  logoImage: {
    width: '100%',
    height: '100%',
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