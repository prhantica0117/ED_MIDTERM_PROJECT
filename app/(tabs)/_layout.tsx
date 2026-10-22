import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path, Rect, Defs, ClipPath } from 'react-native-svg';
import { BottomTabBarProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text } from 'react-native';

import { COLORS } from '@/constants/colors';
import { SHADOW, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useRole } from '@/lib/roles';

type TabDef = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const HOME: TabDef = {
  name: 'index',
  title: 'Home',
  icon: 'home-outline',
  iconFocused: 'home-sharp',
};

const SCAN: TabDef = {
  name: 'scan',
  title: 'Scan',
  icon: 'qr-code-outline',
  iconFocused: 'qr-code-sharp',
};

const EVENTS: TabDef = {
  name: 'events',
  title: 'Events',
  icon: 'calendar-outline',
  iconFocused: 'calendar-sharp',
};

const HISTORY: TabDef = {
  name: 'history',
  title: 'Records',
  icon: 'time-outline',
  iconFocused: 'time-sharp',
};

const USERS: TabDef = {
  name: 'users',
  title: 'Users',
  icon: 'people-outline',
  iconFocused: 'people-sharp',
};

const PROFILE: TabDef = {
  name: 'profile',
  title: 'Profile',
  icon: 'person-outline',
  iconFocused: 'person-sharp',
};

function tabsForRole(role: string | null): TabDef[] {
  if (role === 'teacher') return [HOME, EVENTS, HISTORY, PROFILE];
  if (role === 'admin') return [HOME, EVENTS, HISTORY, USERS, PROFILE];
  return [HOME, EVENTS, SCAN, HISTORY, PROFILE];
}

const FAB_SIZE = 60;
const FAB_GAP = 16;
const CURVE_RADIUS = 40;

function CustomBottomTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation, ...rest } = props;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const fabWrapHeight = tabBarHeight + insets.top;

  const cutoutTop = Math.max(insets.top + 8, 0);
  const cutoutHeight = FAB_SIZE + FAB_GAP + 2 * CURVE_RADIUS;
  const cutoutBottom = cutoutTop + cutoutHeight;

  const scanIndex = state.routes.findIndex((r) => r.name === 'scan');
  const tabBarContentWidth = (props as any).tabBarWidth ?? 0;
  const centerX = tabBarContentWidth / 2;

  const leftTabs = state.routes.slice(0, scanIndex);
  const scanRoute = state.routes[scanIndex];
  const rightTabs = state.routes.slice(scanIndex + 1);

  const remainingSpace = Math.max(tabBarContentWidth - FAB_SIZE - FAB_GAP * 2, 0);
  const avgTabWidth = Math.max(
    (remainingSpace - FAB_GAP * (leftTabs.length + rightTabs.length)) / Math.max(leftTabs.length + rightTabs.length, 1),
    60
  );

  let leftX = 0;
  const leftTabsLayout = leftTabs.map((tab: any, i: number) => {
    const tabWidth = avgTabWidth * 0.9;
    const result = { ...tab, x: leftX, width: tabWidth };
    leftX += tabWidth + FAB_GAP;
    return result;
  });

  let rightX = centerX + FAB_SIZE / 2 + FAB_GAP;
  const rightTabsLayout = rightTabs.map((tab: any, i: number) => {
    const tabWidth = avgTabWidth * 0.9;
    const result = { ...tab, x: rightX, width: tabWidth };
    rightX += tabWidth + FAB_GAP;
    return result;
  });

  return (
    <View
      style={[
        styles.container,
        {
          height: tabBarHeight,
          paddingTop: insets.top,
          paddingBottom: rest.style?.paddingBottom ?? SPACING.sm,
          backgroundColor: rest.style?.backgroundColor ?? COLORS.backgroundDeep,
          borderTopColor: rest.style?.borderTopColor ?? COLORS.border,
          borderTopWidth: rest.style?.borderTopWidth ?? 1,
        },
      ]}
    >
      {leftTabsLayout.map((tab) => (
        <View key={tab.key} style={[styles.tab, { left: tab.x, width: tab.width }]}>
          {tab.options?.tabBarButton?.({ ...props, pressableProps: {} as any })}
        </View>
      ))}

      <View style={[styles.fabWrap, { top: -tabBarHeight + fabWrapHeight }]}>
        <View style={[styles.fab, { left: centerX - FAB_SIZE / 2 }]}>
          <View style={[styles.fabShadow, { backgroundColor: COLORS.shadow }]} />
          <View style={[styles.fabContainer, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="qr-code-sharp" size={28} color={COLORS.white} />
            <Text style={styles.fabLabel}>Scan</Text>
          </View>
        </View>
      </View>

      {rightTabsLayout.map((tab) => (
        <View key={tab.key} style={[styles.tab, { left: tab.x, width: tab.width }]}>
          {tab.options?.tabBarButton?.({ ...props, pressableProps: {} as any })}
        </View>
      ))}

      <Svg
        width={tabBarContentWidth}
        height={tabBarHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <ClipPath id="cradleClip">
            <Path
              d={"M 0 0" +
                 "\n" +
                 "L " + cutoutTop + " " + cutoutTop +
                 "\n" +
                 "Q " + cutoutTop + " " + (cutoutTop - CURVE_RADIUS) + " " + (cutoutTop + CURVE_RADIUS) + " " + cutoutTop +
                 "\n" +
                 "L " + (centerX - FAB_SIZE / 2) + " " + cutoutTop +
                 "\n" +
                 "L " + (centerX + FAB_SIZE / 2) + " " + cutoutTop +
                 "\n" +
                 "Q " + (cutoutTop + CURVE_RADIUS) + " " + (cutoutTop - CURVE_RADIUS) + " " + (cutoutTop + cutoutHeight) + " " + cutoutTop +
                 "\n" +
                 "L " + tabBarContentWidth + " 0" +
                 "\n" +
                 "L 0 0" +
                 "\n" +
                 "Z"}
              fill="white"
            />
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={tabBarContentWidth} height={tabBarHeight} fill={COLORS.border} />
        <Rect x={0} y={0} width={tabBarContentWidth} height={tabBarHeight} fill="transparent" clipPath="url(#cradleClip)" />
      </Svg>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const { role } = useRole(user?.id);

  const visibleTabs = tabsForRole(role);
  const visibleNames = new Set(visibleTabs.map((t) => t.name));

  const allTabs: TabDef[] = [HOME, EVENTS, SCAN, HISTORY, USERS, PROFILE];

  const renderTab = (tab: TabDef) => (
    <Tabs.Screen
      key={tab.name}
      name={tab.name}
      options={{
        title: tab.title,
        href: visibleNames.has(tab.name) ? undefined : null,
        sceneStyle: { backgroundColor: COLORS.backgroundDeep },
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? tab.iconFocused : tab.icon} color={color} size={24} />
        ),
      }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: 'rgba(4, 9, 26, 0.94)',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 66,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: SPACING.sm,
          ...SHADOW.elevated,
        },
      }}
    >
      {allTabs.map(renderTab)}
    </Tabs>
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
