import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * AnamorphicBackground
 *
 * Full-bleed "anamorphic" backdrop: a deep-navy vertical gradient with
 * elongated, rotated light streaks (royal blue, crimson, wood-brown) that
 * fade to transparent — the stretched, lens-flare look of anamorphic glass,
 * without any raster images or extra native modules.
 *
 * Layer 1 (static)  — base gradient + all colour streaks
 * Layer 2 (animated)— a soft highlight that slowly drifts/pulses for depth
 *
 * Mount it once behind the app (see app/_layout.tsx). Every screen stays
 * transparent so the streaks bleed through the glass cards.
 */
export default function AnamorphicBackground() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 11000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 11000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const pulse = drift.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Layer 1 — base + colour streaks */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Deep navy vertical base — never a shade of white */}
          <LinearGradient id="abBase" x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor="#081236" stopOpacity="1" />
            <Stop offset="0.55" stopColor="#050B22" stopOpacity="1" />
            <Stop offset="1" stopColor="#02050F" stopOpacity="1" />
          </LinearGradient>

          {/* Royal / Navy Blue streak */}
          <RadialGradient id="abBlue" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#0B3098" stopOpacity="0.90" />
            <Stop offset="0.5" stopColor="#0B3098" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#0B3098" stopOpacity="0" />
          </RadialGradient>

          {/* Lifted blue glow (same 224° hue, brighter for on-dark depth) */}
          <RadialGradient id="abBlueGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#2550D6" stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#2550D6" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#2550D6" stopOpacity="0" />
          </RadialGradient>

          {/* Crimson Red streak */}
          <RadialGradient id="abCrimson" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#BD1B20" stopOpacity="0.60" />
            <Stop offset="0.5" stopColor="#BD1B20" stopOpacity="0.24" />
            <Stop offset="1" stopColor="#BD1B20" stopOpacity="0" />
          </RadialGradient>

          {/* Wood / Leather Brown streak */}
          <RadialGradient id="abBrown" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#6E4536" stopOpacity="0.75" />
            <Stop offset="0.55" stopColor="#3A1E14" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#3A1E14" stopOpacity="0" />
          </RadialGradient>

          {/* Anamorphic royal-blue lens flare (very subtle, never white) */}
          <RadialGradient id="abFlare" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#4C79FF" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#4C79FF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100" height="200" fill="url(#abBase)" />

        {/* Royal blue sweep, top-left → middle */}
        <G rotation={-22} origin="30 55">
          <Ellipse cx="30" cy="55" rx="80" ry="46" fill="url(#abBlue)" />
        </G>

        {/* Bright blue glow, top-right */}
        <G rotation={16} origin="88 26">
          <Ellipse cx="88" cy="26" rx="56" ry="52" fill="url(#abBlueGlow)" />
        </G>

        {/* Crimson sweep, right-middle */}
        <G rotation={20} origin="84 122">
          <Ellipse cx="84" cy="122" rx="66" ry="34" fill="url(#abCrimson)" />
        </G>

        {/* Wood-brown depth, bottom */}
        <G rotation={-8} origin="45 196">
          <Ellipse cx="45" cy="196" rx="96" ry="56" fill="url(#abBrown)" />
        </G>

        {/* Thin anamorphic flare, upper-right diagonal */}
        <G rotation={-18} origin="72 14">
          <Ellipse cx="72" cy="14" rx="64" ry="9" fill="url(#abFlare)" />
        </G>
      </Svg>

      {/* Layer 2 — drifting highlight for a living, "real-time" feel */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: pulse, transform: [{ translateY: driftY }] }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 200"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <RadialGradient id="abDrift" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#4C79FF" stopOpacity="0.40" />
              <Stop offset="1" stopColor="#4C79FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <G rotation={28} origin="18 96">
            <Ellipse cx="18" cy="96" rx="58" ry="30" fill="url(#abDrift)" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}