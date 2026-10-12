import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

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

/**
 * Role-based tab visibility (authorization in the UI layer):
 *  • Student  → Home · Scan · Records · Profile
 *  • Teacher  → Home · Events · Records · Profile
 *  • Admin    → Home · Events · Records · Users · Profile
 * Hidden tabs are still routed but each screen also re-checks the role.
 */
function tabsForRole(role: string | null): TabDef[] {
  if (role === 'teacher') return [HOME, EVENTS, HISTORY, PROFILE];
  if (role === 'admin') return [HOME, EVENTS, HISTORY, USERS, PROFILE];
  return [HOME, SCAN, HISTORY, PROFILE];
}

export default function TabLayout() {
  const { user } = useAuth();
  const { role } = useRole(user?.id);

  const visibleTabs = tabsForRole(role);
  const visibleNames = new Set(visibleTabs.map((t) => t.name));

  const allTabs: TabDef[] = [HOME, SCAN, EVENTS, HISTORY, USERS, PROFILE];

  const renderTab = (tab: TabDef) => (
    <Tabs.Screen
      key={tab.name}
      name={tab.name}
      options={{
        title: tab.title,
        href: visibleNames.has(tab.name) ? undefined : null,
        // Opaque deep-navy scene behind each tab — no white flash on switch
        sceneStyle: { backgroundColor: COLORS.backgroundDeep },
        tabBarIcon: ({ color, focused }) => (
          <Ionicons
            name={focused ? tab.iconFocused : tab.icon}
            color={color}
            size={24}
          />
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
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