import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import { Svg, Path, Rect, Defs, ClipPath } from 'react-native-svg';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

import { COLORS } from '@/constants/colors';
import { RADIUS } from '@/constants/theme';

const FAB_SIZE = 60;
const FAB_GAP = 16;
const CURVE_RADIUS = 40;

/**
 * Custom bottom tab bar with a floating container, SVG cradle dip cutout,
 * and center Scan FAB. Renders for all roles; the center FAB only appears
 * when a route named 'scan' exists in the navigation state (students only).
 * Role-based tab visibility is handled by app/(tabs)/_layout.tsx.
 */
export function CustomTabBar(props: any) {
  const { state, descriptors, navigation, ...rest } = props;

  // Safety: ensure state and routes exist before using them
  const routes = state?.routes ?? [];
  const focusedRouteName = state?.routes[state?.index ?? 0]?.name ?? null;

  // Use tabBarHeight matching _layout.tsx screenOptions: iOS=88, Android=66
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 66;
  const { width: screenWidth } = useWindowDimensions();

  const cutoutTop = 8;
  const cutoutHeight = FAB_SIZE + FAB_GAP + 2 * CURVE_RADIUS;

  const scanIndex = routes.findIndex((r: { name: string }) => r.name === 'scan');
  const tabBarContentWidth = (props as any).tabBarWidth ?? screenWidth ?? Math.max(screenWidth, 375);
  const centerX = tabBarContentWidth / 2;

  const hasCenterTab = scanIndex !== -1;
  const scanRoute = routes[scanIndex] ?? null;

  const leftTabs = routes.slice(0, hasCenterTab ? scanIndex : Math.floor(routes.length / 2));
  const rightTabs = routes.slice(hasCenterTab ? scanIndex + 1 : Math.ceil(routes.length / 2));

  const remainingSpace = Math.max(tabBarContentWidth - (hasCenterTab ? FAB_SIZE + FAB_GAP * 2 : 0), 0);
  const avgTabWidth = Math.max(
    (remainingSpace - FAB_GAP * (leftTabs.length + rightTabs.length)) / Math.max(leftTabs.length + rightTabs.length, 1),
    60,
  );

  let leftX = 0;
  const leftTabsLayout = leftTabs.map((tab: any, i: number) => {
    const tabWidth = avgTabWidth * 0.9;
    const result = { ...tab, x: leftX, width: tabWidth };
    leftX += tabWidth + FAB_GAP;
    return result;
  });

  let rightX = hasCenterTab ? centerX + FAB_SIZE / 2 + FAB_GAP : leftX + FAB_GAP;
  const rightTabsLayout = rightTabs.map((tab: any, i: number) => {
    const tabWidth = avgTabWidth * 0.9;
    const result = { ...tab, x: rightX, width: tabWidth };
    rightX += tabWidth + FAB_GAP;
    return result;
  });

  const pathDStraight = `M 0 0 L ${tabBarContentWidth} 0 L ${tabBarContentWidth} ${tabBarHeight} L 0 ${tabBarHeight} Z`;
  const pathDWithCradle = `M 0 0 L ${cutoutTop} ${cutoutTop} Q ${cutoutTop} ${cutoutTop - CURVE_RADIUS} ${cutoutTop + CURVE_RADIUS} ${cutoutTop} L ${centerX - FAB_SIZE / 2} ${cutoutTop} L ${centerX + FAB_SIZE / 2} ${cutoutTop} Q ${cutoutTop + CURVE_RADIUS} ${cutoutTop - CURVE_RADIUS} ${cutoutTop + cutoutHeight} ${cutoutTop} L ${tabBarContentWidth} 0 L 0 0 Z`;
  const pathD = hasCenterTab ? pathDWithCradle : pathDStraight;

  // Map route name to icon
  const iconForRoute = (routeName: string): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'index': return 'home-outline';
      case 'events': return 'calendar-outline';
      case 'scan': return 'qr-code-outline';
      case 'history': return 'time-outline';
      case 'users': return 'people-outline';
      case 'profile': return 'person-outline';
      default: return 'help-outline';
    }
  };

  const iconFocusedForRoute = (routeName: string): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'index': return 'home-sharp';
      case 'events': return 'calendar-sharp';
      case 'scan': return 'qr-code-sharp';
      case 'history': return 'time-sharp';
      case 'users': return 'people-sharp';
      case 'profile': return 'person-sharp';
      default: return 'help-circle-outline';
    }
  };

  // Render a tab button with icon + label
  const renderTabButton = (tab: any, focused: boolean) => {
    const routeName = tab.name ?? '';
    const color = focused ? COLORS.accent : COLORS.textMuted;
    const iconName = focused ? iconFocusedForRoute(routeName) : iconForRoute(routeName);

    return (
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={iconName} size={24} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
          {tab.title ?? routeName}
        </Text>
      </View>
    );
  };
  return (
    <View
      style={[
        styles.container,
        {
          height: tabBarHeight,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 16,
          backgroundColor: COLORS.backgroundDeep,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          borderRadius: RADIUS.lg,
          overflow: 'hidden',
        },
      ]}
    >
      {/* SVG curved cutout along the top border (the cradle dip) */}
      <Svg
        width={tabBarContentWidth}
        height={tabBarHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <ClipPath id="cradleClip">
            <Path d={pathD} fill="white" />
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={tabBarContentWidth} height={tabBarHeight} fill={COLORS.border} />
        <Rect x={0} y={0} width={tabBarContentWidth} height={tabBarHeight} fill="transparent" clipPath="url(#cradleClip)" />
      </Svg>

      {/* Center FAB - elevated circular FAB positioned inside the cutout */}
      {scanRoute && (
        <View style={[styles.fabWrap, { top: 8 }]}>
          <View style={[styles.fab, { left: centerX - FAB_SIZE / 2 }]}>
            <View style={[styles.fabShadow, { backgroundColor: COLORS.shadow }]} />
            <View style={[styles.fabContainer, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="qr-code-sharp" size={28} color={COLORS.white} />
              <Text style={styles.fabLabel}>Scan</Text>
            </View>
          </View>
        </View>
      )}

      {/* Left tabs */}
      {leftTabsLayout.map((tab: any) => (
        <TouchableOpacity
          key={tab.key ?? tab.name ?? `tab-${Math.random()}`}
          style={[styles.tab, { left: tab.x, width: tab.width }]}
          onPress={() => navigation?.navigate(tab.name)}
        >
          {renderTabButton(tab, focusedRouteName === tab.name)}
        </TouchableOpacity>
      ))}

      {/* Right tabs */}
      {rightTabsLayout.map((tab: any) => (
        <TouchableOpacity
          key={tab.key ?? tab.name ?? `tab-${Math.random()}`}
          style={[styles.tab, { left: tab.x, width: tab.width }]}
          onPress={() => navigation?.navigate(tab.name)}
        >
          {renderTabButton(tab, focusedRouteName === tab.name)}
        </TouchableOpacity>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tab: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fabShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  fabLabel: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});